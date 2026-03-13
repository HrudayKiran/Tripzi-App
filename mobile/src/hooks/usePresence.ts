import { useEffect } from 'react';
import { AppState } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const writePresence = async (presence: 'online' | 'background' | 'offline') => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    try {
        const payload = {
            presence,
            lastSeenAt: firestore.FieldValue.serverTimestamp(),
            lastSeen: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
        };

        await Promise.all([
            firestore().collection('users').doc(uid).set(payload, { merge: true }),
            firestore().collection('public_users').doc(uid).set(payload, { merge: true }),
        ]);
    } catch {
        // Presence writes should not interrupt app usage.
    }
};

export const usePresence = () => {
    useEffect(() => {
        writePresence('online');

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                writePresence('online');
                return;
            }

            if (nextState === 'background' || nextState === 'inactive') {
                writePresence('background');
            }
        });

        return () => {
            subscription.remove();
            writePresence('offline');
        };
    }, []);
};

export default usePresence;
