
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Animated } from 'react-native';
import TripCard from '../components/TripCard';
import useTrips from '../api/useTrips';
import { Ionicons } from '@expo/vector-icons';

const FeedScreen = ({ navigation }) => {
  const { trips, loading } = useTrips();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const scrollY = useRef(new Animated.Value(0)).current;

  const categories = ['All', 'Adventure', 'Road Trip', 'Train', 'Flight'];

  const filteredTrips = trips.filter(trip => {
    const categoryMatch = activeCategory === 'All' || trip.tripType === activeCategory;
    const searchMatch = 
        trip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trip.location.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const trendingTrips = [...trips].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  if (loading) {
    return <ActivityIndicator size="large" color="#8A2BE2" style={styles.loader} />;
  }

  const headerHeight = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [120, 70],
      extrapolate: 'clamp'
  });

  const searchBarTop = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [70, 20],
      extrapolate: 'clamp'
  })

  return (
    <View style={styles.container}>
        <Animated.View style={[styles.header, { height: headerHeight }]}>
            <Text style={styles.headerTitle}>Explore</Text>
        </Animated.View>
        
        <Animated.View style={[styles.searchContainer, {top: searchBarTop}]}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
                style={styles.searchBar}
                placeholder="Where to?"
                onChangeText={setSearchQuery}
                value={searchQuery}
            />
        </Animated.View>

        <ScrollView 
            onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
        >
            <View style={styles.contentContainer}>
                <Text style={styles.sectionTitle}>Trending Destinations</Text>
                <FlatList 
                    data={trendingTrips}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({item}) => <TripCard trip={item} navigation={navigation} cardStyle={styles.trendingCard} />}
                    keyExtractor={item => item.id}
                />

                <View style={styles.categoriesContainer}>
                    {categories.map(cat => (
                        <TouchableOpacity key={cat} onPress={() => setActiveCategory(cat)} style={[styles.categoryChip, activeCategory === cat && styles.activeCategoryChip]}>
                            <Text style={[styles.categoryText, activeCategory === cat && styles.activeCategoryText]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>All Trips</Text>
                {filteredTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} navigation={navigation} />
                ))}
            </View>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#8A2BE2',
    justifyContent: 'flex-end',
    padding: 20,
  },
  headerTitle: {
      color: '#fff',
      fontSize: 28,
      fontWeight: 'bold',
  },
  searchContainer: {
      position: 'absolute',
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: 30,
      paddingHorizontal: 15,
      elevation: 5,
  },
  searchIcon: {
      marginRight: 10,
  },
  searchBar: {
    flex: 1,
    height: 50,
  },
  contentContainer: {
      paddingTop: 80, // Space for search bar
      paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  trendingCard: {
      width: 280,
      marginRight: 15,
  },
  categoriesContainer: {
      flexDirection: 'row',
      marginVertical: 15,
  },
  categoryChip: {
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 20,
      backgroundColor: '#fff',
      marginRight: 10,
  },
  activeCategoryChip: {
      backgroundColor: '#8A2BE2',
  },
  categoryText: {
      color: '#333',
  },
  activeCategoryText: {
      color: '#fff',
  },
});

export default FeedScreen;
