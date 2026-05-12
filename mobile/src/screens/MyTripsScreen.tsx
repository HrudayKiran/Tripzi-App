import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';
import { MotiView } from 'moti';
import { supabase } from '../lib/supabase';
import { leaveTrip } from '../utils/tripActions';
import { database } from '../database';
import { syncDatabase } from '../database/sync';
import { Q } from '@nozbe/watermelondb';

import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, NEUTRAL, TOUCH_TARGET } from '../styles';
import AppLogo from '../components/AppLogo';
import { useRouter, useLocalSearchParams } from 'expo-router';
import useMyTripsQuery from '../hooks/useMyTripsQuery';

const MyTripsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { trips: joinedTrips, loading, refetch, userId } = useMyTripsQuery();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Upcoming');

  useEffect(() => {
    const requestedTab = params?.initialTab;
    if (!requestedTab) return;
    const tabKey = String(requestedTab).toLowerCase();
    if (tabKey === 'completed') setActiveTab('Completed');
    if (tabKey === 'ongoing') setActiveTab('Ongoing');
    if (tabKey === 'upcoming') setActiveTab('Upcoming');
    if (tabKey === 'cancelled') setActiveTab('Cancelled');
  }, [params?.initialTab]);



  const handleLeaveTrip = async (tripId: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    Alert.alert(
      'Leave Trip',
      'Are you sure you want to leave this trip?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
            onPress: async () => {
                try {
              await leaveTrip(tripId, 'Plans changed');
              queryClient.invalidateQueries({ queryKey: ['myTrips', userId] });
            } catch {
              Alert.alert('Error', 'Could not leave trip. Please try again.');
            }
          },
        },
      ]
    );
  };


  const filterTrips = () => {
    const now = new Date();
    // Normalize to start of today for date comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return joinedTrips.filter(trip => {
      // Parse dates - handle Firestore Timestamps
      const fromDate = trip.from_date ? new Date(trip.from_date) : (trip.fromDate ? new Date(trip.fromDate) : null);
      const toDate = trip.to_date ? new Date(trip.to_date) : (trip.toDate ? new Date(trip.toDate) : null);

      // Normalize parsed dates to start of day
      const fromDay = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()) : null;
      const toDay = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()) : null;

      if (activeTab === 'Cancelled') {
        return trip.status === 'cancelled' || trip.isCancelled === true;
      }

      // Completed: isCompleted flag OR trip end date has passed (and not cancelled)
      if (activeTab === 'Completed') {
        if (trip.isCompleted === true) return true;
        // Auto-complete: if toDate is in the past and trip isn't cancelled
        if (toDay && toDay < today && trip.status !== 'cancelled' && trip.isCancelled !== true) return true;
        return false;
      }

      // Don't show completed/past-end-date/cancelled trips in other tabs
      if (trip.isCompleted) return false;
      if (toDay && toDay < today) return false;
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
    <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
        style={styles.cardContent}
      >
        <Image
          contentFit="cover"
          transition={200}
          source={{ uri: item.coverImage || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800' }}
          style={styles.tripImage}
        />
        <View style={styles.tripInfo}>
          <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || 'Trip'}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.tripLocation, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.toLocation || item.location || 'Location TBD'}
            </Text>
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.tripDate, { color: colors.textSecondary }]}>
              {item.from_date ? new Date(item.from_date).toLocaleDateString('en-IN') : (item.fromDate ? new Date(item.fromDate).toLocaleDateString('en-IN') : 'Date TBD')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.chevron} />
      </TouchableOpacity>
    </MotiView>
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
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>My Trips</Text>
          <View style={styles.placeholder} />
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
            <TypedFlashList
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
              estimatedItemSize={100}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingTop: 25,
  },
  backButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  placeholder: {
    width: TOUCH_TARGET.min,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
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
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
    alignItems: 'center',
  },
  tripImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
  },
  tripInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    gap: 4,
  },
  tripTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripLocation: {
    fontSize: FONT_SIZE.sm,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripDate: {
    fontSize: FONT_SIZE.xs,
  },
  chevron: {
    marginLeft: SPACING.xs,
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
