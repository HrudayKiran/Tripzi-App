import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, FlatList, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { useFocusEffect } from '@react-navigation/native';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';

const { width, height } = Dimensions.get('window');

// Default fallback images (used when Firebase is unavailable)
const DEFAULT_CAROUSEL = [
  { id: '1', title: 'Ladakh', subtitle: 'Ride through the mountains', location: 'Khardung La Pass' },
  { id: '2', title: 'Himalayas', subtitle: 'Touch the clouds', location: 'Valley of Flowers' },
  { id: '3', title: 'Kerala', subtitle: 'Backwater paradise', location: 'Alleppey' },
  { id: '4', title: 'Goa', subtitle: 'Beach vibes', location: 'Palolem Beach' },
  { id: '5', title: 'Rajasthan', subtitle: 'Desert adventures', location: 'Jaisalmer' },
];

const SplashScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselImages, setCarouselImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Load carousel images from Firebase Storage on mount
  useEffect(() => {
    loadCarouselFromFirebase();
  }, []);

  const loadCarouselFromFirebase = async () => {
    try {
      // Try to load carousel config from Firestore
      const carouselDoc = await firestore().collection('app_config').doc('splash_carousel').get();

      if (carouselDoc.exists) {
        const data = carouselDoc.data();
        if (data?.images && data.images.length > 0) {
          setCarouselImages(data.images);
          setIsLoading(false);
          return;
        }
      }

      // Fallback: Try to get images from Storage folder
      const storageRef = storage().ref('carousel');
      const result = await storageRef.listAll();

      if (result.items.length > 0) {
        const imagePromises = result.items.slice(0, 5).map(async (item, index) => {
          const url = await item.getDownloadURL();
          return {
            id: String(index + 1),
            image: url,
            title: DEFAULT_CAROUSEL[index]?.title || `Destination ${index + 1}`,
            subtitle: DEFAULT_CAROUSEL[index]?.subtitle || 'Explore with Tripzi',
            location: DEFAULT_CAROUSEL[index]?.location || 'India',
          };
        });

        const images = await Promise.all(imagePromises);
        setCarouselImages(images);
      } else {
        // Use default carousel without images
        setCarouselImages(DEFAULT_CAROUSEL.map(item => ({
          ...item,
          image: null // Will show a gradient or placeholder
        })));
      }
    } catch (error) {

      // Fallback to defaults without images
      setCarouselImages(DEFAULT_CAROUSEL.map(item => ({
        ...item,
        image: null
      })));
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll carousel
  useEffect(() => {
    if (carouselImages.length === 0) return;

    const timer = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % carouselImages.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [carouselImages]);

  const handleNext = () => {
    navigation.navigate('Start');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.slideImage} resizeMode="cover" />
      ) : (
        <View style={[styles.slideImage, { backgroundColor: colors.primary }]} />
      )}
      <View style={styles.slideOverlay} />
      <View style={styles.slideContent}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
        <View style={styles.locationBadge}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Top Section - Logo, Name, Tagline (30% of screen) */}
        <Animatable.View animation="fadeInDown" style={styles.topSection}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          <Text style={[styles.appName, { color: colors.text }]}>Tripzi</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Explore the world, <Text style={{ color: colors.primary, fontWeight: '700' }}>not alone</Text>
          </Text>
        </Animatable.View>

        {/* Middle Section - Carousel (60% of screen) */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.carouselSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading destinations...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={carouselImages}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onScrollToIndexFailed={() => { }}
            />
          )}
        </Animatable.View>

        {/* Bottom Section - Button (10% of screen) */}
        <Animatable.View animation="fadeInUp" delay={400} style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Join the Journey</Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  // Top section - 20% for logo, name, tagline
  topSection: {
    height: height * 0.20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  logoImage: { width: 80, height: 80, borderRadius: BORDER_RADIUS.xl, marginBottom: SPACING.md },
  appName: { fontSize: 42, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  tagline: { fontSize: FONT_SIZE.md },
  // Middle section - 60% for carousel
  carouselSection: {
    height: height * 0.60,
  },
  slide: {
    width: width,
    height: height * 0.60,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  slideContent: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  slideTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
    marginBottom: SPACING.xs,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  slideSubtitle: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.sm,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.xl,
    alignSelf: 'flex-start',
  },
  locationIcon: { marginRight: SPACING.xs },
  locationText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: '#333' },
  // Bottom section - 20% for button
  buttonSection: {
    height: height * 0.20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  button: { width: '100%', paddingVertical: SPACING.xl, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZE.sm },
});

export default SplashScreen;

