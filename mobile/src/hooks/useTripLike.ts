import { useState, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import NotificationService from '../utils/notificationService';

const useTripLike = (trip) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(trip.likes?.length || 0);
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (currentUser && trip.likes?.includes(currentUser.uid)) {
      setIsLiked(true);
    } else {
      setIsLiked(false);
    }
    setLikeCount(trip.likes?.length || 0);
  }, [currentUser, trip.likes]);

  const handleLike = async () => {
    if (!currentUser) return;

    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);

    try {
      const tripRef = firestore().collection('trips').doc(trip.id);

      if (!originalIsLiked) {
        await tripRef.update({
          likes: firestore.FieldValue.arrayUnion(currentUser.uid),
        });

        // Send like notification to trip owner (only when liking, not unliking)
        if (trip.userId && trip.userId !== currentUser.uid) {
          const likerName = currentUser.displayName || 'Someone';
          const tripTitle = trip.title || 'your trip';
          await NotificationService.onLike(currentUser.uid, likerName, trip.id, trip.userId, tripTitle);
        }
      } else {
        await tripRef.update({
          likes: firestore.FieldValue.arrayRemove(currentUser.uid),
        });
      }
    } catch {
      // Keep optimistic update even if Firestore fails
    }
  };

  return { isLiked, likeCount, handleLike };
};

export default useTripLike;
