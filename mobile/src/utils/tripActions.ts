import { workersApi } from '../lib/workersApi';
import * as Haptics from 'expo-haptics';
import { getBooleanPreference, getStringPreference, PREFERENCE_KEYS } from './preferences';

export const joinTrip = async (tripId: string) => {
    const result = await workersApi('/trips/join', { body: { tripId } });
    
    try {
        const hapticsEnabled = await getBooleanPreference(PREFERENCE_KEYS.hapticsEnabled, true);
        const joinTripHaptics = await getBooleanPreference(PREFERENCE_KEYS.hapticsJoinTrip, true);
        
        if (hapticsEnabled && joinTripHaptics) {
            const intensity = await getStringPreference(PREFERENCE_KEYS.hapticsIntensity, 'Medium');
            
            let style = Haptics.ImpactFeedbackStyle.Medium;
            if (intensity === 'Light') style = Haptics.ImpactFeedbackStyle.Light;
            if (intensity === 'Heavy') style = Haptics.ImpactFeedbackStyle.Heavy;
            
            await Haptics.impactAsync(style);
        }
    } catch (e) {
        console.error('Failed to trigger haptics:', e);
    }
    
    return result;
};

export const leaveTrip = async (tripId: string, reason: string) => {
    return workersApi('/trips/leave', { body: { tripId, reason } });
};

export const cancelTrip = async (tripId: string, reason: string) => {
    return workersApi('/trips/cancel', { body: { tripId, reason } });
};

export const deleteTrip = async (tripId: string, reason: string) => {
    return workersApi('/trips/delete', { body: { tripId, reason } });
};
