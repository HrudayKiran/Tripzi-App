import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';

export type KycStatus = 'loading' | 'none' | 'pending' | 'approved' | 'verified' | 'rejected';

interface UseKycGateReturn {
    kycStatus: KycStatus;
    isKycVerified: boolean;
    isLoading: boolean;
}

/**
 * Hook to check user's KYC verification status in real-time.
 * Returns current status and a boolean for easy conditional rendering.
 */
export function useKycGate(): UseKycGateReturn {
    const [kycStatus, setKycStatus] = useState<KycStatus>('loading');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setKycStatus('none');
            setIsLoading(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(userId)
            .onSnapshot(
                (doc) => {
                    const status = (doc.data()?.kycStatus as KycStatus) || 'none';
                    setKycStatus(status);
                    setIsLoading(false);
                },
                (error) => {
                    console.error('KYC status listener error:', error);
                    setKycStatus('none');
                    setIsLoading(false);
                }
            );

        return () => unsubscribe();
    }, []);

    return {
        kycStatus,
        isKycVerified: kycStatus === 'approved' || kycStatus === 'verified',
        isLoading,
    };
}

export default useKycGate;
