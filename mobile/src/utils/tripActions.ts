import functions from '@react-native-firebase/functions';

const callTripFunction = async <T = unknown>(
    name: 'joinTrip' | 'leaveTrip' | 'cancelTrip' | 'deleteTrip' | 'rateTrip',
    payload: Record<string, unknown>
): Promise<T> => {
    const callable = functions().httpsCallable(name);
    const result = await callable(payload);
    return (result?.data || {}) as T;
};

export const joinTrip = async (tripId: string) => {
    return callTripFunction('joinTrip', { tripId });
};

export const leaveTrip = async (tripId: string, reason: string) => {
    return callTripFunction('leaveTrip', { tripId, reason });
};

export const cancelTrip = async (tripId: string, reason: string) => {
    return callTripFunction('cancelTrip', { tripId, reason });
};

export const deleteTrip = async (tripId: string, reason: string) => {
    return callTripFunction('deleteTrip', { tripId, reason });
};

export const rateTrip = async (
    tripId: string,
    rating: number,
    feedback: string
) => {
    return callTripFunction('rateTrip', { tripId, rating, feedback });
};
