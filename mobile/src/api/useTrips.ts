import { useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';

const useTrips = () => {
    const [trips, setTrips] = useState([]); // Start empty, no fallback
    const [allTrips, setAllTrips] = useState([]); // Keep all trips for other uses
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Refetch function to manually trigger a refresh
    const refetch = useCallback(() => {
        setLoading(true);
        setRefreshKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        let unsubscribe = () => { };

        const loadTrips = async () => {
            try {
                const currentUser = auth.currentUser;

                // Subscribe to Firestore
                unsubscribe = firestore()
                    .collection('trips')
                    .orderBy('createdAt', 'desc')
                    .onSnapshot(
                        async (querySnapshot) => {
                            if (querySnapshot && querySnapshot.docs.length > 0) {
                                const tripsData = await Promise.all(
                                    querySnapshot.docs.map(async (doc) => {
                                        const trip = { id: doc.id, ...doc.data() };

                                        if (trip.userId) {
                                            try {
                                                const userDoc = await firestore()
                                                    .collection('users')
                                                    .doc(trip.userId)
                                                    .get();
                                                if (userDoc.exists) {
                                                    trip.user = { id: userDoc.id, ...userDoc.data() };
                                                }
                                            } catch (e) {
                                                // User fetch failed, use default
                                                trip.user = { displayName: 'Traveler', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' };
                                            }
                                        }
                                        return trip;
                                    })
                                );

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
