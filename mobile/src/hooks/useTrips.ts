import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import { syncDatabase } from '../database/sync';
import Trip from '../database/models/Trip';
import Profile from '../database/models/Profile';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '../lib/supabase';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Maps a WatermelonDB Trip model instance to the flat object format
 * that TripCard, filterUtils, and other UI components expect.
 */
const mapTripToFeedFormat = (trip: Trip, profile?: Profile) => ({
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
        displayName: profile?.name || trip.ownerDisplayName || 'Traveler',
        photoURL: profile?.photoUrl || trip.ownerPhotoUrl || null,
        name: profile?.name || trip.ownerDisplayName || 'Traveler',
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

        // Observe trips and profiles together
        const tripsObservable = database.get<Trip>('trips')
            .query(Q.sortBy('created_at', Q.desc))
            .observe();

        const profilesObservable = database.get<Profile>('profiles')
            .query()
            .observe();

        const subscription = combineLatest([tripsObservable, profilesObservable]).pipe(
            map(([newTrips, newProfiles]) => {
                // Create a map of profiles for quick lookup
                const profilesMap = newProfiles.reduce((acc, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {} as Record<string, Profile>);

                const mappedAll = newTrips.map(t => mapTripToFeedFormat(t, profilesMap[t.userId]));
                
                // Filter for feed
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const feedTrips = mappedAll.filter((trip) => {
                    // CRITICAL: Always exclude current user's own trips from home feed
                    if (currentUserId && trip.userId === currentUserId) return false;

                    if (trip.isExpired || trip.isCancelled || trip.isCompleted) return false;
                    
                    const fromDate = trip.fromDate ? new Date(trip.fromDate) : null;
                    if (fromDate && fromDate < todayStart) return false;
                    
                    const participants = trip.participants?.length || trip.currentTravelers || 1;
                    const maxTravelers = trip.maxTravelers || 10;
                    return participants < maxTravelers;
                });

                return { mappedAll, feedTrips };
            })
        ).subscribe(({ mappedAll, feedTrips }) => {
            setAllTrips(mappedAll);
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
