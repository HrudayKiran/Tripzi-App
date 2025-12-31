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
              length: width,
              offset: width * index,
              index,
            })}
            onScrollToIndexFailed={() => { }}
          />
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
});

export default SplashScreen;

