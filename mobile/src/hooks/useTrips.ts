import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import { syncDatabase } from '../database/sync';
import Trip from '../database/models/Trip';
import { Q } from '@nozbe/watermelondb';

const useTrips = () => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            await syncDatabase();
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Observe all trips
        const subscription = database.get<Trip>('trips')
            .query(Q.sortBy('created_at', Q.desc))
            .observe()
            .subscribe((newTrips) => {
                setAllTrips(newTrips);

                // Filter for feed (same logic as before, but using Watermelon models)
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const feedTrips = newTrips.filter((trip) => {
                    // Note: In a real app, you'd get the current user ID from Supabase auth
                    // For now, we'll keep the filtering logic similar.
                    if (trip.isExpired || trip.isCancelled || trip.isCompleted) return false;
                    
                    const fromDate = trip.fromDate ? new Date(trip.fromDate) : null;
                    if (fromDate && fromDate < todayStart) return false;
                    
                    const participants = trip.currentTravelers || 1;
                    const maxTravelers = trip.maxTravelers || 10;
                    return participants < maxTravelers;
                });

                setTrips(feedTrips);
                setLoading(false);
            });

        // Initial sync
        syncDatabase().catch(console.error);

        return () => subscription.unsubscribe();
    }, []);

    return { trips, allTrips, loading, refetch };
};

export default useTrips;
