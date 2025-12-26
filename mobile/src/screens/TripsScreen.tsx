import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import useTrips from '../api/useTrips';
import TripCard from '../components/TripCard';
import { filterBookings } from '../utils/filterBookings';

const TripsScreen = () => {
  const { bookings, loading } = useTrips();
  const [filter, setFilter] = useState('upcoming');

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 50 }} />;
    }

    const filteredData = filterBookings(bookings, filter);

    if (filteredData.length === 0) {
      return <Text style={styles.emptyText}>No {filter} trips found.</Text>;
    }

    return (
      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TripCard booking={item} onPress={() => {}} />}
        contentContainerStyle={styles.listContainer}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, filter === 'upcoming' && styles.activeTab]} onPress={() => setFilter('upcoming')}>
          <Text style={[styles.tabText, filter === 'upcoming' && styles.activeTabText]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'active' && styles.activeTab]} onPress={() => setFilter('active')}>
          <Text style={[styles.tabText, filter === 'active' && styles.activeTabText]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filter === 'completed' && styles.activeTab]} onPress={() => setFilter('completed')}>
          <Text style={[styles.tabText, filter === 'completed' && styles.activeTabText]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Gray-100
  },
  header: {
    backgroundColor: '#1D4ED8', // Blue-700
    padding: 16,
    paddingTop: 40, // Adjust for status bar
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1D4ED8', // Blue-700
  },
  tabText: {
    fontSize: 16,
    color: '#6B7280', // Gray-500
  },
  activeTabText: {
    color: '#1D4ED8', // Blue-700
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6B7280', // Gray-500
  },
});

export default TripsScreen;
