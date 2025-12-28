import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';

// Sample trips for when Firestore is unavailable
const FALLBACK_TRIPS = [
    {
        id: 'fallback1',
        title: 'Ladakh Bike Adventure',
        location: 'Leh, Ladakh',
        description: 'Experience the thrill of riding through the highest motorable road. Join us for an epic 7-day adventure across Khardung La and Pangong Lake.',
        coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        tripType: 'Adventure',
        duration: '7 days',
        cost: 25000,
        maxTravelers: 8,
        currentTravelers: 3,
        transportMode: 'bike',
        places: 'Leh, Nubra, Pangong',
        genderPreference: 'anyone',
        likes: [],
        userId: 'testuser001',
        user: { displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' },
    },
    {
        id: 'fallback2',
        title: 'Kerala Backwaters Escape',
        location: 'Alleppey, Kerala',
        description: 'Relax on a traditional houseboat cruise through the serene backwaters of Kerala. Sunrise yoga, fresh seafood, and peaceful vibes.',
        coverImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
        tripType: 'Relaxation',
        duration: '4 days',
        cost: 15000,
        maxTravelers: 6,
        currentTravelers: 2,
        transportMode: 'mixed',
        places: 'Kochi, Alleppey, Munnar',
        genderPreference: 'anyone',
        likes: [],
        userId: 'testuser001',
        user: { displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' },
    },
    {
        id: 'fallback3',
        title: 'Goa Beach Party Trip',
        location: 'Goa',
        description: 'Sun, sand, and surf! Join our Goa trip with beach parties, water sports, and amazing nightlife. Perfect for young travelers!',
        coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
        tripType: 'Party',
        duration: '5 days',
        cost: 12000,
        maxTravelers: 10,
        currentTravelers: 5,
        transportMode: 'flight',
        places: 'North Goa, South Goa',
        genderPreference: 'anyone',
        likes: [],
        userId: 'testuser001',
        user: { displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' },
    },
    {
        id: 'fallback4',
        title: 'Himachal Snow Trek',
        location: 'Manali, Himachal Pradesh',
        description: 'Trek through snow-covered trails and experience the magic of the Himalayas. Camping under the stars and bonfires included!',
        coverImage: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800&q=80',
        tripType: 'Trek',
        duration: '6 days',
        cost: 18000,
        maxTravelers: 12,
        currentTravelers: 4,
        transportMode: 'bus',
        places: 'Manali, Solang, Sissu',
        genderPreference: 'anyone',
        likes: [],
        userId: 'testuser001',
        user: { displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' },
    },
    {
        id: 'fallback5',
        title: 'Rajasthan Heritage Tour',
        location: 'Jaipur, Rajasthan',
        description: 'Explore the royal heritage of Rajasthan - majestic forts, colorful bazaars, and authentic Rajasthani cuisine.',
        coverImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80',
        tripType: 'Cultural',
        duration: '5 days',
        cost: 20000,
        maxTravelers: 8,
        currentTravelers: 3,
        transportMode: 'train',
        places: 'Jaipur, Udaipur, Jaisalmer',
        genderPreference: 'anyone',
        likes: [],
        userId: 'testuser001',
        user: { displayName: 'Travel Explorer', photoURL: 'https://randomuser.me/api/portraits/men/32.jpg' },
    },
];

const useTrips = () => {
    const [trips, setTrips] = useState(FALLBACK_TRIPS); // Start with fallback
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe = () => { };

        const loadTrips = async () => {
            try {
                // Try to subscribe to Firestore
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
                                setTrips(tripsData);
                            }
                            setLoading(false);
                        },
                        (error) => {
                            console.log('Firestore unavailable, using fallback:', error.message);
                            setLoading(false);
                            // Keep fallback data
                        }
                    );
            } catch (error) {
                console.log('Firestore connection error:', error);
                setLoading(false);
                // Keep fallback data
            }
        };

        // Small delay to let Firestore initialize
        setTimeout(loadTrips, 1000);

        return () => unsubscribe();
    }, []);

    return { trips, loading };
};

export default useTrips;
