import { workersApi } from '../lib/workersApi';

export const joinTrip = async (tripId: string) => {
    return workersApi('/trips/join', { body: { tripId } });
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

export const rateTrip = async (
    tripId: string,
    rating: number,
    feedback: string
) => {
    return workersApi('/trips/rate', { body: { tripId, rating, feedback } });
};
