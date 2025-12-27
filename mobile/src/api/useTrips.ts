
import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';

const useTrips = () => {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firestore()
            .collection('trips')
            .onSnapshot(async (querySnapshot) => {
                const tripsData = await Promise.all(
                    querySnapshot.docs.map(async (doc) => {
                        const trip = { id: doc.id, ...doc.data() };
                        if (trip.userId) {
                            const userDoc = await firestore().collection('users').doc(trip.userId).get();
                            if (userDoc.exists) {
                                trip.user = userDoc.data();
                            }
                        }
                        return trip;
                    })
                );
                setTrips(tripsData);
                setLoading(false);
            });

        return () => unsubscribe();
    }, []);

    return { trips, loading };
};

export default useTrips;
