/**
 * Utility to setup test user and transfer trips
 * Run this function once from the app to:
 * 1. Create test user document in Firestore
 * 2. Transfer all trips from source account to test user
 */

import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';

// Test user credentials (for account switch)
// Email: testuser@tripzi.app
// Password: Test@123

const TEST_USER = {
    uid: 'test_user_priya_001', // This will be replaced with actual Firebase Auth UID
    displayName: 'Priya Sharma',
    email: 'testuser@tripzi.app',
    photoURL: 'https://randomuser.me/api/portraits/women/44.jpg',
    bio: '✨ Travel enthusiast | 🌍 25+ countries explored | 📸 Capturing moments | Adventure seeker & foodie 🍕',
    location: 'Mumbai, India',
    followers: 1247,
    following: 523,
    tripsCreated: 0,
    tripsJoined: 0,
    kycStatus: 'verified',
    createdAt: firestore.FieldValue.serverTimestamp(),
};

// Source account to transfer trips FROM
const SOURCE_EMAIL = 'webbusinesswithkiran@gmail.com';

export const setupTestUser = async (testUserUid: string) => {
    try {
        console.log('🚀 Starting test user setup...');

        // 1. Create or update test user document
        console.log('📝 Creating test user profile...');
        await firestore().collection('users').doc(testUserUid).set({
            ...TEST_USER,
            uid: testUserUid,
        }, { merge: true });
        console.log('✅ Test user profile created: Priya Sharma');

        // 2. Find source user
        console.log('🔍 Finding source account...');
        const usersSnapshot = await firestore()
            .collection('users')
            .where('email', '==', SOURCE_EMAIL)
            .get();

        if (usersSnapshot.empty) {
            console.log('⚠️ Source account not found, skipping trip transfer');
            Alert.alert('✅ Test User Created', 'Priya Sharma profile created.\n\nNo trips found to transfer.');
            return;
        }

        const sourceUser = usersSnapshot.docs[0];
        const sourceUid = sourceUser.id;
        console.log('✅ Found source account:', sourceUid);

        // 3. Find all trips created by source user
        console.log('🔍 Finding trips to transfer...');
        const tripsSnapshot = await firestore()
            .collection('trips')
            .where('userId', '==', sourceUid)
            .get();

        console.log(`📦 Found ${tripsSnapshot.docs.length} trips to transfer`);

        // 4. Transfer each trip to test user
        const batch = firestore().batch();
        let transferCount = 0;

        for (const tripDoc of tripsSnapshot.docs) {
            batch.update(tripDoc.ref, {
                userId: testUserUid,
                user: {
                    displayName: TEST_USER.displayName,
                    photoURL: TEST_USER.photoURL,
                    name: TEST_USER.displayName,
                    image: TEST_USER.photoURL,
                },
            });
            transferCount++;
        }

        if (transferCount > 0) {
            await batch.commit();
            console.log(`✅ Transferred ${transferCount} trips to Priya Sharma`);
        }

        // 5. Update trip counts
        await firestore().collection('users').doc(testUserUid).update({
            tripsCreated: transferCount,
        });

        Alert.alert(
            '✅ Setup Complete!',
            `Test user "Priya Sharma" created.\n\n${transferCount} trips transferred from your account.\n\nYou can now:\n• See her posts on Home\n• Like, comment, follow\n• Chat with her\n• Test notifications`,
            [{ text: 'Great!' }]
        );

        console.log('🎉 Test user setup complete!');
        return { success: true, tripsTransferred: transferCount };
    } catch (error) {
        console.error('❌ Setup failed:', error);
        Alert.alert('Setup Failed', error.message);
        return { success: false, error };
    }
};

export default setupTestUser;
