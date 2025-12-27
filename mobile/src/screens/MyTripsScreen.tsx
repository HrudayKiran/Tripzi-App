
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import TripCard from '../components/TripCard';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

const MyTripsScreen = ({ navigation }) => {
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [ongoingTrips, setOngoingTrips] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [activeTab, setActiveTab] = useState('Upcoming');

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('trips')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot((querySnapshot) => {
        const upcoming = [];
        const ongoing = [];
        const completed = [];
        const now = new Date();

        querySnapshot.forEach(doc => {
            const trip = { id: doc.id, ...doc.data() };
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
      });

    return () => unsubscribe();
  }, []);

  const renderTrip = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={500}>
      <TripCard trip={item} navigation={navigation} />
    </Animatable.View>
  );

  const renderContent = () => {
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
    <View style={styles.container}>
      <Text style={styles.title}>My Trips</Text>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity onPress={() => setActiveTab('Upcoming')} style={[styles.tab, activeTab === 'Upcoming' && styles.activeTab]}>
          <Text style={styles.tabText}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('Ongoing')} style={[styles.tab, activeTab === 'Ongoing' && styles.activeTab]}>
          <Text style={styles.tabText}>Ongoing</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('Completed')} style={[styles.tab, activeTab === 'Completed' && styles.activeTab]}>
          <Text style={styles.tabText}>Completed</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f0f2f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 40,
    textAlign: 'center',
    color: '#333'
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 10,
    marginBottom: 20,
    elevation: 2,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#8A2BE2',
  },
  tabText: {
    fontWeight: 'bold',
    color: '#333'
  },
  contentContainer: {
    flex: 1,
  },
});

export default MyTripsScreen;
