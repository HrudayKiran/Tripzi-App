import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

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
    navigation.replace('Start');
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
      <View style={styles.locationBadge}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationText}>{item.location}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Carousel */}
        <View style={styles.carouselContainer}>
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
              length: width - SPACING.xxl * 2,
              offset: (width - SPACING.xxl * 2) * index,
              index,
            })}
            onScrollToIndexFailed={() => { }}
          />

          {/* Info */}
          <Animatable.View animation="fadeIn" key={activeIndex} style={styles.infoContainer}>
            <Text style={[styles.title, { color: colors.text }]}>
              {CAROUSEL_IMAGES[activeIndex]?.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {CAROUSEL_IMAGES[activeIndex]?.subtitle}
            </Text>
          </Animatable.View>

          {/* Dots */}
          <View style={styles.dotsContainer}>
            {CAROUSEL_IMAGES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? colors.primary : colors.border,
                    width: index === activeIndex ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Bottom */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.bottomSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>🚀</Text>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Tripzi</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Explore the world, <Text style={{ color: colors.primary, fontWeight: '700' }}>not alone</Text>
          </Text>
          <Text style={[styles.joinText, { color: colors.textSecondary }]}>JOIN THE JOURNEY</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.xxl },
  carouselContainer: { height: height * 0.5 },
  slide: {
    width: width - SPACING.xxl * 2,
    height: height * 0.38,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  locationBadge: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
  },
  locationIcon: { marginRight: SPACING.xs },
  locationText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: '#333' },
  infoContainer: { alignItems: 'center', marginTop: SPACING.lg },
  title: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONT_SIZE.sm },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md, gap: SPACING.sm },
  dot: { height: 8, borderRadius: 4 },
  bottomSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBox: { width: 56, height: 56, borderRadius: BORDER_RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  logoEmoji: { fontSize: 28 },
  appName: { fontSize: 38, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  tagline: { fontSize: FONT_SIZE.md, marginBottom: SPACING.xs },
  joinText: { fontSize: FONT_SIZE.xs, letterSpacing: 2, marginBottom: SPACING.xl },
  button: { width: '100%', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default SplashScreen;
