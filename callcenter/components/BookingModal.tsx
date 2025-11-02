import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { SaveIcon, XIcon } from './icons';

interface BookingModalProps {
  bookingToEdit: Omit<Booking, 'id'> | Booking | null;
  onSave: (booking: Omit<Booking, 'id'> | Booking) => void;
  onClose: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ bookingToEdit, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<Booking, 'id'>>({
    passengerName: '',
    pnr: '',
    email: '',
    flightNumber: '',
    origin: '',
    destination: '',
    flightDate: '',
    status: 'Pending',
    notes: ''
  });

  useEffect(() => {
    if (bookingToEdit) {
      const initialData = 'id' in bookingToEdit ? { ...bookingToEdit } : bookingToEdit;
      setFormData(initialData);
    }
  }, [bookingToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const isEditMode = bookingToEdit && 'id' in bookingToEdit;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-eburon-panel border border-eburon-border rounded-xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-eburon-border flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-eburon-fg">{isEditMode ? 'Edit Booking' : 'Create New Booking'}</h2>
                <p className="text-sm text-eburon-fg/70">{isEditMode ? `Updating record for PNR: ${bookingToEdit.pnr}` : 'Enter the details for the new booking.'}</p>
            </div>
             <button type="button" onClick={onClose} className="p-2 text-eburon-fg/70 hover:text-white rounded-full hover:bg-eburon-border">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-eburon-fg/80">Passenger Name</label>
                <input type="text" name="passengerName" value={formData.passengerName} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
              <div>
                <label className="text-sm font-medium text-eburon-fg/80">PNR</label>
                <input type="text" name="pnr" value={formData.pnr} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required disabled={isEditMode} />
              </div>
            </div>
             <div>
                <label className="text-sm font-medium text-eburon-fg/80">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-eburon-fg/80">Flight Number</label>
                <input type="text" name="flightNumber" value={formData.flightNumber} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
               <div>
                <label className="text-sm font-medium text-eburon-fg/80">Flight Date</label>
                <input type="datetime-local" name="flightDate" value={formData.flightDate ? new Date(formData.flightDate).toISOString().slice(0, 16) : ''} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-eburon-fg/80">Origin</label>
                <input type="text" name="origin" value={formData.origin} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
               <div>
                <label className="text-sm font-medium text-eburon-fg/80">Destination</label>
                <input type="text" name="destination" value={formData.destination} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required />
              </div>
            </div>
             <div>
                <label className="text-sm font-medium text-eburon-fg/80">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" required>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
              </div>
               <div>
                <label className="text-sm font-medium text-eburon-fg/80">Notes</label>
                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full mt-1 bg-eburon-bg border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
              </div>
          </div>
          <div className="p-4 bg-eburon-bg/50 border-t border-eburon-border flex justify-end gap-3 rounded-b-xl">
            <button type="button" onClick={onClose} className="font-bold py-2 px-4 rounded-lg bg-eburon-border hover:bg-white/10 text-white">Cancel</button>
            <button type="submit" className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 bg-eburon-accent hover:bg-eburon-accent-dark text-white">
                <SaveIcon className="w-5 h-5" />
                <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;