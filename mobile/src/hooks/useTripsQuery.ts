import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

export function useTripsQuery() {
    const queryClient = useQueryClient();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUserId(user?.id || null);
        });
    }, []);

    const { data: trips = [], isLoading: loading, error, refetch } = useQuery({
        queryKey: ['trips'],
        queryFn: async () => {
            console.log('[useTripsQuery] Fetching trips from Supabase...');
            const { data: tripsData, error: tripsError } = await supabase
                .from('trips')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (tripsError) {
                console.error('[useTripsQuery] Error fetching trips:', tripsError);
                throw tripsError;
            }

            const userIds = (tripsData || []).map((t: any) => t.user_id).filter(Boolean);
            const { data: profilesData } = await supabase
                .from('public_profiles')
                .select('id, name, photo_url')
                .in('id', userIds);

            const profilesMap = (profilesData || []).reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
            }, {});

            const data = (tripsData || []).map((trip: any) => ({
                ...trip,
                user: profilesMap[trip.user_id] || null
            }));

            console.log(`[useTripsQuery] Fetched ${data?.length || 0} trips.`);

            // Map to the format TripCard expects
            return (data || []).map((trip: any) => ({
                id: trip.id,
                userId: trip.userId || trip.user_id,
                title: trip.title,
                description: trip.description,
                location: trip.location,
                fromLocation: trip.from_location || trip.location,
                toLocation: trip.to_location || trip.location,
                fromDate: trip.from_date,
                toDate: trip.to_date,
                maxTravelers: trip.max_travelers,
                currentTravelers: trip.current_travelers,
                genderPreference: trip.gender_preference,
                status: trip.status,
                tripType: trip.trip_type,
                transportMode: trip.transport_mode,
                accommodationType: trip.accommodation_type,
                durationDays: trip.duration_days,
                bookingStatus: trip.booking_status,
                isExpired: trip.is_expired,
                isCancelled: trip.is_cancelled,
                isCompleted: trip.is_completed,
                cost: trip.cost,
                coverImage: trip.cover_image,
                images: trip.images,
                participants: trip.participants || [],
                placesToVisit: trip.places_to_visit || [],
                mandatoryItems: trip.mandatory_items || [],
                ownerDisplayName: trip.user?.name || 'Traveler',
                ownerPhotoUrl: trip.user?.photo_url || null,
                createdAt: trip.created_at,
                updatedAt: trip.updated_at,
                user: {
                    displayName: trip.user?.name || 'Traveler',
                    photoURL: trip.user?.photo_url || null,
                    name: trip.user?.name || 'Traveler',
                    uid: trip.userId || trip.user_id,
                },
            }));
        },
    });

    return { trips, allTrips: trips, loading, refetch, currentUserId };
}

export default useTripsQuery;
