import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface UseAgeGateReturn {
    isAgeVerified: boolean;
    isLoading: boolean;
    dateOfBirth: Date | null;
    age: number | null;
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
 * Hook to check user's age verification status in real-time.
 * For v1.0.0: Simple age verification (18+ required)
 * Returns whether user is age verified and loading state.
 */
export function useAgeGate(): UseAgeGateReturn {
    const [isLoading, setIsLoading] = useState(true);
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [isAgeVerified, setIsAgeVerified] = useState(false);
    const [age, setAge] = useState<number | null>(null);

    useEffect(() => {
        const userId = auth().currentUser?.uid;
        if (!userId) {
            setIsAgeVerified(false);
            setIsLoading(false);
            return;
        }

        const unsubscribe = firestore()
            .collection('users')
            .doc(userId)
            .onSnapshot(
                (doc) => {
                    const data = doc.data();

                    // Check ageVerified boolean first (new field)
                    if (data?.ageVerified === true) {
                        setIsAgeVerified(true);
                        if (data?.dateOfBirth) {
                            const dob = data.dateOfBirth.toDate ? data.dateOfBirth.toDate() : new Date(data.dateOfBirth);
                            setDateOfBirth(dob);
                            setAge(calculateAge(dob));
                        }
                    }
                    // Fallback: Check dateOfBirth and calculate age
                    else if (data?.dateOfBirth) {
                        const dob = data.dateOfBirth.toDate ? data.dateOfBirth.toDate() : new Date(data.dateOfBirth);
                        setDateOfBirth(dob);
                        const calculatedAge = calculateAge(dob);
                        setAge(calculatedAge);
                        setIsAgeVerified(calculatedAge >= 18);
                    } else {
                        setDateOfBirth(null);
                        setAge(null);
                        setIsAgeVerified(false);
                    }

                    setIsLoading(false);
                },
                (error) => {
                    
                    setIsAgeVerified(false);
                    setIsLoading(false);
                }
            );

        return () => unsubscribe();
    }, []);

    return {
        isAgeVerified,
        isLoading,
        dateOfBirth,
        age,
    };
}

export default useAgeGate;
