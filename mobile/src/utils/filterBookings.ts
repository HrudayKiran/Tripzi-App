import { Booking } from '../types';

export const filterBookings = (bookings: Booking[], filter: string) => {
  const now = new Date();
  return bookings.filter(booking => {
    const startDate = new Date(booking.trip.start_date);
    const endDate = new Date(booking.trip.end_date);

    if (filter === 'upcoming') {
      return startDate > now && booking.status !== 'cancelled';
    } else if (filter === 'active') {
      return startDate <= now && endDate >= now && booking.status !== 'cancelled';
    } else if (filter === 'completed') {
      return endDate < now || booking.status === 'cancelled';
    }
    return false;
  });
};
