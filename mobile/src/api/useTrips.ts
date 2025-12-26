import { useState, useEffect } from 'react';
import { Booking, Trip } from '../types';
import { GET_TRIPS_URL } from '../constants';

const useTrips = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);
      try {
        const response = await fetch(GET_TRIPS_URL);
        if (!response.ok) {
          throw new Error('Failed to fetch trips');
        }
        const data = await response.json();
        const trips: Trip[] = data.trips;

        const mappedBookings = trips.map((trip: Trip) => ({
          id: trip.id,
          status: 'confirmed',
          trip_id: trip.id,
          trip: trip,
        }));

        setBookings(mappedBookings);
      } catch (error) {
        // We can handle the error in the UI if needed
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, []);

  return { bookings, loading };
};

export default useTrips;
