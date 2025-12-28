import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import CustomToggle from '../components/CustomToggle';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { useFocusEffect } from '@react-navigation/native';

const MyTripsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [joinedTrips, setJoinedTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Upcoming');

  // Re-fetch when screen is focused (to catch auth changes)
  useFocusEffect(
    React.useCallback(() => {
      const currentUser = auth.currentUser;
      console.log('MyTrips - currentUser:', currentUser?.uid);

      if (!currentUser) {
        console.log('MyTrips - No user logged in');
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
            console.log('MyTrips - Found trips:', snapshot.docs.length);
            const trips = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            }));
            setJoinedTrips(trips);
            setLoading(false);
            setRefreshing(false);
          },
          error => {
            console.log('MyTrips - Error:', error);
            setLoading(false);
            setRefreshing(false);
          }
        );

      return () => unsubscribe();
    }, [])
  );

  const handleLeaveTrip = async (tripId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await firestore().collection('trips').doc(tripId).update({
        participants: firestore.FieldValue.arrayRemove(currentUser.uid),
        currentTravelers: firestore.FieldValue.increment(-1),
      });
      // Remove from local state immediately
      setJoinedTrips(prev => prev.filter(trip => trip.id !== tripId));
    } catch (error) {
      console.log('Leave trip error:', error);
    }
  };

  const filterTrips = () => {
    const now = new Date();
    return joinedTrips.filter(trip => {
      const fromDate = trip.fromDate ? new Date(trip.fromDate) : null;
      const toDate = trip.toDate ? new Date(trip.toDate) : null;

      if (activeTab === 'Upcoming') {
        return !fromDate || fromDate > now;
      } else if (activeTab === 'Ongoing') {
        return fromDate && toDate && fromDate <= now && toDate >= now;
      } else {
        return toDate && toDate < now;
      }
    });
  };

  const filteredTrips = filterTrips();

  const renderTripCard = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={400} style={[styles.tripCard, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        onPress={() => navigation.navigate('TripDetails', { trip: item })}
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
            📅 {item.fromDate ? new Date(item.fromDate).toLocaleDateString() : 'Date TBD'}
          </Text>
        </View>
      </TouchableOpacity>
      {activeTab === 'Upcoming' && (
        <View style={styles.toggleSection}>
          <CustomToggle
            value={true}
            onValueChange={() => handleLeaveTrip(item.id)}
            onLabel="Joined"
            offLabel="Leave"
            size="medium"
          />
        </View>
      )}
    </Animatable.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="airplane-outline" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No {activeTab} Trips</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {activeTab === 'Upcoming'
          ? 'Join some trips from the feed to see them here!'
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

        {/* Tabs - Upcoming, Ongoing, Completed */}
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
