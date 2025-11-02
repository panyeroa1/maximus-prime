import React, { useState, useMemo, useRef, useContext } from 'react';
import { Booking } from '../types';
import { useCrm } from '../contexts/CrmContext';
import BookingModal from './BookingModal';
import { DatabaseIcon, SearchIcon, UploadIcon, DownloadIcon, PlusIcon, EditIcon, Trash2Icon } from './icons';

const HighlightMatch: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-eburon-warn/70 text-black px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const CrmView: React.FC = () => {
    const { bookings, addBooking, updateBooking, deleteBooking, mergeBookings } = useCrm();
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    const filteredBookings = useMemo(() => {
        if (!searchTerm) return bookings;
        const lowercasedFilter = searchTerm.toLowerCase();
        return bookings.filter(booking =>
            booking.passengerName.toLowerCase().includes(lowercasedFilter) ||
            booking.pnr.toLowerCase().includes(lowercasedFilter) ||
            booking.email.toLowerCase().includes(lowercasedFilter) ||
            booking.flightNumber.toLowerCase().includes(lowercasedFilter) ||
            booking.origin.toLowerCase().includes(lowercasedFilter) ||
            booking.destination.toLowerCase().includes(lowercasedFilter)
        );
    }, [bookings, searchTerm]);

    const dashboardStats = useMemo(() => {
        const total = bookings.length;
        const confirmed = bookings.filter(b => b.status === 'Confirmed').length;
        const pending = bookings.filter(b => b.status === 'Pending').length;
        const cancelled = bookings.filter(b => b.status === 'Cancelled').length;
        return { total, confirmed, pending, cancelled };
    }, [bookings]);
    
    const getStatusColor = (status: Booking['status']) => {
        switch (status) {
            case 'Confirmed': return 'bg-eburon-ok/20 text-eburon-ok';
            case 'Cancelled': return 'bg-red-500/20 text-red-400';
            case 'Pending': return 'bg-eburon-warn/20 text-eburon-warn';
            default: return 'bg-eburon-border text-eburon-fg/70';
        }
    };

    const handleOpenModalForCreate = () => {
        setEditingBooking(null);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (booking: Booking) => {
        setEditingBooking(booking);
        setIsModalOpen(true);
    };
    
    const handleDeleteBooking = (pnr: string) => {
        if (window.confirm(`Are you sure you want to delete the booking with PNR ${pnr}?`)) {
            deleteBooking(pnr);
        }
    };

    const handleSaveBooking = (bookingData: Omit<Booking, 'id'> | Booking) => {
        if ('id' in bookingData && editingBooking) {
            updateBooking(bookingData.pnr, bookingData);
        } else {
            addBooking(bookingData as Omit<Booking, 'id'>);
        }
        setIsModalOpen(false);
    };

    const handleExportCsv = () => {
        const headers: (keyof Booking)[] = ['id', 'passengerName', 'pnr', 'email', 'flightNumber', 'origin', 'destination', 'flightDate', 'status', 'notes'];
        const csvHeaders = headers.join(',');

        const rows = filteredBookings.map(booking => {
            return headers.map(header => {
                let value = booking[header] as string | undefined | null;
                if (value === null || value === undefined) {
                    value = '';
                }
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        });
        
        const csvContent = [csvHeaders, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'crm_bookings_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const lines = text.trim().split(/\r\n|\n/);
                if (lines.length < 2) throw new Error("CSV file must have a header and at least one data row.");

                const headerLine = lines.shift();
                if (!headerLine) throw new Error("Invalid CSV header.");
                const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, '') as keyof Booking);
                
                const requiredHeaders: (keyof Booking)[] = ['pnr', 'passengerName', 'email', 'flightNumber', 'origin', 'destination', 'flightDate', 'status'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    throw new Error(`Missing required CSV columns: ${missingHeaders.join(', ')}`);
                }
                
                const newBookings: Partial<Omit<Booking, 'id'>>[] = lines.map(line => {
                    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                    const bookingObject: any = {};
                    headers.forEach((header, i) => {
                        if (values[i]) {
                             bookingObject[header] = values[i].trim().replace(/^"|"$/g, '');
                        }
                    });
                    return bookingObject;
                });
                
                mergeBookings(newBookings);
                alert(`Successfully imported/merged ${newBookings.length} records.`);

            } catch (error: any) {
                alert(`Error processing CSV file: ${error.message}`);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
             alert(`Error reading file: ${reader.error}`);
             if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };


    return (
        <div className="p-8 flex flex-col">
            {isModalOpen && <BookingModal bookingToEdit={editingBooking} onSave={handleSaveBooking} onClose={() => setIsModalOpen(false)} />}
            <input type="file" ref={fileInputRef} onChange={handleImportCsv} accept=".csv" className="hidden" />
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-eburon-fg">CRM Dashboard</h1>
                <p className="text-eburon-fg/70">Manage customer booking information.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6"><h3 className="text-eburon-fg/70">Total Bookings</h3><p className="text-4xl font-bold">{dashboardStats.total}</p></div>
                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6"><h3 className="text-eburon-ok/80">Confirmed</h3><p className="text-4xl font-bold">{dashboardStats.confirmed}</p></div>
                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6"><h3 className="text-eburon-warn/80">Pending</h3><p className="text-4xl font-bold">{dashboardStats.pending}</p></div>
                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6"><h3 className="text-red-400/80">Cancelled</h3><p className="text-4xl font-bold">{dashboardStats.cancelled}</p></div>
            </div>

            <div className="bg-eburon-panel border border-eburon-border rounded-xl flex-grow flex flex-col">
                <div className="p-4 border-b border-eburon-border flex items-center justify-between gap-4 flex-wrap">
                    <div className="relative flex-grow max-w-md">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-eburon-fg/50" />
                        <input type="text" placeholder="Search by name, PNR, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-eburon-bg border border-eburon-border rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-bg border border-eburon-border hover:bg-eburon-border text-eburon-fg/80">
                            <UploadIcon className="w-5 h-5" /> Import
                        </button>
                        <button onClick={handleExportCsv} className="font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-bg border border-eburon-border hover:bg-eburon-border text-eburon-fg/80">
                            <DownloadIcon className="w-5 h-5" /> Export
                        </button>
                        <button onClick={handleOpenModalForCreate} className="font-bold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-accent hover:bg-eburon-accent-dark text-white">
                            <PlusIcon className="w-5 h-5" /> Add Booking
                        </button>
                    </div>
                </div>

                <div className="flex-grow">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-eburon-panel/80 backdrop-blur-sm">
                            <tr>
                                <th className="p-4 font-semibold text-eburon-fg/80">Passenger</th>
                                <th className="p-4 font-semibold text-eburon-fg/80">PNR</th>
                                <th className="p-4 font-semibold text-eburon-fg/80">Flight</th>
                                <th className="p-4 font-semibold text-eburon-fg/80">Route</th>
                                <th className="p-4 font-semibold text-eburon-fg/80">Date</th>
                                <th className="p-4 font-semibold text-eburon-fg/80">Status</th>
                                <th className="p-4 font-semibold text-eburon-fg/80 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.map(booking => (
                                <tr key={booking.id} className="border-b border-eburon-border hover:bg-eburon-bg">
                                    <td className="p-4"><HighlightMatch text={booking.passengerName} highlight={searchTerm} /><br/><span className="text-xs text-eburon-fg/60"><HighlightMatch text={booking.email} highlight={searchTerm} /></span></td>
                                    <td className="p-4 font-mono text-eburon-accent"><HighlightMatch text={booking.pnr} highlight={searchTerm} /></td>
                                    <td className="p-4"><HighlightMatch text={booking.flightNumber} highlight={searchTerm} /></td>
                                    <td className="p-4"><HighlightMatch text={booking.origin} highlight={searchTerm} /> → <HighlightMatch text={booking.destination} highlight={searchTerm} /></td>
                                    <td className="p-4">{new Date(booking.flightDate).toLocaleString()}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded-full font-semibold text-xs ${getStatusColor(booking.status)}`}>{booking.status}</span></td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleOpenModalForEdit(booking)} className="p-2 text-eburon-fg/70 hover:text-eburon-accent rounded-full"><EditIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteBooking(booking.pnr)} className="p-2 text-eburon-fg/70 hover:text-red-400 rounded-full"><Trash2Icon className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CrmView;
