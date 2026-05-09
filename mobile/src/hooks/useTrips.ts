import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import { syncDatabase } from '../database/sync';
import Trip from '../database/models/Trip';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '../lib/supabase';

/**
 * Maps a WatermelonDB Trip model instance to the flat object format
 * that TripCard, filterUtils, and other UI components expect.
 */
const mapTripToFeedFormat = (trip: Trip) => ({
    id: trip.id,
    userId: trip.userId,
    title: trip.title,
    description: trip.description,
    location: trip.location,
    fromLocation: trip.location, // WatermelonDB model doesn't have from_location separately
    toLocation: trip.location,
    fromDate: trip.fromDate,
    toDate: trip.toDate,
    maxTravelers: trip.maxTravelers,
    currentTravelers: trip.currentTravelers,
    genderPreference: trip.genderPreference,
    status: trip.status,
    tripType: trip.tripType,
    transportMode: trip.transportMode,
    accommodationType: trip.accommodationType,
    durationDays: trip.durationDays,
    bookingStatus: trip.bookingStatus,
    isExpired: trip.isExpired,
    isCancelled: trip.isCancelled,
    isCompleted: trip.isCompleted,
    cost: trip.cost,
    coverImage: trip.coverImage,
    images: trip.images,
    participants: trip.participants,
    placesToVisit: trip.placesToVisit,
    mandatoryItems: trip.mandatoryItems,
    ownerDisplayName: trip.ownerDisplayName,
    ownerPhotoUrl: trip.ownerPhotoUrl,
    ownerUsername: trip.ownerUsername,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    // Map owner fields to the `user` object that TripCard expects
    user: {
        displayName: trip.ownerDisplayName || 'Traveler',
        photoURL: trip.ownerPhotoUrl || null,
        name: trip.ownerDisplayName || 'Traveler',
        uid: trip.userId,
    },
});

const useTrips = () => {
    const [trips, setTrips] = useState<any[]>([]);
    const [allTrips, setAllTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);

    // Get the current user ID on mount
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUserId(user?.id || null);
        });
    }, []);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            await syncDatabase();
        } catch (error) {
            // Sync failed
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUserId === undefined) return; // Wait until user ID is fetched

        setLoading(true);

        // Observe all trips
        const subscription = database.get<Trip>('trips')
            .query(Q.sortBy('created_at', Q.desc))
            .observe()
            .subscribe((newTrips) => {
                const mappedAll = newTrips.map(mapTripToFeedFormat);
                setAllTrips(mappedAll);

                // Filter for feed
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const feedTrips = mappedAll.filter((trip) => {
                    // CRITICAL: Always exclude current user's own trips from home feed
                    // This prevents "flickering" where own posts appear for a split second
                    if (currentUserId && trip.userId === currentUserId) return false;

                    if (trip.isExpired || trip.isCancelled || trip.isCompleted) return false;
                    
                    const fromDate = trip.fromDate ? new Date(trip.fromDate) : null;
                    if (fromDate && fromDate < todayStart) return false;
                    
                    const participants = trip.participants?.length || trip.currentTravelers || 1;
                    const maxTravelers = trip.maxTravelers || 10;
                    return participants < maxTravelers;
                });

                setTrips(feedTrips);
                setLoading(false);
            });

        // Initial sync
        syncDatabase().catch(() => { });

        return () => subscription.unsubscribe();
    }, [currentUserId]);

    return { trips, allTrips, loading, refetch, currentUserId };
};

export default useTrips;
