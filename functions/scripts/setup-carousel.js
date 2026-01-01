/**
 * Script to create the splash_carousel config in Firestore.
 * Uses free, high-quality travel images from Unsplash.
 * 
 * Usage: node scripts/setup-carousel.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!admin.apps.length) {
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id || 'tripzi-52736816-98c83',
            storageBucket: 'tripzi-52736816-98c83.appspot.com'
        });
        console.log(`Initialized Firebase Admin for project: ${serviceAccount.project_id}`);
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e.message);
        process.exit(1);
    }
}

const db = admin.firestore();
db.settings({ preferRest: true }); // Use REST for better connectivity

// Free, beautiful travel images from Unsplash (direct URLs)
const CAROUSEL_IMAGES = [
    {
        id: '1',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        title: 'Ladakh',
        subtitle: 'Ride through the mountains',
        location: 'Khardung La Pass',
    },
    {
        id: '2',
        image: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800&q=80',
        title: 'Himalayas',
        subtitle: 'Touch the clouds',
        location: 'Valley of Flowers',
    },
    {
        id: '3',
        image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
        title: 'Kerala',
        subtitle: 'Backwater paradise',
        location: 'Alleppey',
    },
    {
        id: '4',
        image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
        title: 'Goa',
        subtitle: 'Beach vibes',
        location: 'Palolem Beach',
    },
    {
        id: '5',
        image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80',
        title: 'Rajasthan',
        subtitle: 'Desert adventures',
        location: 'Jaisalmer',
    },
];

async function setupCarousel() {
    console.log('Setting up splash_carousel collection in Firestore...\n');

    try {
        const collectionName = 'splash_carousel';
        const batch = db.batch();

        // Add each carousel item as a separate document
        CAROUSEL_IMAGES.forEach(item => {
            // Use item.id as the document ID for easy ordering/retrieval
            const docRef = db.collection(collectionName).doc(item.id);
            batch.set(docRef, {
                ...item,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });

        // Commit the batch
        await batch.commit();

        console.log('✅ Carousel collection created successfully!');
        console.log(`   - ${CAROUSEL_IMAGES.length} documents added`);
        console.log(`   - Collection: ${collectionName}`);
        console.log('\nThe SplashScreen will now load these images from Firestore.');

    } catch (error) {
        console.error('❌ Error creating carousel collection:', error.message);
        if (error.code === 5) {
            console.log('\n⚠️  Database connection issue. Check your Firestore settings.');
        }
    }
}

setupCarousel()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
