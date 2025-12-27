
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const TripDetailsScreen = ({ route, navigation }) => {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');
  const { tripId } = route.params;
  const user = auth().currentUser;

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = firestore().collection('trips').doc(tripId).onSnapshot(async (doc) => {
      if (doc.exists) {
        const tripData = { id: doc.id, ...doc.data() };
        if (tripData.userId) {
          const userDoc = await firestore().collection('users').doc(tripData.userId).get();
          if (userDoc.exists) tripData.user = userDoc.data();
        }
        setTrip(tripData);
        if (tripData.participants?.includes(user.uid)) setIsJoined(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [tripId, user.uid]);

  const handleJoinTrip = async () => {
    if (!isJoined) {
      await firestore().collection('trips').doc(tripId).update({
        participants: firestore.FieldValue.arrayUnion(user.uid)
      });
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#8A2BE2" style={styles.centeredContainer} />;
  if (!trip) return <View style={styles.centeredContainer}><Text>Trip not found.</Text></View>;

  const headerImageHeight = scrollY.interpolate({ inputRange: [0, 300], outputRange: [300, 100], extrapolate: 'clamp' });

  const renderContent = () => {
      switch(activeTab){
          case 'Details': return <DetailsTab trip={trip} />;
          case 'Itinerary': return <ItineraryTab trip={trip} />;
          case 'Gallery': return <GalleryTab trip={trip} />;
          default: return null;
      }
  }

  return (
    <View style={styles.container}>
        <Animated.Image style={[styles.headerImage, { height: headerImageHeight }]} source={{ uri: trip.coverImage || 'https://picsum.photos/seed/trip/400/300' }} />
        <ScrollView
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
        >
            <View style={styles.contentContainer}>
                <Animatable.View animation="fadeInUp" delay={200}>
                    <Text style={styles.title}>{trip.title}</Text>
                    <View style={styles.creatorInfo}>
                        <Image style={styles.creatorAvatar} source={{uri: trip.user?.photoURL}}/>
                        <Text style={styles.creatorName}>Created by {trip.user?.displayName}</Text>
                    </View>
                </Animatable.View>

                <View style={styles.tabContainer}>
                    <TabButton title="Details" active={activeTab === 'Details'} onPress={() => setActiveTab('Details')} />
                    <TabButton title="Itinerary" active={activeTab === 'Itinerary'} onPress={() => setActiveTab('Itinerary')} />
                    <TabButton title="Gallery" active={activeTab === 'Gallery'} onPress={() => setActiveTab('Gallery')} />
                </View>
                
                <Animatable.View animation="fadeIn" delay={400}>
                    {renderContent()}
                </Animatable.View>

            </View>
        </ScrollView>
        <Animatable.View animation="slideInUp" style={styles.footer}>
            <TouchableOpacity style={[styles.joinButton, isJoined && styles.joinedButton]} onPress={handleJoinTrip} disabled={isJoined}>
                <Text style={styles.joinButtonText}>{isJoined ? 'You are Going!' : 'Join This Trip'}</Text>
            </TouchableOpacity>
        </Animatable.View>
    </View>
  );
};

const TabButton = ({ title, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.activeTab]}>
        <Text style={[styles.tabText, active && styles.activeTabText]}>{title}</Text>
    </TouchableOpacity>
);

const DetailsTab = ({trip}) => (
    <View>
        <Text style={styles.description}>{trip.description}</Text>
        {/* ... More details ... */}
    </View>
);
const ItineraryTab = ({trip}) => (
    <View>
        {trip.placesToVisit?.map((place, index) => (
            <View key={index} style={styles.itineraryItem}>
                <Ionicons name="flag-outline" size={24} color="#8A2BE2" />
                <Text style={styles.itineraryText}>{place}</Text>
            </View>
        ))}
    </View>
);
const GalleryTab = ({trip}) => (
    <View style={styles.galleryContainer}>
        {/* Mock gallery images */}
        {[...Array(5)].map((_, i) => <Image key={i} style={styles.galleryImage} source={{uri: `https://picsum.photos/seed/${trip.id}_${i}/200/200`}} />)}
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerImage: { width: '100%', position: 'absolute' },
  contentContainer: { paddingTop: 280, padding: 20, backgroundColor: '#f0f2f5' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  creatorInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  creatorName: { fontSize: 16, color: '#666' },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  activeTab: { backgroundColor: '#8A2BE2' },
  tabText: { fontWeight: 'bold', color: '#333' },
  activeTabText: { color: '#fff' },
  description: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  itineraryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itineraryText: { fontSize: 16, marginLeft: 10 },
  galleryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  galleryImage: { width: '48%', height: 150, borderRadius: 10, marginBottom: 10 },
  footer: { padding: 20, borderTopWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  joinButton: { backgroundColor: '#8A2BE2', padding: 15, borderRadius: 30, alignItems: 'center' },
  joinedButton: { backgroundColor: '#ccc' },
  joinButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default TripDetailsScreen;
