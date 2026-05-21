import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Dimensions, Linking, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { database } from '../database';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import MapView, { Marker } from 'react-native-maps';

import DefaultAvatar from '../components/DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import ReportTripModal from '../components/ReportTripModal';
import ActionReasonModal from '../components/ActionReasonModal';
import { cancelTrip, deleteTrip, joinTrip, leaveTrip } from '../utils/tripActions';
import useTripDetailsQuery from '../hooks/useTripDetailsQuery';
import { useQueryClient } from '@tanstack/react-query';

const { width } = Dimensions.get('window');

const LEAVE_REASONS = [
  'Plans changed',
  'Trip dates no longer work for me',
  'Budget changed',
  'I joined by mistake',
  'Other',
];

const CANCEL_REASONS = [
  'Host is unavailable',
  'Safety or logistics issue',
  'Weather or route issue',
  'Trip plan changed',
  'Other',
];

const DELETE_REASONS = [
  'Trip posted by mistake',
  'Trip plan changed completely',
  'Need to recreate the trip',
  'Safety or moderation concern',
  'Other',
];

const TripDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const tripId = (params.id as string) || (params.tripId as string);
  const { trip, loading, userId: currentUserId } = useTripDetailsQuery(tripId);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [user, setUser] = useState<any>(null);

  const isJoined = useMemo(() => {
    return user ? (trip?.participants || []).includes(user.id) : false;
  }, [trip?.participants, user?.id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u));
  }, []);


  // Edit/Delete states
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(4 / 5);
  const [pendingAction, setPendingAction] = useState<'leave' | 'cancel' | 'delete' | null>(null);

  useEffect(() => {
    const firstMedia = trip?.images?.[0] || trip?.coverImage;
    if (firstMedia && typeof firstMedia === 'string' && firstMedia.startsWith('http')) {
      RNImage.getSize(firstMedia, (width, height) => {
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
  const isOwner = trip?.userId === user?.id || trip?.user_id === user?.id;

  // Parse structured data from mandatory_items
  const parsedData = useMemo(() => {
    const items = trip?.mandatoryItems || trip?.mandatory_items || [];
    let checklist: any[] = [], categories: string[] = [], notes: any[] = [], collaborators: any[] = [];
    try {
      if (items.length > 0) {
        const firstItem = items[0];
        if (typeof firstItem === 'string' && (firstItem.trim().startsWith('[') || firstItem.trim().startsWith('{'))) {
          checklist = JSON.parse(firstItem);
          categories = JSON.parse(items[1] || '[]');
          notes = JSON.parse(items[2] || '[]');
          const collabIndex = items.length >= 5 ? 4 : 3;
          collaborators = JSON.parse(items[collabIndex] || '[]');
        }
      }
    } catch { }
    return {
      checklist: Array.isArray(checklist) ? checklist : [],
      categories: Array.isArray(categories) ? categories : [],
      notes: Array.isArray(notes) ? notes : [],
      collaborators: Array.isArray(collaborators) ? collaborators : []
    };
  }, [trip?.mandatoryItems, trip?.mandatory_items]);

  // Parse structured places from places_to_visit
  const parsedPlaces = useMemo(() => {
    const pv = trip?.placesToVisit || trip?.places_to_visit || [];
    try {
      if (pv.length > 0) {
        const firstItem = pv[0];
        if (typeof firstItem === 'string' && firstItem.trim().startsWith('[')) {
          const parsed = JSON.parse(firstItem);
          if (Array.isArray(parsed)) {
            return parsed
              .filter((p: any) => p && p.name)
              .sort((a: any, b: any) => (a.day || 0) - (b.day || 0) || (a.order || 0) - (b.order || 0));
          }
        } else if (typeof firstItem === 'string') {
          // Old format: simple string array
          return pv
            .filter((item: any) => typeof item === 'string' && item.length < 200 && !item.trim().startsWith('['))
            .map((name: string, i: number) => ({ name, day: 1, order: i }));
        }
      }
    } catch { }
    return [];
  }, [trip?.placesToVisit, trip?.places_to_visit]);

  // Group places by day
  const placesByDay = useMemo(() => {
    const grouped: { [key: number]: any[] } = {};
    parsedPlaces.forEach((place: any) => {
      const day = place.day || 1;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(place);
    });
    return grouped;
  }, [parsedPlaces]);

  // Group checklist by category
  const checklistByCategory = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    parsedData.checklist.forEach((item: any) => {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [parsedData.checklist]);

  // MapView region from places
  const mapRegion = useMemo(() => {
    const validPlaces = parsedPlaces.filter((p: any) => p.latitude && p.longitude);
    if (validPlaces.length === 0) return null;

    const lats = validPlaces.map((p: any) => p.latitude);
    const lngs = validPlaces.map((p: any) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
    };
  }, [parsedPlaces]);


  // Fetch participant data when trip.participants changes
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!trip?.participants || trip.participants.length === 0) {
        setParticipantsData([]);
        return;
      }
      try {
        const ids = trip.participants.slice(0, 8);
        const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', ids);
        const participants = ids.map(uid => {
          const p = (profiles || []).find(pr => pr.id === uid);
          return p ? { id: uid, displayName: p.display_name || p.name, photoURL: p.photo_url, ...p } : { id: uid, displayName: 'Traveler', photoURL: null };
        });
        setParticipantsData(participants);
      } catch (error) {
      }
    };
    fetchParticipants();
  }, [trip?.participants]);
  const isCompleted = React.useMemo(() => {
    if (!trip || !trip.toDate) return false;
    const endDate = trip.toDate.toDate ? trip.toDate.toDate() : new Date(trip.toDate);
    return endDate < new Date();
  }, [trip]);

  const handleJoinToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to join trips.');
      return;
    }

    try {
      if (isJoined) {
        setPendingAction('leave');
        return;
      } else {
        await joinTrip(tripId);
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
        // Trigger sync in background
        require('../database/sync').syncDatabase().catch(() => { });
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not update trip participation.');
    }
  };

  // Direct chat with trip organizer (1-on-1)
  const handleDirectChat = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to chat.');
      return;
    }
    if (!trip?.userId || trip.userId === user.id) return;

    try {
      const { data: existingChats } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'direct')
        .contains('participants', [user.id]);

      let chatId = null;
      for (const chat of (existingChats || [])) {
        if (chat.participants && chat.participants.includes(trip.userId)) {
          chatId = chat.id;
          break;
        }
      }

      if (!chatId) {
        const { data: newChat, error } = await supabase.from('chats').insert({
          type: 'direct',
          created_by: user.id,
          participants: [user.id, trip.userId],
          participant_details: {
            [user.id]: {
              displayName: user.user_metadata?.full_name || 'User',
              photoURL: user.user_metadata?.avatar_url || '',
            },
            [trip.userId]: {
              displayName: trip.user?.displayName || trip.user?.display_name || 'User',
              photoURL: trip.user?.photoURL || trip.user?.photo_url || '',
            },
          },
          unread_count: { [user.id]: 0, [trip.userId]: 0 },
          muted_by: [],
          pinned_by: [],
        }).select('id').single();
        chatId = newChat?.id;
      }

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: chatId,
          otherUserId: trip.userId,
          otherUserName: trip.user?.displayName || 'User',
          otherUserPhoto: trip.user?.photoURL || '',
        }
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

  const handleMessage = async () => {
    if (isOwner && (!trip.participants || trip.participants.length <= 1)) {
      Alert.alert('No Joined Users', 'Wait for someone to join your trip to start chatting!');
      return;
    }
    try {
      // Look up the actual group chat for this trip in group_chats
      const { data: groupChat } = await supabase
        .from('group_chats')
        .select('id')
        .eq('trip_id', tripId)
        .maybeSingle();

      if (!groupChat) {
        Alert.alert('Group Chat', 'No group chat exists for this trip.');
        return;
      }

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: groupChat.id,
          tripTitle: trip?.title,
          tripImage: trip?.coverImage || trip?.images?.[0],
          isGroupChat: 'true',
          collectionName: 'group_chats',
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Could not open group chat.');
    }
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



  // Soft Cancel - Marks as cancelled (stores cancelReason for notification)
  const handleCancelTrip = () => {
    setPendingAction('cancel');
  };

  // Hard Delete - Stores deleteReason in doc before deletion so onTripDeleted trigger can read it
  const handleDeleteTrip = () => {
    setPendingAction('delete');
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
  const collaboratorCount = parsedData.collaborators.length > 0
    ? parsedData.collaborators.length
    : (trip.participants?.length || 1);



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Fixed Header with Back Button + Title + Menu */}
      <SafeAreaView edges={['top']} style={{ zIndex: 100, backgroundColor: colors.background, elevation: 5 }}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.card }]}
            onPress={() => router.back()}
          >
            <Icon name="CaretLeft" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {trip.title}
          </Text>

          {/* Right Side Actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Three Dots Menu for Owner */}
            {isOwner && (
              <View>
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: colors.card }]}
                  onPress={() => setShowMenu(true)}
                  testID="trip-menu-button"
                >
                  <Icon name="DotsThreeVertical" size={24} color={colors.text} />
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
                            router.push({ pathname: '/trip/edit', params: { id: tripId } });
                          }}
                        >
                          <Icon name="PencilSimple" size={20} color={colors.text} />
                          <Text style={[styles.menuText, { color: colors.text }]}>Edit Trip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            setShowMenu(false);
                            handleCancelTrip();
                          }}
                        >
                          <Icon name="XCircle" size={20} color={colors.text} />
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
                          <Icon name="Trash" size={20} color="#EF4444" />
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
                <Icon name="Flag" size={20} color={colors.text} />
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
                    contentFit="contain"
                    transition={200}
                  />
                  {(imageLocations[index] || trip?.toLocation || trip?.location) ? (
                    <View style={styles.imageOverlay}>
                      <View style={styles.overlayLocationRow}>
                        <Icon name="MapPin" size={14} color="#fff" weight="fill" />
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
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
          >

            {/* Creator Row with Message Button */}
            <View style={styles.creatorRow}>
              <TouchableOpacity
                style={styles.creatorInfo}
                onPress={() => router.push({ pathname: '/profile/[id]', params: { id: trip.userId } })}
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
                  <Icon name="ChatTeardropDots" size={20} color="#fff" />
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
          </MotiView>

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
              <Icon name="MapTrifold" size={18} color={colors.primary} />
              <Text style={[styles.compactMapBtnText, { color: colors.primary }]}>Google Maps</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Stats — collaborator count instead of spots left */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 200 }}
            style={[styles.statsRow, { backgroundColor: colors.card }]}
          >
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
              <Text style={[styles.statValue, { color: colors.text }]}>{collaboratorCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>collaborators</Text>
            </View>
          </MotiView>

          {/* Description */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 300 }}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About This Trip</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {trip.description || 'An amazing adventure awaits! Join this trip and create unforgettable memories.'}
            </Text>
          </MotiView>

          {/* Trip Details */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 400 }}
            style={[styles.detailsCard, { backgroundColor: colors.card }]}
          >
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
          </MotiView>

          {/* Full Itinerary — Places grouped by day (View-based timeline, no SVG) */}
          {parsedPlaces.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 500 }}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Full Itinerary</Text>
              {Object.keys(placesByDay).sort((a, b) => Number(a) - Number(b)).map((dayKey) => {
                const day = Number(dayKey);
                const dayPlaces = placesByDay[day];
                return (
                  <View key={`day-${day}`} style={{ marginBottom: SPACING.md }}>
                    <View style={[styles.dayHeader, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.dayHeaderText, { color: colors.primary }]}>Day {day}</Text>
                    </View>
                    {dayPlaces.map((place: any, idx: number) => (
                      <View key={`place-${day}-${idx}`} style={styles.timelineItem}>
                        {/* View-based timeline connector (no SVG) */}
                        <View style={styles.timelineLeft}>
                          <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                          {idx < dayPlaces.length - 1 && (
                            <View style={[styles.timelineLine, { backgroundColor: colors.primary + '40' }]} />
                          )}
                        </View>
                        <View style={[styles.timelineContent, { backgroundColor: colors.card }]}>
                          <Text style={[styles.timelinePlaceName, { color: colors.text }]}>{place.name}</Text>
                          {(place.time || place.address) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                              {place.time ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Icon name="Clock" size={12} color={colors.textSecondary} />
                                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{place.time}</Text>
                                </View>
                              ) : null}
                              {place.address ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <Icon name="MapPin" size={12} color={colors.textSecondary} />
                                  <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{place.address}</Text>
                                </View>
                              ) : null}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </MotiView>
          )}

          {/* Itinerary Timeline (old string-based — fallback) */}
          {(!parsedPlaces.length && trip.itinerary?.length > 0) && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 500 }}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Itinerary</Text>
              {trip.itinerary.map((item: string, idx: number) => (
                <View key={`it-${idx}`} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                    {idx < trip.itinerary.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: colors.primary + '40' }]} />
                    )}
                  </View>
                  <View style={[styles.timelineContent, { backgroundColor: colors.card }]}>
                    <Text style={[styles.timelinePlaceName, { color: colors.text }]}>{item}</Text>
                  </View>
                </View>
              ))}
            </MotiView>
          )}

          {/* Checklist (grouped by category) */}
          {parsedData.checklist.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 600 }}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Checklist</Text>
              {Object.keys(checklistByCategory).map((category) => (
                <View key={`cat-${category}`} style={{ marginBottom: SPACING.md }}>
                  <Text style={[styles.checklistCategoryTitle, { color: colors.primary }]}>{category}</Text>
                  {checklistByCategory[category].map((item: any, idx: number) => (
                    <View key={`check-${idx}`} style={[styles.checklistItem, { backgroundColor: colors.card }]}>
                      <View style={[styles.checkBox, { borderColor: item.checked ? colors.primary : colors.border, backgroundColor: item.checked ? colors.primary : 'transparent' }]}>
                        {item.checked && <Icon name="Check" size={12} color="#fff" weight="bold" />}
                      </View>
                      <Text style={[styles.checklistText, { color: colors.text, textDecorationLine: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.6 : 1 }]}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </MotiView>
          )}

          {/* Notes */}
          {parsedData.notes.length > 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 650 }}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes</Text>
              {parsedData.notes.map((note: any, idx: number) => (
                <View key={`note-${idx}`} style={[styles.noteCard, { backgroundColor: colors.card }]}>
                  {note.title ? (
                    <Text style={[styles.noteTitle, { color: colors.text }]}>{note.title}</Text>
                  ) : null}
                  {note.content ? (
                    <Text style={[styles.noteContent, { color: colors.textSecondary }]}>{note.content}</Text>
                  ) : null}
                </View>
              ))}
            </MotiView>
          )}

          {/* Itinerary MapView */}
          {mapRegion && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 400, delay: 700 }}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Itinerary MapView</Text>
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.mapView}
                  region={mapRegion}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  {parsedPlaces.filter((p: any) => p.latitude && p.longitude).map((place: any, idx: number) => (
                    <Marker
                      key={`marker-${idx}`}
                      coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                      title={place.name}
                      description={place.address || `Day ${place.day || 1}`}
                    />
                  ))}
                </MapView>
              </View>
            </MotiView>
          )}

          {/* Participants / Collaborators */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 800 }}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Collaborators ({collaboratorCount})
            </Text>
            <View style={styles.participantsRow}>
              {participantsData.slice(0, 5).map((participant, i) => (
                <TouchableOpacity
                  key={participant.id}
                  style={[styles.participantAvatar, { marginLeft: i > 0 ? -10 : 0 }]}
                  onPress={() => router.push({ pathname: '/profile/[id]', params: { id: participant.id } })}
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
          </MotiView>


          {/* Spacer for scroll */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Footer Removed (Message button moved to creator row) */}

      {/* Report Trip Modal */}
      <ReportTripModal
        visible={showReportModal}
        trip={trip}
        onClose={() => setShowReportModal(false)}
      />

      <ActionReasonModal
        visible={pendingAction === 'leave'}
        title="Leave Trip"
        subtitle="Tell the host why you are leaving this trip. The reason will be shared with them."
        actionLabel="Leave Trip"
        actionTone="danger"
        reasons={LEAVE_REASONS}
        loading={deleting}
        onClose={() => setPendingAction(null)}
        onSubmit={async (reason) => {
          setDeleting(true);
          try {
            await leaveTrip(tripId, reason);
            queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
            // Trigger sync in background
            require('../database/sync').syncDatabase().catch(() => { });
            setPendingAction(null);
            Alert.alert('Trip Left', 'You have left this trip.');
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Could not leave trip. Please try again.');
          } finally {
            setDeleting(false);
          }
        }}
      />

      <ActionReasonModal
        visible={pendingAction === 'cancel'}
        title="Cancel Trip"
        subtitle="Participants will be notified with your reason and the trip will move to cancelled."
        actionLabel="Cancel Trip"
        actionTone="danger"
        reasons={CANCEL_REASONS}
        loading={deleting}
        onClose={() => setPendingAction(null)}
        onSubmit={async (reason) => {
          setDeleting(true);
          try {
            await cancelTrip(tripId, reason);
            setPendingAction(null);
            Alert.alert('Cancelled', 'Trip has been marked as cancelled.');
            router.back();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to cancel trip.');
          } finally {
            setDeleting(false);
          }
        }}
      />

      <ActionReasonModal
        visible={pendingAction === 'delete'}
        title="Delete Trip"
        subtitle="This permanently removes the trip. Joined travelers will be notified with your reason."
        actionLabel="Delete Permanently"
        actionTone="danger"
        reasons={DELETE_REASONS}
        loading={deleting}
        onClose={() => setPendingAction(null)}
        onSubmit={async (reason) => {
          setDeleting(true);
          try {
            await deleteTrip(tripId, reason);
            setPendingAction(null);
            Alert.alert('Deleted', 'Trip deleted successfully.');
            router.back();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to delete trip.');
          } finally {
            setDeleting(false);
          }
        }}
      />

    </View>
  );
};

const DetailRow = ({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) => (
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
  // Map
  mapContainer: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  mapView: { width: '100%', height: 220 },
  mapPlaceholder: { height: 150, justifyContent: 'center', alignItems: 'center' },
  staticMap: { width: '100%', height: 120, backgroundColor: '#e5e7eb' },
  mapOverlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.sm, gap: SPACING.xs },
  mapText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  mapSubtext: { fontSize: FONT_SIZE.xs },
  viewMapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, gap: SPACING.sm },
  viewMapButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  // Timeline (View-based, no SVG)
  timelineItem: { flexDirection: 'row', marginBottom: 0, minHeight: 52 },
  timelineLeft: { width: 24, alignItems: 'center', marginRight: SPACING.sm },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  timelineContent: { flex: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
  timelinePlaceName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  dayHeader: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, alignSelf: 'flex-start' },
  dayHeaderText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  // Checklist
  checklistCategoryTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.xs },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  checklistText: { fontSize: FONT_SIZE.sm, flex: 1 },
  // Notes
  noteCard: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
  noteTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.xs },
  noteContent: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  // Places
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
