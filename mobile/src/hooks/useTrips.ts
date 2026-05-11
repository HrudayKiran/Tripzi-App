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

const DEBUG_SHOW_OWN_TRIPS = false; // Toggle this to true to verify sync pulls own trips locally

const useTrips = () => {
    const [trips, setTrips] = useState<any[]>([]);
    const [allTrips, setAllTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);

    // Get the current user ID on mount
    useEffect(() => {
        console.log('[useTrips] Fetching current user session...');
        supabase.auth.getUser().then(({ data: { user } }) => {
            console.log(`[useTrips] Session loaded. User ID: ${user?.id || 'null'}`);
            setCurrentUserId(user?.id || null);
        });
    }, []);

    const refetch = useCallback(async () => {
        console.log('[useTrips] Manual refetch requested.');
        setLoading(true);
        try {
            await syncDatabase();
        } catch (error) {
            console.error('[useTrips] Refetch sync failed:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUserId === undefined) return; // Wait until user ID is fetched

        console.log('[useTrips] Initializing trip observers.');
        setLoading(true);

        // Observe trips and profiles together
        const tripsObservable = database.get<Trip>('trips')
            .query(
                Q.sortBy('created_at', Q.desc),
                Q.take(50)
            )
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
                return mappedAll;
            })
        ).subscribe((mappedAll) => {
            console.log(`[useTrips] UI update: ${mappedAll.length} total synced trips.`);
            setAllTrips(mappedAll);
            setTrips(mappedAll); // FeedScreen will apply filters via filterUtils
            setLoading(false);
        });

        // Initial sync - only trigger if we have a user (or we're pulling public trips)
        // Note: Even if no user, syncDatabase will pull public trips/profiles.
        console.log('[useTrips] Triggering initial database sync.');
        syncDatabase().catch((err) => {
            console.error('[useTrips] Initial sync failed:', err);
        });

        return () => {
            console.log('[useTrips] Cleaning up observers.');
            subscription.unsubscribe();
        };
    }, [currentUserId]);

    return { trips, allTrips, loading, refetch, currentUserId };
};

export default useTrips;
