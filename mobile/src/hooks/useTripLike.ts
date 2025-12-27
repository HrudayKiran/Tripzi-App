
import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import firestore from '@react-native-firebase/firestore';

const useTripLike = (trip) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(trip.likes?.length || 0);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser && trip.likes?.includes(currentUser.uid)) {
      setIsLiked(true);
    } else {
      setIsLiked(false);
    }
  }, [currentUser, trip.likes]);

  const handleLike = async () => {
    if (!currentUser) return;

    const tripRef = firestore().collection('trips').doc(trip.id);
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;

    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);

    try {
      await firestore().runTransaction(async (transaction) => {
        const tripDoc = await transaction.get(tripRef);
        if (!tripDoc.exists) throw 'Trip does not exist!';

        const currentLikes = tripDoc.data().likes || [];
        const updatedLikes = !originalIsLiked
            ? [...currentLikes, currentUser.uid]
            : currentLikes.filter(uid => uid !== currentUser.uid);
        
        transaction.update(tripRef, { likes: updatedLikes });
      });
    } catch (error) {
      console.error("Error liking trip: ", error);
      // Revert the state on error
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
    }
  };

  return { isLiked, likeCount, handleLike };
};

export default useTripLike;
