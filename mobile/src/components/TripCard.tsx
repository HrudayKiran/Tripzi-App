
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share } from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Animatable from 'react-native-animatable';

const TripCard = ({ trip, navigation, cardStyle }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(trip.likes?.length || 0);
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (currentUser && trip.likes?.includes(currentUser.uid)) {
      setIsLiked(true);
    }
  }, [currentUser, trip.likes]);

  const handleLike = async () => {
    if (!currentUser) return;

    const tripRef = firestore().collection('trips').doc(trip.id);
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);

    try {
      await firestore().runTransaction(async (transaction) => {
        const tripDoc = await transaction.get(tripRef);
        if (!tripDoc.exists) throw 'Trip does not exist!';

        const currentLikes = tripDoc.data().likes || [];
        const updatedLikes = isLiked 
            ? currentLikes.filter(uid => uid !== currentUser.uid)
            : [...currentLikes, currentUser.uid];
        
        transaction.update(tripRef, { likes: updatedLikes });
      });
    } catch (error) {
      console.error('Error updating likes: ', error);
      setIsLiked(!isLiked);
      setLikeCount(prev => isLiked ? prev + 1 : prev - 1);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this trip to ${trip.location}! It looks amazing.`,
      });
    } catch (error) {
      alert(error.message);
    }
  };

  const individualCost = trip.totalCost && trip.maxTravelers ? (trip.totalCost / trip.maxTravelers).toFixed(2) : 'N/A';

  return (
    <Animatable.View animation="fadeInUp" style={[styles.card, cardStyle]}>
        <TouchableOpacity onPress={() => navigation.navigate('TripDetails', { tripId: trip.id })}>
            <Image style={styles.cardImage} source={{ uri: trip.coverImage || 'https://picsum.photos/seed/trip/400/300'}} />
            <View style={styles.tripTypeBadge}>
                <Text style={styles.tripTypeText}>{trip.tripType}</Text>
            </View>
            
            <View style={styles.cardContent}>
                <Text style={styles.title}>{trip.title}</Text>
                <View style={styles.locationContainer}>
                    <Ionicons name="location-sharp" size={16} color="#8A2BE2" />
                    <Text style={styles.location}>{trip.location}</Text>
                </View>
                <View style={styles.detailsContainer}>
                    <Text style={styles.detailText}>{trip.duration}</Text>
                    <Text style={styles.detailText}>${individualCost}/person</Text>
                </View>
            </View>
        </TouchableOpacity>
        
        <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.userContainer} onPress={() => navigation.navigate('Profile', { userId: trip.userId })}>
                <Image style={styles.userImage} source={{ uri: trip.user?.image }} />
                <Text style={styles.userName}>{trip.user?.name}</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
                <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? '#ff6b6b' : '#333'} />
                    <Text style={styles.actionText}>{likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                    <Ionicons name="share-social-outline" size={24} color="#333" />
                </TouchableOpacity>
            </View>
        </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    cardImage: {
        width: '100%',
        height: 180,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
    },
    tripTypeBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    tripTypeText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    cardContent: {
        padding: 15,
    },
    title: {
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 5,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    location: {
        fontSize: 14,
        color: '#666',
        marginLeft: 5,
    },
    detailsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    userContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userImage: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
    },
    userName: {
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 15,
    },
    actionText: {
        marginLeft: 5,
        color: '#333',
    },
});

export default TripCard;
