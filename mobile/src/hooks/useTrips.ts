import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const useTrips = () => {
    const [trips, setTrips] = useState([]); // Start empty, no fallback
    const [allTrips, setAllTrips] = useState([]); // Keep all trips for other uses
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const ownerCacheRef = useRef<Map<string, any>>(new Map());

    // Refetch function to manually trigger a refresh
    const refetch = useCallback(() => {
        setLoading(true);
        setRefreshKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        let unsubscribe = () => { };

        const loadTrips = async () => {
            try {
                const currentUser = auth().currentUser;

                // Subscribe to Firestore
                unsubscribe = firestore()
                    .collection('trips')
                    .orderBy('createdAt', 'desc')
                    .limit(80)
                    .onSnapshot(
                        async (querySnapshot) => {
                            if (querySnapshot && querySnapshot.docs.length > 0) {
                                const tripsData = querySnapshot.docs.map((doc) => {
                                    const trip = { id: doc.id, ...doc.data() } as any;
                                    if (trip.userId && (trip.ownerDisplayName || trip.ownerPhotoURL || trip.ownerUsername)) {
                                        trip.user = {
                                            id: trip.userId,
                                            displayName: trip.ownerDisplayName || 'Traveler',
                                            photoURL: trip.ownerPhotoURL || null,
                                            username: trip.ownerUsername || null,
                                        };
                                    }
                                    return trip;
                                });

                                const missingOwnerIds = Array.from(
                                    new Set(
                                        tripsData
                                            .filter((trip: any) => trip.userId && !trip.user)
                                            .map((trip: any) => trip.userId)
                                    )
                                ).filter((uid: string) => !ownerCacheRef.current.has(uid));

                                if (missingOwnerIds.length > 0) {
                                    const chunkSize = 10;
                                    const ownerChunks = Array.from(
                                        { length: Math.ceil(missingOwnerIds.length / chunkSize) },
                                        (_, i) => missingOwnerIds.slice(i * chunkSize, i * chunkSize + chunkSize)
                                    );

                                    await Promise.all(ownerChunks.map(async (chunk) => {
                                        if (chunk.length === 0) return;
                                        const usersSnapshot = await firestore()
                                            .collection('public_users')
                                            .where(firestore.FieldPath.documentId(), 'in', chunk)
                                            .get();

                                        usersSnapshot.docs.forEach((userDoc) => {
                                            ownerCacheRef.current.set(userDoc.id, { id: userDoc.id, ...userDoc.data() });
                                        });
                                    }));
                                }

                                tripsData.forEach((trip: any) => {
                                    if (trip.user || !trip.userId) return;
                                    const cachedOwner = ownerCacheRef.current.get(trip.userId);
                                    if (cachedOwner) {
                                        trip.user = cachedOwner;
                                    } else {
                                        trip.user = { id: trip.userId, displayName: 'Unknown Traveler', photoURL: null };
                                    }
                                });

                                // Store all trips (for profile pages etc.)
                                setAllTrips(tripsData);

                                // For home feed: Filter out current user's trips AND full trips
                                const feedTrips = tripsData.filter(trip => {
                                    // Exclude current user's trips
                                    if (currentUser && trip.userId === currentUser.uid) {
                                        return false;
                                    }
                                    // Exclude full trips
                                    const participants = trip.participants?.length || trip.currentTravelers || 1;
                                    const maxTravelers = trip.maxTravelers || 10;
                                    return participants < maxTravelers;
                                });

                                setTrips(feedTrips);
                            } else {
                                // No trips in database
                                setTrips([]);
                                setAllTrips([]);
                            }
                            setLoading(false);
                        },
                        (error) => {
                            setLoading(false);
                            // No fallback - just show empty
                            setTrips([]);
                        }
                    );
            } catch {
                setLoading(false);
                setTrips([]);
            }
        };

        // Small delay to let Firestore initialize
        setTimeout(loadTrips, 500);

        return () => unsubscribe();
    }, [refreshKey]);

    return { trips, allTrips, loading, refetch };
};

export default useTrips;
