import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Dimensions, FlatList, Linking, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import CustomToggle from '../components/CustomToggle';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

const TripDetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { tripId } = route.params;
  const user = auth.currentUser;

  const scrollY = useRef(new Animated.Value(0)).current;

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
      console.log('Toggle error:', error);
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
      console.log('Share error:', error);
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
      {/* Header with Back Button */}
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={24} color="#fff" />
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
            onLabel="Joined"
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
});

export default TripDetailsScreen;
