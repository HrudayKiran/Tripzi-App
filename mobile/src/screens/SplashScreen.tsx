import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, FlatList, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const CAROUSEL_IMAGES = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    title: 'Ladakh',
    subtitle: 'Ride through the mountains',
    location: 'Khardung La Pass',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=800&q=80',
    title: 'Himalayas',
    subtitle: 'Touch the clouds',
    location: 'Valley of Flowers',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
    title: 'Kerala',
    subtitle: 'Backwater paradise',
    location: 'Alleppey',
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
    title: 'Goa',
    subtitle: 'Beach vibes',
    location: 'Palolem Beach',
  },
  {
    id: '5',
    image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=80',
    title: 'Rajasthan',
    subtitle: 'Desert adventures',
    location: 'Jaisalmer',
  },
];

const SplashScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % CAROUSEL_IMAGES.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

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
      <Image source={{ uri: item.image }} style={styles.slideImage} resizeMode="cover" />
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
        {/* Top Section - Logo, Name, Tagline */}
        <Animatable.View animation="fadeInDown" style={styles.topSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>🚀</Text>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Tripzi</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Explore the world, <Text style={{ color: colors.primary, fontWeight: '700' }}>not alone</Text>
          </Text>
        </Animatable.View>

        {/* Bottom Section - Carousel & Button */}
        <View style={styles.bottomSection}>
          {/* Carousel */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.carouselContainer}>
            <FlatList
              ref={flatListRef}
              data={CAROUSEL_IMAGES}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: width - SPACING.xl * 2,
                offset: (width - SPACING.xl * 2) * index,
                index,
              })}
              onScrollToIndexFailed={() => { }}
            />
          </Animatable.View>

          {/* Get Started Button */}
          <Animatable.View animation="fadeInUp" delay={400} style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Join the Journey</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.xl },
  topSection: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoEmoji: { fontSize: 32 },
  appName: { fontSize: 42, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  tagline: { fontSize: FONT_SIZE.md },
  bottomSection: { flex: 1, justifyContent: 'space-between' },
  carouselContainer: { flex: 1 },
  slide: {
    width: width - SPACING.xl * 2,
    height: height * 0.52,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
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
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg, gap: SPACING.sm },
  dot: { height: 8, borderRadius: 4 },
  buttonContainer: { alignItems: 'center', paddingBottom: SPACING.lg },
  joinText: { fontSize: FONT_SIZE.xs, letterSpacing: 2, marginBottom: SPACING.md },
  button: { width: '100%', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default SplashScreen;
