import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import useTrips from '../api/useTrips';
import TripCard from '../components/TripCard';
import { useTheme } from '../contexts/ThemeContext';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';

const MyTripsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { trips, loading } = useTrips();
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [ongoingTrips, setOngoingTrips] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [activeTab, setActiveTab] = useState('Upcoming');

  useEffect(() => {
    if (trips.length > 0) {
      const upcoming = [];
      const ongoing = [];
      const completed = [];
      const now = new Date();

      trips.forEach(trip => {
        const fromDate = new Date(trip.fromDate);
        const toDate = new Date(trip.toDate);

        if (toDate < now) {
          completed.push(trip);
        } else if (fromDate <= now && toDate >= now) {
          ongoing.push(trip);
        } else {
          upcoming.push(trip);
        }
      });

      setUpcomingTrips(upcoming);
      setOngoingTrips(ongoing);
      setCompletedTrips(completed);
    } else {
      setUpcomingTrips([]);
      setOngoingTrips([]);
      setCompletedTrips([]);
    }
  }, [trips]);

  const renderTrip = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={500}>
      <TripCard trip={item} navigation={navigation} />
    </Animatable.View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    switch (activeTab) {
      case 'Upcoming':
        return <FlatList data={upcomingTrips} renderItem={renderTrip} keyExtractor={item => item.id} />;
      case 'Ongoing':
        return <FlatList data={ongoingTrips} renderItem={renderTrip} keyExtractor={item => item.id} />;
      case 'Completed':
        return <FlatList data={completedTrips} renderItem={renderTrip} keyExtractor={item => item.id} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with Create Trip Button */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <Text style={[styles.title, { color: colors.text }]}>My Trips</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateTrip')}
          >
            <Ionicons name="add" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setActiveTab('Upcoming')} style={[styles.tab, activeTab === 'Upcoming' && styles.activeTab]}>
            <Text style={[styles.tabText, { color: activeTab === 'Upcoming' ? colors.primary : colors.textSecondary }]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('Ongoing')} style={[styles.tab, activeTab === 'Ongoing' && styles.activeTab]}>
            <Text style={[styles.tabText, { color: activeTab === 'Ongoing' ? colors.primary : colors.textSecondary }]}>Ongoing</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('Completed')} style={[styles.tab, activeTab === 'Completed' && styles.activeTab]}>
            <Text style={[styles.tabText, { color: activeTab === 'Completed' ? colors.primary : colors.textSecondary }]}>Completed</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {renderContent()}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  createButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 30,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MyTripsScreen;
