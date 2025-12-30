import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Dimensions, FlatList, Linking, Alert, Share, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import CustomToggle from '../components/CustomToggle';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

// Trip type options for editing
const TRIP_TYPES = [
  { id: 'adventure', label: 'Adventure' },
  { id: 'trekking', label: 'Trekking' },
  { id: 'bike_ride', label: 'Bike Ride' },
  { id: 'road_trip', label: 'Road Trip' },
  { id: 'camping', label: 'Camping' },
  { id: 'sightseeing', label: 'Sightseeing' },
  { id: 'beach', label: 'Beach' },
  { id: 'pilgrimage', label: 'Pilgrimage' },
];

const TRANSPORT_MODES = [
  { id: 'train', label: 'Train' },
  { id: 'bus', label: 'Bus' },
  { id: 'car', label: 'Car' },
  { id: 'flight', label: 'Flight' },
  { id: 'bike', label: 'Bike' },
  { id: 'mixed', label: 'Mixed' },
];

const ACCOMMODATION_TYPES = [
  { id: 'hotel', label: 'Hotel' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'camping', label: 'Camping' },
  { id: 'homestay', label: 'Homestay' },
  { id: 'none', label: 'Not Needed' },
];

const GENDER_PREFERENCES = [
  { id: 'anyone', label: 'Anyone' },
  { id: 'male', label: 'Male Only' },
  { id: 'female', label: 'Female Only' },
];

const TripDetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { tripId } = route.params;
  const user = auth.currentUser;

  // Rating states
  const [userRating, setUserRating] = useState(0);
  const [userFeedback, setUserFeedback] = useState('');
  const [existingRatings, setExistingRatings] = useState<any[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  // Edit/Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editFromLocation, setEditFromLocation] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editMaxTravelers, setEditMaxTravelers] = useState('');
  const [editTripTypes, setEditTripTypes] = useState<string[]>([]);
  const [editTransportModes, setEditTransportModes] = useState<string[]>([]);
  const [editMandatoryItems, setEditMandatoryItems] = useState('');
  const [editPlacesToVisit, setEditPlacesToVisit] = useState('');
  const [editAccommodation, setEditAccommodation] = useState('');
  const [editGenderPreference, setEditGenderPreference] = useState('anyone');
  const [editFromDate, setEditFromDate] = useState(new Date());
  const [editToDate, setEditToDate] = useState(new Date());
  const [editAccommodationDays, setEditAccommodationDays] = useState('');
  const [showDateModal, setShowDateModal] = useState<'from' | 'to' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const isOwner = trip?.userId === user?.uid;

  useEffect(() => {
    const unsubscribe = firestore().collection('trips').doc(tripId).onSnapshot(async (doc) => {
      if (doc.exists) {
        const tripData = { id: doc.id, ...doc.data() };
        if (tripData.userId) {
          try {
            const userDoc = await firestore().collection('users').doc(tripData.userId).get();
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
  }, [tripId, user?.uid]);

  const handleSubmitRating = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to rate trips.');
      return;
    }

    if (userRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
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
      if (isJoined) {
        // Leave trip - instant toggle
        await firestore().collection('trips').doc(tripId).update({
          participants: firestore.FieldValue.arrayRemove(user.uid),
          currentTravelers: firestore.FieldValue.increment(-1),
        });
        setIsJoined(false);
      } else {
        // Join trip - instant toggle
        await firestore().collection('trips').doc(tripId).update({
          participants: firestore.FieldValue.arrayUnion(user.uid),
          currentTravelers: firestore.FieldValue.increment(1),
        });
        setIsJoined(true);
      }
    } catch (error) {
      // Error handled silently
      // Keep previous state on error
    }
  };

  const handleOpenMaps = () => {
    const location = trip?.toLocation || trip?.location;
    if (location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      Linking.openURL(url);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚀 Check out this trip: ${trip?.title}!\n\n📍 ${trip?.location || 'Adventure'}\n💰 ${formatCost(trip?.costPerPerson || trip?.cost)}/person\n\nJoin on Tripzi! 🌍`,
      });
    } catch (error) {
      // Error handled silently
    }
  };

  const handleMessage = () => {
    const chatId = `trip_${tripId}`;
    navigation.navigate('Message', {
      chatId,
      tripTitle: trip?.title,
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

  const openEditModal = () => {
    setEditTitle(trip?.title || '');
    setEditFromLocation(trip?.fromLocation || '');
    setEditLocation(trip?.location || trip?.toLocation || '');
    setEditDescription(trip?.description || '');
    setEditCost(trip?.costPerPerson?.toString() || trip?.cost?.toString() || '');
    setEditMaxTravelers(trip?.maxTravelers?.toString() || '8');
    setEditTripTypes(trip?.tripTypes || []);
    setEditTransportModes(trip?.transportModes || []);
    setEditMandatoryItems(trip?.mandatoryItems?.join(', ') || '');
    setEditPlacesToVisit(trip?.placesToVisit?.join(', ') || '');
    setEditAccommodation(trip?.accommodationType || '');
    setEditGenderPreference(trip?.genderPreference || 'anyone');
    // Parse dates from Firestore timestamps
    const fromDateValue = trip?.fromDate?.toDate ? trip.fromDate.toDate() : new Date();
    const toDateValue = trip?.toDate?.toDate ? trip.toDate.toDate() : new Date();
    setEditFromDate(fromDateValue);
    setEditToDate(toDateValue);
    setEditAccommodationDays(trip?.accommodationDays?.toString() || '');
    setShowEditModal(true);
  };

  const formatEditDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getEditDuration = () => {
    const diff = Math.ceil((editToDate.getTime() - editFromDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '1 day';
  };

  const generateMapsLink = (destination: string) => {
    const encoded = encodeURIComponent(destination);
    return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  };

  const toggleEditTripType = (id: string) => {
    setEditTripTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleEditTransport = (id: string) => {
    setEditTransportModes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSaveTrip = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setSaving(true);
    try {
      await firestore().collection('trips').doc(tripId).update({
        title: editTitle.trim(),
        fromLocation: editFromLocation.trim(),
        location: editLocation.trim(),
        toLocation: editLocation.trim(),
        description: editDescription.trim(),
        costPerPerson: parseInt(editCost) || 0,
        cost: parseInt(editCost) || 0,
        maxTravelers: parseInt(editMaxTravelers) || 8,
        tripTypes: editTripTypes,
        transportModes: editTransportModes,
        mandatoryItems: editMandatoryItems.split(',').map(i => i.trim()).filter(Boolean),
        placesToVisit: editPlacesToVisit.split(',').map(i => i.trim()).filter(Boolean),
        accommodationType: editAccommodation,
        genderPreference: editGenderPreference,
        fromDate: firestore.Timestamp.fromDate(editFromDate),
        toDate: firestore.Timestamp.fromDate(editToDate),
        duration: getEditDuration(),
        accommodationDays: editAccommodationDays ? parseInt(editAccommodationDays) : null,
        mapsLink: generateMapsLink(editLocation),
      });
      setShowEditModal(false);
      Alert.alert('Success', 'Trip updated successfully!');
    } catch (error: any) {
      // Error handled silently
      Alert.alert('Error', 'Failed to update trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await firestore().collection('trips').doc(tripId).delete();
              Alert.alert('Deleted', 'Trip has been deleted.');
              navigation.goBack();
            } catch (error: any) {
              // Error handled silently
              Alert.alert('Error', 'Failed to delete trip. Please try again.');
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
  const spotsLeft = Math.max(0, (trip.maxTravelers || 8) - (trip.participants?.length || trip.currentTravelers || 1));

  // Check if trip is completed (past end date)
  const isCompleted = (() => {
    if (!trip.toDate) return false;
    const endDate = new Date(trip.toDate);
    return endDate < new Date();
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button Only */}
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* Trip Images Carousel */}
        <View style={styles.imageCarousel}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.carouselImage} />
            )}
            keyExtractor={(item, index) => `img_${index}`}
          />
          {images.length > 1 && (
            <View style={styles.imageDotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.imageDot,
                    { backgroundColor: index === activeImageIndex ? '#fff' : 'rgba(255,255,255,0.5)' }
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
          {/* Title & Creator */}
          <Animatable.View animation="fadeInUp" delay={100}>
            <Text style={[styles.title, { color: colors.text }]}>{trip.title}</Text>
            <TouchableOpacity
              style={styles.creatorInfo}
              onPress={() => navigation.navigate('UserProfile', { userId: trip.userId })}
            >
              <Image
                style={styles.creatorAvatar}
                source={{ uri: trip.user?.photoURL || 'https://via.placeholder.com/40' }}
              />
              <View>
                <Text style={[styles.creatorName, { color: colors.text }]}>
                  {trip.user?.displayName || 'Trip Creator'}
                </Text>
                <Text style={[styles.creatorLabel, { color: colors.textSecondary }]}>Organizer</Text>
              </View>
            </TouchableOpacity>
          </Animatable.View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Share</Text>
            </TouchableOpacity>
            {isOwner && (
              <>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={openEditModal}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                  onPress={handleDeleteTrip}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

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
            <DetailRow icon="🏨" label="Stay" value={trip.accommodationType || 'TBD'} colors={colors} />
            <DetailRow icon="👥" label="Group" value={`${trip.genderPreference === 'male' ? 'Male only' : trip.genderPreference === 'female' ? 'Female only' : 'Anyone can join'}`} colors={colors} />
          </Animatable.View>

          {/* Location Map */}
          <Animatable.View animation="fadeInUp" delay={500}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
            <View style={[styles.mapContainer, { backgroundColor: colors.card }]}>
              <Image
                source={{ uri: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(trip.toLocation || trip.location || 'India')}&zoom=12&size=600x200&maptype=roadmap&markers=color:red%7C${encodeURIComponent(trip.toLocation || trip.location || 'India')}&key=YOUR_API_KEY` }}
                style={styles.staticMap}
                resizeMode="cover"
              />
              <View style={styles.mapOverlay}>
                <Ionicons name="location" size={32} color="#EF4444" />
                <Text style={[styles.mapText, { color: colors.text }]}>{trip.toLocation || trip.location || 'Location'}</Text>
              </View>
              <TouchableOpacity style={[styles.viewMapButton, { backgroundColor: colors.primary }]} onPress={handleOpenMaps}>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.viewMapButtonText}>View in Google Maps</Text>
              </TouchableOpacity>
            </View>
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
              {[...Array(Math.min(5, trip.participants?.length || 1))].map((_, i) => (
                <View key={i} style={[styles.participantAvatar, { marginLeft: i > 0 ? -10 : 0 }]}>
                  <Image
                    source={{ uri: `https://randomuser.me/api/portraits/${i % 2 === 0 ? 'men' : 'women'}/${i + 1}.jpg` }}
                    style={styles.participantImage}
                  />
                </View>
              ))}
              {(trip.participants?.length || 1) > 5 && (
                <View style={[styles.moreParticipants, { backgroundColor: colors.primary }]}>
                  <Text style={styles.moreText}>+{(trip.participants?.length || 1) - 5}</Text>
                </View>
              )}
            </View>
          </Animatable.View>

          {/* Ratings Section - Only show for completed trips */}
          {isCompleted && (
            <Animatable.View animation="fadeInUp" delay={900}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Ratings & Reviews {averageRating && `⭐ ${averageRating}`}
              </Text>

              {/* Owner View - Show rating summary */}
              {isOwner ? (
                <View style={[styles.ratingCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.ratingCardTitle, { color: colors.text }]}>
                    Your Trip's Ratings
                  </Text>
                  {existingRatings.length > 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: SPACING.md }}>
                      <Text style={{ fontSize: 48, marginBottom: SPACING.xs }}>⭐</Text>
                      <Text style={[{ fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, color: colors.text }]}>
                        {averageRating}
                      </Text>
                      <Text style={[{ fontSize: FONT_SIZE.md, color: colors.textSecondary, marginTop: SPACING.xs }]}>
                        {existingRatings.length} {existingRatings.length === 1 ? 'Rating' : 'Ratings'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: SPACING.lg }}>
                      <Ionicons name="star-outline" size={48} color={colors.textSecondary} />
                      <Text style={[{ fontSize: FONT_SIZE.md, color: colors.textSecondary, marginTop: SPACING.md, textAlign: 'center' }]}>
                        No ratings yet{'\n'}Ratings will appear here after participants rate your trip
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* Participant View - Show rating form */
                <View style={[styles.ratingCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.ratingCardTitle, { color: colors.text }]}>
                    {hasRated ? 'Update Your Rating' : 'Rate This Trip'}
                  </Text>

                  {/* Star Rating */}
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

                  {/* Feedback Input */}
                  <TextInput
                    style={[styles.feedbackInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                    placeholder="Share your experience... (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={userFeedback}
                    onChangeText={setUserFeedback}
                    multiline
                    maxLength={500}
                  />

                  {/* Submit Button */}
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
                </View>
              )}

              {/* Existing Reviews - Show for everyone */}
              {existingRatings.length > 0 && (
                <View style={styles.reviewsList}>
                  <Text style={[styles.reviewsTitle, { color: colors.text }]}>
                    {existingRatings.length} Review{existingRatings.length !== 1 ? 's' : ''}
                  </Text>
                  {existingRatings.slice(0, 5).map((review) => (
                    <View key={review.id} style={[styles.reviewItem, { backgroundColor: colors.card }]}>
                      <View style={styles.reviewHeader}>
                        <Image
                          source={{ uri: review.userPhoto || 'https://via.placeholder.com/40' }}
                          style={styles.reviewAvatar}
                        />
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

          {/* Spacer for footer */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView >

      {/* Footer Actions - Toggle on left, Message button on right */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {isCompleted ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.completedBadgeText}>Trip Completed</Text>
          </View>
        ) : (
          <CustomToggle
            value={isJoined}
            onValueChange={handleJoinToggle}
            onLabel="Trip Joined"
            offLabel="Join Trip"
            size="medium"
          />
        )}
        <TouchableOpacity
          style={[styles.messageButton, { backgroundColor: colors.primary }]}
          onPress={handleMessage}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Trip Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={[styles.editModal, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Trip</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.editForm}>
                <Text style={[styles.editLabel, { color: colors.text }]}>Title *</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Trip title"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Starting From</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editFromLocation}
                  onChangeText={setEditFromLocation}
                  placeholder="e.g., Bangalore"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Destination</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="e.g., Leh, Ladakh"
                  placeholderTextColor={colors.textSecondary}
                />
                {editLocation.length > 3 && (
                  <Text style={{ fontSize: 12, color: colors.primary, marginTop: 4 }}>📍 Maps link will be auto-generated</Text>
                )}

                {/* Date Selection */}
                <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.editLabel, { color: colors.text, marginTop: 0 }]}>From Date</Text>
                    <TouchableOpacity
                      style={[styles.editInput, { backgroundColor: colors.inputBackground, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }]}
                      onPress={() => setShowDateModal('from')}
                    >
                      <Ionicons name="calendar" size={18} color={colors.primary} />
                      <Text style={{ color: colors.text, flex: 1 }}>{formatEditDate(editFromDate)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.editLabel, { color: colors.text, marginTop: 0 }]}>To Date</Text>
                    <TouchableOpacity
                      style={[styles.editInput, { backgroundColor: colors.inputBackground, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }]}
                      onPress={() => setShowDateModal('to')}
                    >
                      <Ionicons name="calendar" size={18} color={colors.primary} />
                      <Text style={{ color: colors.text, flex: 1 }}>{formatEditDate(editToDate)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: colors.primary, marginTop: 4 }}>Duration: {getEditDuration()}</Text>

                <Text style={[styles.editLabel, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.editInput, styles.editTextArea, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Trip description"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Trip Type</Text>
                <View style={styles.chipGrid}>
                  {TRIP_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.chip, { backgroundColor: editTripTypes.includes(type.id) ? colors.primary : colors.inputBackground }]}
                      onPress={() => toggleEditTripType(type.id)}
                    >
                      <Text style={[styles.chipText, { color: editTripTypes.includes(type.id) ? '#fff' : colors.text }]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.editLabel, { color: colors.text }]}>Transport Mode</Text>
                <View style={styles.chipGrid}>
                  {TRANSPORT_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.chip, { backgroundColor: editTransportModes.includes(mode.id) ? colors.primary : colors.inputBackground }]}
                      onPress={() => toggleEditTransport(mode.id)}
                    >
                      <Text style={[styles.chipText, { color: editTransportModes.includes(mode.id) ? '#fff' : colors.text }]}>{mode.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.editLabel, { color: colors.text }]}>Cost per Person (₹)</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editCost}
                  onChangeText={setEditCost}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Max Travelers</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editMaxTravelers}
                  onChangeText={setEditMaxTravelers}
                  placeholder="8"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Mandatory Items</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editMandatoryItems}
                  onChangeText={setEditMandatoryItems}
                  placeholder="ID proof, warm clothes (comma separated)"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Places to Visit</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={editPlacesToVisit}
                  onChangeText={setEditPlacesToVisit}
                  placeholder="Pangong Lake, Nubra Valley (comma separated)"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.editLabel, { color: colors.text }]}>Accommodation</Text>
                <View style={styles.chipGrid}>
                  {ACCOMMODATION_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.chip, { backgroundColor: editAccommodation === type.id ? '#10B981' : colors.inputBackground }]}
                      onPress={() => setEditAccommodation(type.id)}
                    >
                      <Text style={[styles.chipText, { color: editAccommodation === type.id ? '#fff' : colors.text }]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editAccommodation && editAccommodation !== 'none' && (
                  <>
                    <Text style={[styles.editLabel, { color: colors.text }]}>Accommodation Days</Text>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text }]}
                      value={editAccommodationDays}
                      onChangeText={setEditAccommodationDays}
                      placeholder="e.g., 3"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  </>
                )}

                <Text style={[styles.editLabel, { color: colors.text }]}>Who Can Join?</Text>
                <View style={styles.chipGrid}>
                  {GENDER_PREFERENCES.map((pref) => (
                    <TouchableOpacity
                      key={pref.id}
                      style={[styles.chip, { backgroundColor: editGenderPreference === pref.id ? '#8B5CF6' : colors.inputBackground }]}
                      onPress={() => setEditGenderPreference(pref.id)}
                    >
                      <Text style={[styles.chipText, { color: editGenderPreference === pref.id ? '#fff' : colors.text }]}>{pref.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ height: SPACING.xl }} />
              </ScrollView>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                  onPress={handleSaveTrip}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Date Selection Modal */}
      <Modal visible={showDateModal !== null} transparent animationType="fade">
        <View style={styles.dateModalOverlay}>
          <View style={[styles.dateModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.dateModalHeader}>
              <Text style={[styles.dateModalTitle, { color: colors.text }]}>
                Select {showDateModal === 'from' ? 'Start' : 'End'} Date
              </Text>
              <TouchableOpacity onPress={() => setShowDateModal(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
              {Array.from({ length: 90 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const isSelected = showDateModal === 'from'
                  ? date.toDateString() === editFromDate.toDateString()
                  : date.toDateString() === editToDate.toDateString();
                const isDisabled = showDateModal === 'to' && date.getTime() < editFromDate.getTime();

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.dateOption,
                      { backgroundColor: isSelected ? colors.primary : colors.card },
                      isDisabled && { opacity: 0.5 }
                    ]}
                    onPress={() => {
                      if (isDisabled) return;
                      if (showDateModal === 'from') {
                        setEditFromDate(date);
                        if (date.getTime() > editToDate.getTime()) {
                          setEditToDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));
                        }
                      } else {
                        setEditToDate(date);
                      }
                      setShowDateModal(null);
                    }}
                    disabled={isDisabled}
                  >
                    <Text style={[styles.dateOptionDay, { color: isSelected ? '#fff' : colors.text }]}>
                      {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateOptionDate, { color: isSelected ? '#fff' : colors.text }]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[styles.dateOptionMonth, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                      {date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View >
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
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  headerButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  imageCarousel: { height: 300 },
  carouselImage: { width, height: 300 },
  imageDotsContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: SPACING.xs },
  imageDot: { width: 8, height: 8, borderRadius: 4 },
  contentContainer: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, marginTop: -20, padding: SPACING.xl },
  title: { fontSize: 28, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  creatorInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  creatorAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md },
  creatorName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  creatorLabel: { fontSize: FONT_SIZE.xs },
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
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: SPACING.lg, borderTopWidth: 1, gap: SPACING.md, justifyContent: 'space-between', alignItems: 'center' },
  messageButton: { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', gap: SPACING.sm },
  messageButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  joinButton: { flex: 1, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  joinButtonText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  toggleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  toggleLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
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
  // Edit Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  editModal: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  editForm: { marginBottom: SPACING.lg },
  editLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.md },
  editInput: { borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.md },
  editTextArea: { minHeight: 100 },
  editActions: { flexDirection: 'row', gap: SPACING.md },
  cancelButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', borderWidth: 1 },
  cancelButtonText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  saveButton: { flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  // Action buttons below title
  actionButtonsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, gap: SPACING.xs },
  actionBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  // Chip styles for edit modal
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
  chipText: { fontSize: FONT_SIZE.sm },
  // Date picker modal styles
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  dateModalContent: { width: '85%', maxHeight: '70%', borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg },
  dateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  dateModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  dateList: { maxHeight: 400 },
  dateOption: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, gap: SPACING.md },
  dateOptionDay: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, width: 40 },
  dateOptionDate: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, width: 40 },
  dateOptionMonth: { fontSize: FONT_SIZE.sm, flex: 1 },
});

export default TripDetailsScreen;
