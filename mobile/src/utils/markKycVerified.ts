// Run this in your app's console or create a one-time screen to execute
// This script marks a user as KYC verified

import firestore from '@react-native-firebase/firestore';

export const markUserKycVerified = async (email: string) => {
    try {
        // Find user by email
        const usersSnapshot = await firestore()
            .collection('users')
            .where('email', '==', email)
            .get();

        if (usersSnapshot.empty) {
            console.log('User not found with email:', email);
            return false;
        }

        const userDoc = usersSnapshot.docs[0];

        // Update KYC status
        await firestore().collection('users').doc(userDoc.id).update({
            kycStatus: 'verified',
            kyc: {
                status: 'verified',
                verifiedAt: firestore.FieldValue.serverTimestamp(),
                verifiedBy: 'admin',
            },
        });

        console.log('User KYC verified successfully:', email);
        return true;
    } catch (error) {
        console.error('Error verifying KYC:', error);
        return false;
    }
};

// To use: markUserKycVerified('webbusinesswithkiran@gmail.com');
