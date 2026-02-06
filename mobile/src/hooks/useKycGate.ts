import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export type KycStatus = 'loading' | 'none' | 'pending' | 'approved' | 'verified' | 'rejected';

interface UseKycGateReturn {
    kycStatus: KycStatus;
    isKycVerified: boolean;
    isAgeVerified: boolean;
    isLoading: boolean;
    dateOfBirth: Date | null;
}

/**
 * Calculates age from a date of birth
 */
const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
};

/**
 * Hook to check user's KYC verification status and age in real-time.
 * Returns current status, age verification, and booleans for easy conditional rendering.
 */
export function useKycGate(): UseKycGateReturn {
    const [kycStatus, setKycStatus] = useState<KycStatus>('loading');
    const [isLoading, setIsLoading] = useState(true);
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [isAgeVerified, setIsAgeVerified] = useState(false);

    useEffect(() => {
        const userId = auth().currentUser?.uid;
        if (!userId) {
            setKycStatus('none');
            setIsLoading(false);
            setIsAgeVerified(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(userId)
            .onSnapshot(
                (doc) => {
                    const data = doc.data();
                    const status = (data?.kycStatus as KycStatus) || 'none';
                    setKycStatus(status);

                    // Check date of birth for age verification
                    if (data?.dateOfBirth) {
                        const dob = data.dateOfBirth.toDate ? data.dateOfBirth.toDate() : new Date(data.dateOfBirth);
                        setDateOfBirth(dob);
                        const age = calculateAge(dob);
                        // Age verified if 18+ AND KYC approved/verified
                        setIsAgeVerified(age >= 18 && (status === 'approved' || status === 'verified'));
                    } else {
                        setDateOfBirth(null);
                        setIsAgeVerified(false);
                    }

                    setIsLoading(false);
                },
                (error) => {
                    console.error('KYC status listener error:', error);
                    setKycStatus('none');
                    setIsAgeVerified(false);
                    setIsLoading(false);
                }
            );

        return () => unsubscribe();
    }, []);

    return {
        kycStatus,
        isKycVerified: kycStatus === 'approved' || kycStatus === 'verified',
        isAgeVerified,
        isLoading,
        dateOfBirth,
    };
}

export default useKycGate;
