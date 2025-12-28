// Firestore Data Seeding Script
// Run this once to populate the database with test data

import firestore from '@react-native-firebase/firestore';

// Test User Data
const TEST_USER = {
    uid: 'testuser001',
    displayName: 'Travel Explorer',
    email: 'explorer@tripzi.com',
    photoURL: 'https://randomuser.me/api/portraits/men/32.jpg',
    phone: '+91 9876543210',
    bio: 'Passionate traveler | 50+ trips | Love mountains & beaches 🏔️🏖️',
    kycStatus: 'verified',
    kycVerifiedAt: firestore.FieldValue.serverTimestamp(),
    followers: [],
    following: [],
    tripsCount: 5,
    createdAt: firestore.FieldValue.serverTimestamp(),
};

// Sample Trips by Test User
const SAMPLE_TRIPS = [
    {
        title: 'Ladakh Bike Adventure',
        location: 'Leh, Ladakh',
        description: 'Experience the thrill of riding through the highest motorable road. Join us for an epic 7-day adventure across Khardung La and Pangong Lake. All skill levels welcome!',
        coverImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        tripType: 'Adventure',
        duration: '7 days',
        startDate: '2025-02-15',
        endDate: '2025-02-22',
        cost: 25000,
        maxTravelers: 8,
        currentTravelers: 3,
        transportMode: 'bike',
        places: 'Leh, Nubra Valley, Pangong Lake, Khardung La',
        genderPreference: 'anyone',
        whatToExpect: 'Bike riding, Camping, Photography, Local food',
        included: 'Bike rental, Accommodation, Meals, Guide',
        notIncluded: 'Personal expenses, Travel insurance',
        likes: [],
        comments: [],
        participants: [],
        userId: 'testuser001',
        createdAt: firestore.FieldValue.serverTimestamp(),
    },
    {
        title: 'Kerala Backwaters Escape',
        location: 'Alleppey, Kerala',
        description: 'Relax on a traditional houseboat cruise through the serene backwaters of Kerala. Sunrise yoga, fresh seafood, and peaceful vibes. Perfect for unwinding!',
        coverImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
        tripType: 'Relaxation',
        duration: '4 days',
        startDate: '2025-01-20',
        endDate: '2025-01-24',
        cost: 15000,
        maxTravelers: 6,
        currentTravelers: 2,
        transportMode: 'mixed',
        places: 'Kochi, Alleppey, Kumarakom, Munnar',
        genderPreference: 'anyone',
        whatToExpect: 'Houseboat stay, Yoga, Ayurveda spa, Beach time',
        included: 'Houseboat, All meals, Airport transfer',
        notIncluded: 'Flights, Personal expenses',
        likes: [],
        comments: [],
        participants: [],
        userId: 'testuser001',
        createdAt: firestore.FieldValue.serverTimestamp(),
    },
    {
        title: 'Goa Beach Party Trip',
        location: 'Goa',
        description: 'Sun, sand, and surf! Join our Goa trip with beach parties, water sports, and amazing nightlife. Perfect for young travelers looking for fun!',
        coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
        tripType: 'Party',
        duration: '5 days',
        startDate: '2025-01-10',
        endDate: '2025-01-15',
        cost: 12000,
        maxTravelers: 10,
        currentTravelers: 5,
        transportMode: 'flight',
        places: 'North Goa - Baga, Calangute, Anjuna, Vagator',
        genderPreference: 'anyone',
        whatToExpect: 'Beach parties, Water sports, Nightlife, Scooter rides',
        included: 'Hostel stay, Scooter rental, Party passes',
        notIncluded: 'Flights, Food, Drinks',
        likes: [],
        comments: [],
        participants: [],
        userId: 'testuser001',
        createdAt: firestore.FieldValue.serverTimestamp(),
    },
    {
        title: 'Himachal Snow Trek',
        location: 'Manali, Himachal Pradesh',
        description: 'Trek through snow-covered trails and experience the magic of the Himalayas. Camping under the stars and bonfires included! Beginner friendly.',
        coverImage: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800&q=80',
        tripType: 'Trek',
        duration: '6 days',
        startDate: '2025-03-01',
        endDate: '2025-03-07',
        cost: 18000,
        maxTravelers: 12,
        currentTravelers: 4,
        transportMode: 'bus',
        places: 'Manali, Solang Valley, Sissu, Rohtang',
        genderPreference: 'anyone',
        whatToExpect: 'Trekking, Camping, Bonfire, Snow activities',
        included: 'Camping gear, All meals, Guide, Permits',
        notIncluded: 'Transport to Manali, Winter gear',
        likes: [],
        comments: [],
        participants: [],
        userId: 'testuser001',
        createdAt: firestore.FieldValue.serverTimestamp(),
    },
    {
        title: 'Rajasthan Heritage Tour',
        location: 'Jaipur, Rajasthan',
        description: 'Explore the royal heritage of Rajasthan - majestic forts, colorful bazaars, and authentic Rajasthani cuisine. A cultural journey like no other!',
        coverImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80',
        tripType: 'Cultural',
        duration: '5 days',
        startDate: '2025-02-01',
        endDate: '2025-02-06',
        cost: 20000,
        maxTravelers: 8,
        currentTravelers: 3,
        transportMode: 'train',
        places: 'Jaipur, Jodhpur, Udaipur, Jaisalmer',
        genderPreference: 'anyone',
        whatToExpect: 'Fort visits, Desert safari, Palace tours, Shopping',
        included: 'Hotels, Train tickets, Breakfast, Guide',
        notIncluded: 'Lunch, Dinner, Entry tickets',
        likes: [],
        comments: [],
        participants: [],
        userId: 'testuser001',
        createdAt: firestore.FieldValue.serverTimestamp(),
    },
];

export const seedFirestoreData = async () => {
    try {
        console.log('🚀 Starting Firestore data seeding...');

        // Create test user
        console.log('👤 Creating test user...');
        await firestore().collection('users').doc(TEST_USER.uid).set(TEST_USER);
        console.log('✅ Test user created!');

        // Create sample trips
        console.log('📦 Creating sample trips...');
        for (const trip of SAMPLE_TRIPS) {
            await firestore().collection('trips').add(trip);
            console.log(`✅ Trip created: ${trip.title}`);
        }

        console.log('🎉 All data seeded successfully!');
        return true;
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        return false;
    }
};

export const checkAndSeedData = async () => {
    try {
        // Check if test user exists
        const userDoc = await firestore().collection('users').doc(TEST_USER.uid).get();
        if (!userDoc.exists) {
            console.log('📝 No data found, seeding...');
            await seedFirestoreData();
        } else {
            console.log('✅ Data already exists');
        }
    } catch (error) {
        console.error('Error checking data:', error);
    }
};
