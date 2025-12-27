
import { renderHook, act } from '@testing-library/react-hooks';
import useTripLike from '../useTripLike';
import firestore from '@react-native-firebase/firestore';

describe('useTripLike', () => {
  it('should return the initial state correctly', () => {
    const trip = { id: 'trip-1', likes: [] };
    const { result } = renderHook(() => useTripLike(trip));

    expect(result.current.isLiked).toBe(false);
    expect(result.current.likeCount).toBe(0);
  });

  it('should update the like state when handleLike is called', async () => {
    const trip = { id: 'trip-1', likes: [] };
    const { result, waitForNextUpdate } = renderHook(() => useTripLike(trip));

    const transactionMock = jest.fn().mockImplementation(async (callback) => {
        await callback({
            get: async () => ({
                exists: true,
                data: () => ({
                    likes: [],
                }),
            }),
            update: () => {},
        });
    });

    firestore().collection().doc().runTransaction = transactionMock;

    await act(async () => {
        result.current.handleLike();
        await waitForNextUpdate();
    });
    
    expect(result.current.isLiked).toBe(true);
    expect(result.current.likeCount).toBe(1);
    expect(transactionMock).toHaveBeenCalled();
  });
});
