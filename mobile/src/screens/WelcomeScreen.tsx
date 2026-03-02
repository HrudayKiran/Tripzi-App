import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, NEUTRAL } from '../styles';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import AppLogo from '../components/AppLogo';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Default fallback images
const DEFAULT_CAROUSEL = [
    { id: '1', title: 'Ladakh', subtitle: 'Ride through the mountains', location: 'Khardung La Pass' },
    { id: '2', title: 'Himalayas', subtitle: 'Touch the clouds', location: 'Valley of Flowers' },
    { id: '3', title: 'Kerala', subtitle: 'Backwater paradise', location: 'Alleppey' },
    { id: '4', title: 'Goa', subtitle: 'Beach vibes', location: 'Palolem Beach' },
    { id: '5', title: 'Rajasthan', subtitle: 'Desert adventures', location: 'Jaisalmer' },
];

const WelcomeScreen = ({ navigation }) => {
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
            const carouselDoc = await firestore().collection('app_config').doc('splash_carousel').get();

            if (carouselDoc.exists) {
                const data = carouselDoc.data();
                if (data?.images && data.images.length > 0) {
                    setCarouselImages(data.images);
                    setIsLoading(false);
                    return;
                }
            }

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
                setCarouselImages(DEFAULT_CAROUSEL.map(item => ({ ...item, image: null })));
            }
        } catch (error) {
            setCarouselImages(DEFAULT_CAROUSEL.map(item => ({ ...item, image: null })));
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-scroll
    useEffect(() => {
        if (carouselImages.length === 0) return;
        const timer = setInterval(() => {
            setActiveIndex((prevIndex) => {
                const nextIndex = (prevIndex + 1) % carouselImages.length;
                flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                return nextIndex;
            });
        }, 4000);
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

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const renderItem = ({ item }) => (
        <View style={styles.slide}>
            {item.image ? (
                <Image source={{ uri: item.image }} style={styles.slideImage} resizeMode="cover" />
            ) : (
                <View style={[styles.slideImage, { backgroundColor: colors.primary }]}>
                    <LinearGradient colors={[...BRAND.gradient]} style={{ flex: 1 }} />
                </View>
            )}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.slideOverlay}
            />
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
                {/* Top Section - Logo */}
                <Animatable.View animation="fadeInDown" style={styles.topSection}>
                    <AppLogo size={80} showDot={true} />
                    <View style={styles.textBlock}>
                        <Text style={[styles.appName, { color: colors.text }]}>Tripzi</Text>
                        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                            Connect. Plan. Travel.
                        </Text>
                    </View>
                </Animatable.View>

                {/* Middle Section - Carousel */}
                <Animatable.View animation="fadeInUp" delay={200} style={styles.carouselSection}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
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
                            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                            onScrollToIndexFailed={() => { }}
                        />
                    )}
                    {/* Pagination Dots */}
                    <View style={styles.pagination}>
                        {carouselImages.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    { backgroundColor: i === activeIndex ? colors.primary : colors.border, width: i === activeIndex ? 20 : 8 }
                                ]}
                            />
                        ))}
                    </View>
                </Animatable.View>

                {/* Bottom Section - Button */}
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
    topSection: {
        height: height * 0.25,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        gap: SPACING.md,
    },
    textBlock: { alignItems: 'center' },
    appName: { fontSize: 36, fontWeight: '800', marginBottom: 4 },
    tagline: { fontSize: FONT_SIZE.sm, letterSpacing: 2, textTransform: 'uppercase' },
    carouselSection: { height: height * 0.55 },
    slide: { width: width, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
    slideImage: { width: '100%', height: '100%', borderRadius: BORDER_RADIUS.xl, overflow: 'hidden' },
    slideOverlay: { position: 'absolute', bottom: 0, left: SPACING.lg, right: SPACING.lg, height: '50%', borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl },
    slideContent: { position: 'absolute', bottom: SPACING.xl, left: SPACING.xl * 1.5, right: SPACING.xl * 1.5 },
    slideTitle: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: NEUTRAL.white, marginBottom: 4 },
    slideSubtitle: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.9)', marginBottom: SPACING.md },
    locationBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    locationText: { fontSize: FONT_SIZE.xs, color: NEUTRAL.white, marginLeft: 4, fontWeight: '600' },
    locationIcon: { fontSize: 12 },
    buttonSection: { height: height * 0.20, justifyContent: 'center', paddingHorizontal: SPACING.xl },
    button: { width: '100%', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl, alignItems: 'center', shadowColor: BRAND.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    buttonText: { color: NEUTRAL.white, fontSize: FONT_SIZE.lg, fontWeight: 'bold' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pagination: { flexDirection: 'row', position: 'absolute', bottom: -20, alignSelf: 'center', gap: 6 },
    dot: { height: 8, borderRadius: 4 },
});

export default WelcomeScreen;
