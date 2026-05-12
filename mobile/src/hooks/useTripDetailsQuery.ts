import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export function useTripDetailsQuery(tripId: string | undefined) {
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserId(user?.id || null);
        });
    }, []);

    const { data: trip, isLoading: loading, error, refetch } = useQuery({
        queryKey: ['trip', tripId],
        queryFn: async () => {
            if (!tripId) return null;

            console.log(`[useTripDetailsQuery] Fetching trip ${tripId} from Supabase...`);
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .maybeSingle();

            if (error) {
                console.error('[useTripDetailsQuery] Error fetching trip:', error);
                throw error;
            }

            if (!data) return null;

            // Normalize snake_case to camelCase for UI compatibility
            const tripData: any = { ...data };
            tripData.userId = tripData.user_id || tripData.userId;
            tripData.coverImage = tripData.cover_image || tripData.coverImage;
            tripData.toLocation = tripData.to_location || tripData.toLocation;
            tripData.fromLocation = tripData.from_location || tripData.fromLocation;
            tripData.maxTravelers = tripData.max_travelers || tripData.maxTravelers;
            tripData.costPerPerson = tripData.cost_per_person || tripData.costPerPerson;
            tripData.tripTypes = tripData.trip_types || tripData.tripTypes;
            tripData.transportModes = tripData.transport_modes || tripData.transportModes;
            tripData.fromDate = tripData.from_date || tripData.fromDate;
            tripData.toDate = tripData.to_date || tripData.toDate;
            tripData.accommodationType = tripData.accommodation_type || tripData.accommodationType;
            tripData.accommodationDays = tripData.accommodation_days || tripData.accommodationDays;
            tripData.bookingStatus = tripData.booking_status || tripData.bookingStatus;
            tripData.genderPreference = tripData.gender_preference || tripData.genderPreference;
            tripData.mandatoryItems = tripData.mandatory_items || tripData.mandatoryItems;
            tripData.placesToVisit = tripData.places_to_visit || tripData.placesToVisit;
            tripData.imageLocations = tripData.image_locations || tripData.imageLocations;

            if (tripData.userId) {
                const { data: profile } = await supabase
                    .from('public_profiles')
                    .select('*')
                    .eq('id', tripData.userId)
                    .maybeSingle();

                if (profile) {
                    tripData.user = {
                        ...profile,
                        displayName: profile.display_name || profile.name,
                        photoURL: profile.photo_url,
                        uid: tripData.userId,
                    };
                }
            }

            return tripData;
        },
        enabled: !!tripId,
    });

    // Realtime subscription
    useEffect(() => {
        if (!tripId) return;

        const channel = supabase
            .channel(`trip-details-query-${tripId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tripId, queryClient]);

    return { trip, loading, error, refetch, userId };
}

export default useTripDetailsQuery;
