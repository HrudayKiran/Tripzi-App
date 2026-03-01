import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Animatable from 'react-native-animatable';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import AppLogo from '../components/AppLogo';
import { useFocusEffect } from '@react-navigation/native';

const MyTripsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Upcoming');

  useEffect(() => {
    const requestedTab = route?.params?.initialTab;
    if (!requestedTab) return;
    const tabKey = String(requestedTab).toLowerCase();
    if (tabKey === 'completed') setActiveTab('Completed');
    if (tabKey === 'ongoing') setActiveTab('Ongoing');
    if (tabKey === 'upcoming') setActiveTab('Upcoming');
    if (tabKey === 'cancelled') setActiveTab('Cancelled');
  }, [route?.params?.initialTab]);

  useFocusEffect(
    React.useCallback(() => {
      const currentUser = auth().currentUser;

      if (!currentUser?.uid) {
        setJoinedTrips([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Real-time listener for joined trips
      const unsubscribe = firestore()
        .collection('trips')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot(
          snapshot => {
            const trips = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setJoinedTrips(trips);
            setLoading(false);
            setRefreshing(false);
          },
          () => {
            setLoading(false);
            setRefreshing(false);
          }
        );

      return () => unsubscribe();
    }, [])
  );

  const handleLeaveTrip = async (tripId: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      await firestore().collection('trips').doc(tripId).update({
        participants: firestore.FieldValue.arrayRemove(currentUser.uid),
        currentTravelers: firestore.FieldValue.increment(-1),
      });
      setJoinedTrips(prev => prev.filter(trip => trip.id !== tripId));
    } catch {
      // Leave trip operation failed
    }
  };


  const filterTrips = () => {
    const now = new Date();
    // Normalize to start of today for date comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return joinedTrips.filter(trip => {
      // Parse dates - handle Firestore Timestamps
      const fromDate = trip.fromDate?.toDate ? trip.fromDate.toDate() :
        trip.fromDate ? new Date(trip.fromDate) : null;
      const toDate = trip.toDate?.toDate ? trip.toDate.toDate() :
        trip.toDate ? new Date(trip.toDate) : null;

      // Normalize parsed dates to start of day
      const fromDay = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()) : null;
      const toDay = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()) : null;

      if (activeTab === 'Cancelled') {
        return trip.status === 'cancelled' || trip.isCancelled === true;
      }

      // Completed: Only when owner has marked the trip as completed
      if (activeTab === 'Completed') {
        return trip.isCompleted === true;
      }

      // Don't show completed/cancelled trips in other tabs
      if (trip.isCompleted) return false;
      if (trip.status === 'cancelled' || trip.isCancelled === true) return false;

      if (activeTab === 'Upcoming') {
        // Upcoming: start date is in future OR no dates set
        return !fromDay || fromDay > today;
      } else if (activeTab === 'Ongoing') {
        // Ongoing: today is between start and end dates (inclusive)
        return fromDay && toDay && fromDay <= today && toDay >= today;
      }
      return false;
    });
  };

  const filteredTrips = filterTrips();

  const renderTripCard = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={400} style={[styles.tripCard, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
        style={styles.cardContent}
      >
        <Image
          source={{ uri: item.coverImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800' }}
          style={styles.tripImage}
        />
        <View style={styles.tripInfo}>
          <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || 'Trip'}
          </Text>
          <Text style={[styles.tripLocation, { color: colors.textSecondary }]} numberOfLines={1}>
            📍 {item.toLocation || item.location || 'Location TBD'}
          </Text>
          <Text style={[styles.tripDate, { color: colors.textSecondary }]}>
            📅 {item.fromDate ? (
              item.fromDate.toDate ? item.fromDate.toDate().toLocaleDateString() : new Date(item.fromDate).toLocaleDateString()
            ) : 'Date TBD'}
          </Text>
        </View>
      </TouchableOpacity>

    </Animatable.View >
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <AppLogo size={60} showDot={false} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No {activeTab} Trips</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {activeTab === 'Upcoming'
          ? 'Join some trips from the feed to see them here!'
          : activeTab === 'Cancelled'
            ? 'Cancelled trips will appear here.'
            : 'Your completed trips will appear here.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header - No plus button */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Text style={[styles.title, { color: colors.text }]}>My Trips</Text>
        </View>

        {/* Tabs - Upcoming, Ongoing, Completed, Cancelled */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('Upcoming')}
            style={[
              styles.tab,
              activeTab === 'Upcoming' && [styles.activeTab, { backgroundColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'Upcoming' ? '#fff' : colors.textSecondary }
            ]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('Ongoing')}
            style={[
              styles.tab,
              activeTab === 'Ongoing' && [styles.activeTab, { backgroundColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'Ongoing' ? '#fff' : colors.textSecondary }
            ]}>
              Ongoing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('Completed')}
            style={[
              styles.tab,
              activeTab === 'Completed' && [styles.activeTab, { backgroundColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'Completed' ? '#fff' : colors.textSecondary }
            ]}>
              Completed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('Cancelled')}
            style={[
              styles.tab,
              activeTab === 'Cancelled' && [styles.activeTab, { backgroundColor: colors.primary }]
            ]}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'Cancelled' ? '#fff' : colors.textSecondary }
            ]}>
              Cancelled
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading trips...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTrips}
              renderItem={renderTripCard}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => setRefreshing(true)}
                  colors={[colors.primary]}
                />
              }
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
  },
  contentContainer: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZE.sm },
  tripCard: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  tripImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
  },
  tripInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  tripTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.xs,
  },
  tripLocation: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xs,
  },
  tripDate: {
    fontSize: FONT_SIZE.xs,
  },
  toggleSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.xxxl * 2,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  emptyIconImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default MyTripsScreen;
