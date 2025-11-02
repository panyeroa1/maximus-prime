import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { Booking } from '../types';
import { MOCK_BOOKINGS } from '../constants';

interface CrmContextType {
  bookings: Booking[];
  getBookingByPnr: (pnr: string) => Booking | undefined;
  addBooking: (bookingData: Omit<Booking, 'id'>) => Booking;
  updateBooking: (pnr: string, updates: Partial<Omit<Booking, 'id' | 'pnr'>>) => Booking | null;
  deleteBooking: (pnr: string) => boolean;
  addNoteToBooking: (pnr: string, note: string) => Booking | null;
  mergeBookings: (newBookings: Partial<Omit<Booking, 'id'>>[]) => void;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};

// FIX: Add helper function to validate 'status' property from CSV data.
const isValidStatus = (status: any): status is Booking['status'] => {
  return ['Confirmed', 'Cancelled', 'Pending'].includes(status);
};

export const CrmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);

  const getBookingByPnr = useCallback((pnr: string) => {
    return bookings.find(b => b.pnr.toLowerCase() === pnr.toLowerCase());
  }, [bookings]);

  const addBooking = (bookingData: Omit<Booking, 'id'>) => {
    const newBooking: Booking = {
      ...bookingData,
      id: `booking-${Date.now()}`,
      notes: 'Booking created by user.'
    };
    setBookings(prev => [...prev, newBooking]);
    return newBooking;
  };

  const updateBooking = (pnr: string, updates: Partial<Omit<Booking, 'id' | 'pnr'>>) => {
    let updatedBooking: Booking | null = null;
    setBookings(prev =>
      prev.map(booking => {
        if (booking.pnr.toLowerCase() === pnr.toLowerCase()) {
          updatedBooking = { ...booking, ...updates };
          return updatedBooking;
        }
        return booking;
      })
    );
    return updatedBooking;
  };

  const deleteBooking = (pnr: string) => {
    // FIX: Corrected logic to avoid stale state reads.
    const bookingExists = bookings.some(b => b.pnr.toLowerCase() === pnr.toLowerCase());
    if (bookingExists) {
      setBookings(prev => prev.filter(b => b.pnr.toLowerCase() !== pnr.toLowerCase()));
    }
    return bookingExists;
  };

  const addNoteToBooking = (pnr: string, note: string) => {
    let updatedBooking: Booking | null = null;
    const timestamp = new Date().toLocaleString();
    const formattedNote = `[${timestamp}] ${note}`;
    
    setBookings(prev =>
      prev.map(booking => {
        if (booking.pnr.toLowerCase() === pnr.toLowerCase()) {
          updatedBooking = {
            ...booking,
            notes: booking.notes ? `${booking.notes}\n${formattedNote}` : formattedNote,
          };
          return updatedBooking;
        }
        return booking;
      })
    );
    return updatedBooking;
  };

  const mergeBookings = useCallback((newBookings: Partial<Omit<Booking, 'id'>>[]) => {
    setBookings(prevBookings => {
      const bookingsMap = new Map(prevBookings.map(b => [b.pnr.toLowerCase(), b]));
      
      newBookings.forEach(newBooking => {
        if (!newBooking.pnr) return; // Skip records without a PNR

        const pnr = newBooking.pnr.toLowerCase();
        const existingBooking = bookingsMap.get(pnr);
        
        if (existingBooking) {
          // Update existing booking with new, non-empty values
          const updates = { ...newBooking };
          if (updates.status && !isValidStatus(updates.status)) {
            // If status from CSV is invalid, don't update it, keep existing.
            delete updates.status;
          }
          const updatedRecord: Booking = { ...existingBooking, ...updates };
          bookingsMap.set(pnr, updatedRecord);
        } else {
          // Add new booking with defaults for any missing fields
          // FIX: This was the location of the error. The original implementation was not
          // type-safe and could assign an invalid string to 'status', which likely caused the cryptic 'spread' error.
          // This implementation ensures the status is always a valid type.
          const newRecord: Booking = {
            id: `imported-${newBooking.pnr}`,
            passengerName: newBooking.passengerName || 'N/A',
            pnr: newBooking.pnr,
            email: newBooking.email || 'N/A',
            flightNumber: newBooking.flightNumber || 'N/A',
            origin: newBooking.origin || 'N/A',
            destination: newBooking.destination || 'N/A',
            flightDate: newBooking.flightDate || new Date().toISOString(),
            status: isValidStatus(newBooking.status) ? newBooking.status : 'Pending',
            notes: newBooking.notes || 'Imported via CSV.',
            // FIX: Removed redundant and unsafe spread operator. All properties from newBooking
            // are already handled with defaults and type checks above. Spreading it here
            // caused a type error by re-introducing a potentially invalid `status` string.
          };
          bookingsMap.set(pnr, newRecord);
        }
      });
      
      return Array.from(bookingsMap.values());
    });
  }, []);

  const value = {
    bookings,
    getBookingByPnr,
    addBooking,
    updateBooking,
    deleteBooking,
    addNoteToBooking,
    mergeBookings,
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
};