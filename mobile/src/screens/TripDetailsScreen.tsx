import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Dimensions, FlatList, Linking, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';

import DefaultAvatar from '../components/DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import NotificationService from '../utils/notificationService';
import ReportTripModal from '../components/ReportTripModal';
import { pickAndUploadImage } from '../utils/imageUpload';

const { width } = Dimensions.get('window');

// Unused constants removed

const TripDetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { tripId } = route.params;
  const user = auth().currentUser;

  // Rating states
  const [userRating, setUserRating] = useState(0);
  const [userFeedback, setUserFeedback] = useState('');
  const [existingRatings, setExistingRatings] = useState<any[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // Edit/Delete states
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(4 / 5);

  useEffect(() => {
    const firstMedia = trip?.images?.[0] || trip?.coverImage;
    if (firstMedia && typeof firstMedia === 'string' && firstMedia.startsWith('http')) {
      Image.getSize(firstMedia, (width, height) => {
        if (width && height) {
          const ratio = width / height;
          setMediaAspectRatio(Math.min(Math.max(ratio, 0.8), 1.91));
        }
      }, () => {
        setMediaAspectRatio(4 / 5);
      });
    }
  }, [trip?.images, trip?.coverImage]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const isOwner = trip?.userId === user?.uid;

  useEffect(() => {
    const unsubscribe = firestore().collection('trips').doc(tripId).onSnapshot(async (doc) => {
      if (doc.exists) {
        const tripData = { id: doc.id, ...doc.data() };
        if (tripData.userId) {
          try {
            const userDoc = await firestore().collection('public_users').doc(tripData.userId).get();
            if (userDoc.exists) tripData.user = userDoc.data();
          } catch (e) { }
        }
        setTrip(tripData);
        // Sync isJoined state with participants array
        setIsJoined(user ? tripData.participants?.includes(user.uid) : false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId, user?.uid]);

  // Fetch participant data when trip.participants changes
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!trip?.participants || trip.participants.length === 0) {
        setParticipantsData([]);
        return;
      }
      try {
        const participantPromises = trip.participants.slice(0, 8).map(async (uid: string) => {
          const userDoc = await firestore().collection('public_users').doc(uid).get();
          if (userDoc.exists) {
            return { id: uid, ...userDoc.data() };
          }
          return { id: uid, displayName: 'Traveler', photoURL: null };
        });
        const participants = await Promise.all(participantPromises);
        setParticipantsData(participants);
      } catch (error) {
        // Error fetching participants

      }
    };
    fetchParticipants();
  }, [trip?.participants]);

  // Fetch ratings for completed trips
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const ratingsSnapshot = await firestore()
          .collection('ratings')
          .where('tripId', '==', tripId)
          .orderBy('createdAt', 'desc')
          .get();

        const ratings = ratingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExistingRatings(ratings);

        // Check if current user has already rated
        if (user) {
          const userRatingDoc = ratings.find(r => r.userId === user.uid);
          if (userRatingDoc) {
            setHasRated(true);
            setUserRating(userRatingDoc.rating);
            setUserFeedback(userRatingDoc.feedback || '');
          }
        }
      } catch (error) {
        // Error handled silently
      }
    };

    if (tripId) {
      fetchRatings();
    }
  }, [tripId, user]);

  const isCompleted = React.useMemo(() => {
    if (!trip || !trip.toDate) return false;
    const endDate = trip.toDate.toDate ? trip.toDate.toDate() : new Date(trip.toDate);
    return endDate < new Date();
  }, [trip]);

  const handleSubmitRating = async () => {
    if (!isCompleted) {
      Alert.alert('Trip Not Completed', 'You can only rate a trip after it has ended.');
      return;
    }

    setSubmittingRating(true);
    try {
      const ratingData = {
        tripId,
        tripTitle: trip?.title || 'Trip',
        userId: user.uid,
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || '',
        hostId: trip?.userId,
        rating: userRating,
        feedback: userFeedback.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      if (hasRated) {
        // Update existing rating
        const existingRating = existingRatings.find(r => r.userId === user.uid);
        if (existingRating) {
          await firestore().collection('ratings').doc(existingRating.id).update({
            rating: userRating,
            feedback: userFeedback.trim(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      } else {
        // Create new rating
        await firestore().collection('ratings').add(ratingData);
        setHasRated(true);

        // Send notification to trip owner (only for new ratings, not updates)
        if (trip?.userId && trip.userId !== user.uid) {
          const raterName = user.displayName || 'Someone';
          const tripTitle = trip?.title || 'your trip';
          await NotificationService.onTripRating(user.uid, raterName, tripId, trip.userId, tripTitle, userRating);
        }
      }

      Alert.alert('Thank You! ⭐', 'Your rating has been submitted.');
    } catch (error) {
      // Error handled silently
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Calculate average rating
  const averageRating = existingRatings.length > 0
    ? (existingRatings.reduce((sum, r) => sum + r.rating, 0) / existingRatings.length).toFixed(1)
    : null;

  const handleJoinToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to join trips.');
      return;
    }

    try {
      const userName = user.displayName || 'A traveler';
      const tripTitle = trip?.title || 'a trip';

      if (isJoined) {
        // Leave trip - instant toggle
        await firestore().collection('trips').doc(tripId).update({
          participants: firestore.FieldValue.arrayRemove(user.uid),
          currentTravelers: firestore.FieldValue.increment(-1),
        });
        setIsJoined(false);

        // Send leave notification to trip owner
        if (trip?.userId && trip.userId !== user.uid) {
          await NotificationService.onLeaveTrip(user.uid, userName, tripId, trip.userId, tripTitle);
        }
      } else {
        // Check spots
        if (spotsLeft <= 0) {
          Alert.alert('Trip Full', 'Sorry, this trip is already full.');
          return;
        }

        // Gender check — read from 'users' where gender is stored
        const tripGender = (trip?.genderPreference || '').trim().toLowerCase();
        if (tripGender && tripGender !== 'anyone') {
          try {
            const userDoc = await firestore().collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const userGender = (userData?.gender || '').trim().toLowerCase();

            if (!userGender) {
              Alert.alert(
                'Gender Not Set',
                'Your gender is required to join gender-restricted trips. Please update your profile.'
              );
              return;
            }

            if (userGender !== tripGender) {
              const genderLabel = tripGender === 'male' ? 'Male' : 'Female';
              Alert.alert(
                'Gender Restriction',
                `This trip is for ${genderLabel} travelers only. Try joining other trips that match your gender or are open to Anyone! 🌍`
              );
              return;
            }
          } catch (e) {
            Alert.alert('Error', 'Could not verify your gender. Please try again.');
            return;
          }
        }

        // Join trip - instant toggle
        await firestore().collection('trips').doc(tripId).update({
          participants: firestore.FieldValue.arrayUnion(user.uid),
          currentTravelers: firestore.FieldValue.increment(1),
        });
        setIsJoined(true);

        // Send join notification to trip owner
        if (trip?.userId && trip.userId !== user.uid) {
          await NotificationService.onJoinTrip(user.uid, userName, tripId, trip.userId, tripTitle);
        }
      }
    } catch (error) {
      // Keep previous state on error
    }
  };

  // Direct chat with trip organizer (1-on-1)
  const handleDirectChat = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to chat.');
      return;
    }
    if (!trip?.userId || trip.userId === user.uid) return;

    try {
      const chatQuery = await firestore()
        .collection('chats')
        .where('type', '==', 'direct')
        .where('participants', 'array-contains', user.uid)
        .get();

      let chatId = null;
      for (const doc of chatQuery.docs) {
        const data = doc.data();
        if (data.participants && data.participants.includes(trip.userId)) {
          chatId = doc.id;
          break;
        }
      }

      if (!chatId) {
        const newChatRef = await firestore().collection('chats').add({
          type: 'direct',
          createdBy: user.uid,
          participants: [user.uid, trip.userId],
          participantDetails: {
            [user.uid]: {
              displayName: user.displayName || 'User',
              photoURL: user.photoURL || '',
            },
            [trip.userId]: {
              displayName: trip.user?.displayName || 'User',
              photoURL: trip.user?.photoURL || '',
            },
          },
          unreadCount: {
            [user.uid]: 0,
            [trip.userId]: 0,
          },
          mutedBy: [],
          pinnedBy: [],
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        chatId = newChatRef.id;
      }

      navigation.navigate('Chat', {
        chatId,
        otherUserId: trip.userId,
        otherUserName: trip.user?.displayName || 'User',
        otherUserPhoto: trip.user?.photoURL || '',
      });
    } catch (error: any) {
      console.warn('DirectChat error:', error?.message || error);
      Alert.alert('Error', 'Could not start chat. Please try again.');
    }
  };

  const handleOpenMaps = () => {
    const location = trip?.toLocation || trip?.location;
    if (location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      Linking.openURL(url);
    }
  };

  const handleMessage = () => {
    if (isOwner && (!trip.participants || trip.participants.length <= 1)) {
      Alert.alert('No Joined Users', 'Wait for someone to join your trip to start chatting!');
      return;
    }
    const chatId = `trip_${tripId}`;
    navigation.navigate('Chat', {
      chatId,
      tripTitle: trip?.title,
      tripImage: trip?.coverImage || trip?.images?.[0],
      isGroupChat: true,
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'TBD';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'TBD';
    }
  };

  const formatCost = (cost: number) => {
    if (!cost) return 'Free';
    if (cost >= 100000) return `₹${(cost / 100000).toFixed(1)}L`;
    if (cost >= 1000) return `₹${(cost / 1000).toFixed(0)}K`;
    return `₹${cost}`;
  };



  // Soft Cancel - Marks as cancelled
  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? Participants will be notified, but the trip page will remain visible as Cancelled.',
      [
        { text: 'No, Keep it', style: 'cancel' },
        {
          text: 'Yes, Cancel Trip',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Notify participants
              const participants = trip?.participants || [];
              const hostName = user?.displayName || 'The host';
              const tripTitle = trip?.title || 'A trip';

              for (const participantId of participants) {
                if (participantId !== user?.uid) {
                  await NotificationService.onTripCancelled(participantId, tripId, tripTitle, hostName);
                }
              }

              // Update status
              await firestore().collection('trips').doc(tripId).update({
                status: 'cancelled',
                isCancelled: true // Legacy support
              });
              Alert.alert('Cancelled', 'Trip has been marked as cancelled.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel trip.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // Hard Delete - Removes document
  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to PERMANENTLY delete this trip? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await firestore().collection('trips').doc(tripId).delete();
              Alert.alert('Deleted', 'Trip deleted successfully.');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete trip.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return (
    <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  if (!trip) return (
    <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text }}>Trip not found.</Text>
    </View>
  );

  const images = trip.images?.length > 0 ? trip.images : [trip.coverImage || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'];
  const imageLocations = trip.imageLocations || [];
  const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header with Back Button + Title + Menu */}
      <SafeAreaView edges={['top']} style={{ zIndex: 100, backgroundColor: colors.background, elevation: 5 }}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {trip.title}
          </Text>

          {/* Right Side Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Join button for non-owners */}
            {!isOwner && !isCompleted && (
              <TouchableOpacity
                style={[
                  styles.headerJoinButton,
                  {
                    backgroundColor: isJoined ? 'transparent' : colors.primary,
                    borderColor: colors.primary,
                    marginRight: SPACING.sm
                  },
                ]}
                onPress={handleJoinToggle}
                disabled={spotsLeft <= 0 && !isJoined}
                activeOpacity={0.7}
              >
                <Text style={[styles.headerJoinText, { color: isJoined ? colors.primary : '#fff' }]}>
                  {isJoined ? 'Joined' : spotsLeft <= 0 ? 'Full' : 'Join'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Three Dots Menu for Owner */}
            {isOwner && (
              <View>
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: colors.card }]}
                  onPress={() => setShowMenu(true)}
                  testID="trip-menu-button"
                >
                  <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
                </TouchableOpacity>

                <Modal
                  visible={showMenu}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setShowMenu(false)}
                >
                  <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
                    <View style={styles.modalOverlay}>
                      <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            navigation.navigate('EditTrip', { tripId });
                          }}
                        >
                          <Ionicons name="create-outline" size={20} color={colors.text} />
                          <Text style={[styles.menuText, { color: colors.text }]}>Edit Trip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            handleCancelTrip();
                          }}
                        >
                          <Ionicons name="close-circle-outline" size={20} color={colors.text} />
                          <Text style={[styles.menuText, { color: colors.text }]}>Cancel Trip</Text>
                        </TouchableOpacity>
                        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            handleDeleteTrip();
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          <Text style={[styles.menuText, { color: '#EF4444' }]}>Delete Trip</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                </Modal>
              </View>
            )}

            {/* Report for non-owners */}
            {!isOwner && (
              <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: colors.card, marginLeft: 8 }]}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="flag-outline" size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >

        {/* Trip Images Carousel (matching TripCard) */}
        <View>
          <View style={[styles.imageContainer, { aspectRatio: mediaAspectRatio }]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="fast"
              style={StyleSheet.absoluteFill}
              contentContainerStyle={{ width: width * images.length }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveImageIndex(index);
              }}
            >
              {images.map((item, index) => (
                <View key={`img_container_${index}`} style={{ position: 'relative' }}>
                  <Image
                    key={`img_${index}`}
                    source={{ uri: item }}
                    style={[styles.tripImage, { aspectRatio: mediaAspectRatio }]}
                    resizeMode="contain"
                  />
                  {(imageLocations[index] || trip?.toLocation || trip?.location) ? (
                    <View style={styles.imageOverlay}>
                      <View style={styles.overlayLocationRow}>
                        <Ionicons name="location" size={14} color="#fff" />
                        <Text style={styles.overlayLocation}>{imageLocations[index] || trip?.toLocation || trip?.location}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            {images.length > 1 && (
              <View style={styles.imageCountBadge}>
                <Text style={styles.imageCountText}>{activeImageIndex + 1}/{images.length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Media Footer: Dots Outside Images */}
        {images.length > 1 && (
          <View style={styles.mediaFooter}>
            <View style={styles.imageDotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.imageDot,
                    { backgroundColor: index === activeImageIndex ? colors.primary : colors.border }
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background, borderRadius: 0 }]}>
          {/* Title removed - moved to header */}
          <Animatable.View animation="fadeInUp" delay={100}>

            {/* Creator Row with Message Button */}
            <View style={styles.creatorRow}>
              <TouchableOpacity
                style={styles.creatorInfo}
                onPress={() => navigation.navigate('UserProfile', { userId: trip.userId })}
              >
                <DefaultAvatar
                  uri={trip.user?.photoURL}
                  name={trip.user?.displayName}
                  size={50}
                  style={styles.creatorAvatar}
                />
                <View>
                  <Text style={[styles.creatorName, { color: colors.text }]}>
                    {trip.user?.displayName || 'Trip Creator'}
                  </Text>
                  <Text style={[styles.creatorLabel, { color: colors.textSecondary }]}>Organizer</Text>
                </View>
              </TouchableOpacity>

              {/* Message Button next to organizer (for joined users or owner) */}
              {(isJoined || isOwner) && (
                <TouchableOpacity
                  style={[styles.smallMessageBtn, { backgroundColor: colors.primary }]}
                  onPress={handleMessage}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                  <Text style={styles.smallMessageBtnText}>Group Chat</Text>
                </TouchableOpacity>
              )}

              {/* Direct Chat with organizer (for non-owners) */}
              {!isOwner && (
                <TouchableOpacity
                  style={[styles.directChatBtn, { borderColor: colors.primary }]}
                  onPress={handleDirectChat}
                >
                  <Text style={[styles.directChatBtnText, { color: colors.primary }]}>Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animatable.View>

          {/* Compact Destination Row */}
          <View style={[styles.destinationCardRow, { backgroundColor: colors.card }]}>
            <View style={styles.destinationInfoCol}>
              <Text style={[styles.destinationLabel, { color: colors.textSecondary }]}>Destination</Text>
              <Text style={[styles.destinationText, { color: colors.text }]} numberOfLines={1}>
                {trip.toLocation || trip.location || 'TBD'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.compactMapBtn, { backgroundColor: colors.primary + '20' }]}
              onPress={handleOpenMaps}
            >
              <Ionicons name="map" size={18} color={colors.primary} />
              <Text style={[styles.compactMapBtnText, { color: colors.primary }]}>Google Maps</Text>
            </TouchableOpacity>
          </View>

          {/* ... (Stats, Description, Details, Places, Items, Participants - unchanged) ... */}
          {/* Quick Stats */}
          <Animatable.View animation="fadeInUp" delay={200} style={[styles.statsRow, { backgroundColor: colors.card }]}>
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>💰</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{formatCost(trip.costPerPerson || trip.cost)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>per person</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{trip.duration || '3 days'}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>duration</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{spotsLeft}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>spots left</Text>
            </View>
          </Animatable.View>

          {/* Description */}
          <Animatable.View animation="fadeInUp" delay={300}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About This Trip</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {trip.description || 'An amazing adventure awaits! Join this trip and create unforgettable memories.'}
            </Text>
          </Animatable.View>

          {/* Trip Details */}
          <Animatable.View animation="fadeInUp" delay={400} style={[styles.detailsCard, { backgroundColor: colors.card }]}>
            <DetailRow icon="📍" label="From" value={trip.fromLocation || 'TBD'} colors={colors} />
            <DetailRow icon="🎯" label="To" value={trip.toLocation || trip.location || 'TBD'} colors={colors} />
            <DetailRow icon="📅" label="Start Date" value={formatDate(trip.fromDate)} colors={colors} />
            <DetailRow icon="📅" label="End Date" value={formatDate(trip.toDate)} colors={colors} />
            <DetailRow icon="🚗" label="Transport" value={trip.transportModes?.join(', ') || trip.transportMode || 'TBD'} colors={colors} />
            <DetailRow icon="🎭" label="Activities" value={trip.tripTypes?.join(', ') || 'TBD'} colors={colors} />
            <DetailRow icon="🏨" label="Stay" value={trip.accommodationType || 'TBD'} colors={colors} />
            {trip.accommodationDays && (
              <DetailRow icon="⌛" label="Stay Duration" value={`${trip.accommodationDays} days`} colors={colors} />
            )}
            {trip.bookingStatus && (
              <DetailRow icon="✅" label="Booking" value={trip.bookingStatus === 'booked' ? 'Already Booked' : trip.bookingStatus === 'to_book' ? 'Yet to Book' : 'Not Needed'} colors={colors} />
            )}
            <DetailRow icon="👥" label="Group" value={`${trip.genderPreference === 'male' ? 'Male only' : trip.genderPreference === 'female' ? 'Female only' : 'Anyone can join'}`} colors={colors} />
          </Animatable.View>


          {/* Places to Visit */}
          {trip.placesToVisit?.length > 0 && (
            <Animatable.View animation="fadeInUp" delay={600}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Places to Visit</Text>
              {trip.placesToVisit.map((place: string, index: number) => (
                <View key={index} style={[styles.placeItem, { backgroundColor: colors.card }]}>
                  <View style={[styles.placeNumber, { backgroundColor: colors.primary }]}>
                    <Text style={styles.placeNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.placeText, { color: colors.text }]}>{place}</Text>
                </View>
              ))}
            </Animatable.View>
          )}

          {/* Mandatory Items */}
          {trip.mandatoryItems?.length > 0 && (
            <Animatable.View animation="fadeInUp" delay={700}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>What to Bring</Text>
              <View style={styles.itemsGrid}>
                {trip.mandatoryItems.map((item: string, index: number) => (
                  <View key={index} style={[styles.itemChip, { backgroundColor: colors.card }]}>
                    <Text style={[styles.itemText, { color: colors.text }]}>✓ {item}</Text>
                  </View>
                ))}
              </View>
            </Animatable.View>
          )}

          {/* Participants */}
          <Animatable.View animation="fadeInUp" delay={800}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Travelers ({trip.participants?.length || 1}/{trip.maxTravelers || 8})
            </Text>
            <View style={styles.participantsRow}>
              {participantsData.slice(0, 5).map((participant, i) => (
                <TouchableOpacity
                  key={participant.id}
                  style={[styles.participantAvatar, { marginLeft: i > 0 ? -10 : 0 }]}
                  onPress={() => navigation.navigate('UserProfile', { userId: participant.id })}
                >
                  <DefaultAvatar
                    uri={participant.photoURL}
                    name={participant.displayName}
                    size={36}
                    style={styles.participantImage}
                  />
                </TouchableOpacity>
              ))}
              {(trip.participants?.length || 1) > 5 && (
                <View style={[styles.moreParticipants, { backgroundColor: colors.primary }]}>
                  <Text style={styles.moreText}>+{(trip.participants?.length || 1) - 5}</Text>
                </View>
              )}
            </View>
          </Animatable.View>

          {/* Ratings Section - Moved outside isCompleted check for LIST, kept for submitting */}
          {/* Always show if there are ratings OR if completed */}
          {(existingRatings.length > 0 || isCompleted) && (
            <Animatable.View animation="fadeInUp" delay={900}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Ratings & Reviews {averageRating && `⭐ ${averageRating}`}
              </Text>

              {/* Only allow submitting if completed */}
              {isCompleted && !isOwner && (
                <View style={[styles.ratingCard, { backgroundColor: colors.card }]}>
                  {isJoined ? (
                    <>
                      <Text style={[styles.ratingCardTitle, { color: colors.text }]}>
                        {hasRated ? 'Update Your Rating' : 'Rate This Trip'}
                      </Text>

                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => setUserRating(star)}
                            style={styles.starButton}
                          >
                            <Ionicons
                              name={star <= userRating ? 'star' : 'star-outline'}
                              size={36}
                              color={star <= userRating ? '#F59E0B' : colors.textSecondary}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        style={[styles.feedbackInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                        placeholder="Share your experience... (optional)"
                        placeholderTextColor={colors.textSecondary}
                        value={userFeedback}
                        onChangeText={setUserFeedback}
                        multiline
                        maxLength={500}
                      />

                      <TouchableOpacity
                        style={[styles.submitRatingButton, { backgroundColor: colors.primary, opacity: submittingRating ? 0.6 : 1 }]}
                        onPress={handleSubmitRating}
                        disabled={submittingRating}
                      >
                        {submittingRating ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.submitRatingButtonText}>
                            {hasRated ? 'Update Rating' : 'Submit Rating'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', padding: SPACING.lg }}>
                      <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
                      <Text style={[styles.ratingCardTitle, { color: colors.text, marginTop: SPACING.md }]}>
                        Join Trip to Rate
                      </Text>
                      <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.xs }}>
                        Only travelers who have joined this trip can leave ratings and reviews.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Reviews List - Always show if exists, regardless of isCompleted */}
              {existingRatings.length > 0 && (
                <View style={styles.reviewsList}>
                  {existingRatings.slice(0, 5).map((review) => (
                    <View key={review.id} style={[styles.reviewItem, { backgroundColor: colors.card }]}>
                      <View style={styles.reviewHeader}>
                        <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: review.userId })}>
                          <DefaultAvatar
                            uri={review.userPhoto}
                            name={review.userName}
                            size={36}
                            style={styles.reviewAvatar}
                          />
                        </TouchableOpacity>
                        <View style={styles.reviewInfo}>
                          <Text style={[styles.reviewName, { color: colors.text }]}>{review.userName}</Text>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= review.rating ? 'star' : 'star-outline'}
                                size={14}
                                color={star <= review.rating ? '#F59E0B' : colors.textSecondary}
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                      {review.feedback && (
                        <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                          {review.feedback}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Animatable.View>
          )}

          {/* Spacer for scroll */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Footer Removed (Message button moved to creator row) */}

      {/* ... (Keep Modal Rendering - same as before) ... */}

      {/* Report Trip Modal */}
      <ReportTripModal
        visible={showReportModal}
        trip={trip}
        onClose={() => setShowReportModal(false)}
      />

    </View>
  );
};

const DetailRow = ({ icon, label, value, colors }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailIcon}>{icon}</Text>
    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerInScroll: { marginBottom: SPACING.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, paddingTop: 2 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, paddingHorizontal: SPACING.sm },
  headerButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerJoinButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 22, borderWidth: 1.5 },
  headerJoinText: { fontSize: 14, fontWeight: '700' },
  headerCompletedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 },
  headerCompletedText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  imageContainer: { position: 'relative' },
  tripImage: { width: width },
  mediaFooter: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: SPACING.sm, minHeight: 24 },
  imageDotsContainer: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
  imageDot: { width: 6, height: 6, borderRadius: 3 },
  imageCountBadge: { position: 'absolute', top: SPACING.md, left: SPACING.md, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
  imageCountText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  contentContainer: { marginTop: 0, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  title: { fontSize: 28, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  creatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  creatorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  creatorAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md },
  creatorName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  creatorLabel: { fontSize: FONT_SIZE.xs },
  reportButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, gap: 4 },
  reportButtonText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  // Destination card
  destinationCard: { flexDirection: 'column', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.md },
  destinationLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  destinationIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  destinationInfo: { flex: 1 },
  destinationLabel: { fontSize: FONT_SIZE.xs, marginBottom: 2 },
  destinationText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  viewMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.md, gap: 6 },
  viewMapsText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.xl },
  statItem: { alignItems: 'center' },
  statEmoji: { fontSize: 24, marginBottom: SPACING.xs },
  statValue: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  statLabel: { fontSize: FONT_SIZE.xs },
  statDivider: { width: 1, height: 40 },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md, marginTop: SPACING.lg },
  description: { fontSize: FONT_SIZE.md, lineHeight: 24 },
  detailsCard: { borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  detailIcon: { fontSize: 18, width: 30 },
  detailLabel: { flex: 1, fontSize: FONT_SIZE.sm },
  detailValue: { flex: 2, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, textAlign: 'right' },
  mapContainer: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  mapPlaceholder: { height: 150, justifyContent: 'center', alignItems: 'center' },
  staticMap: { width: '100%', height: 120, backgroundColor: '#e5e7eb' },
  mapOverlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, gap: SPACING.xs },
  mapText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  mapSubtext: { fontSize: FONT_SIZE.xs },
  viewMapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, gap: SPACING.sm },
  viewMapButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  placeItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
  placeNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  placeNumberText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  placeText: { fontSize: FONT_SIZE.md },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  itemChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
  itemText: { fontSize: FONT_SIZE.sm },
  participantsRow: { flexDirection: 'row', alignItems: 'center' },
  participantAvatar: { borderWidth: 2, borderColor: '#fff', borderRadius: 20 },
  participantImage: { width: 36, height: 36, borderRadius: 18 },
  moreParticipants: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: -10, borderWidth: 2, borderColor: '#fff' },
  moreText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.lg, borderTopWidth: 1, alignItems: 'center' },
  messageButton: { flexDirection: 'row', width: '100%', paddingVertical: SPACING.md + 2, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  messageButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, gap: SPACING.sm },
  completedBadgeText: { color: '#10B981', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  // Rating styles
  ratingCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.lg },
  ratingCardTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md, textAlign: 'center' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  starButton: { padding: SPACING.xs },
  feedbackInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.md, height: 100, textAlignVertical: 'top', marginBottom: SPACING.md },
  submitRatingButton: { paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  submitRatingButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  reviewsList: { marginTop: SPACING.md },
  reviewsTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.md },
  reviewItem: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  reviewStars: { flexDirection: 'row', marginTop: 2 },
  reviewText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  // Image Overlay Styles

  imageWrapper: { position: 'relative' },
  imageOverlay: {
    position: 'absolute',
    bottom: SPACING.md,
    left: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.md,
  },
  overlayTitle: {
    color: '#fff',
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  overlayLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlayLocation: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 60, // Fixed gap above three dots
    right: 20,
    width: 220,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    elevation: 8, // More prominent shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 1000
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  menuText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  menuDivider: { height: 1, marginVertical: SPACING.xs },
  smallMessageBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.md, gap: 4, marginLeft: SPACING.sm },
  smallMessageBtnText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  destinationCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
  destinationInfoCol: { flex: 1, marginRight: SPACING.md },
  compactMapBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: BORDER_RADIUS.md, gap: 6 },
  compactMapBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  directChatBtn: { borderWidth: 1.5, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.md, marginLeft: SPACING.sm },
  directChatBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

});

export default TripDetailsScreen;
