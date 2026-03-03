import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, NEUTRAL } from '../styles';

const { width } = Dimensions.get('window');

// ─── Destination data with Unsplash images ──────────────────────────
const DESTINATIONS = [
    { name: 'Manali', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600', tag: '🏔️ Mountains' },
    { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600', tag: '🏖️ Beach' },
    { name: 'Jaipur', image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600', tag: '🏰 Heritage' },
    { name: 'Leh Ladakh', image: 'https://images.unsplash.com/photo-1623073284788-0d846f75e329?w=600', tag: '🏍️ Road Trip' },
    { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600', tag: '🌴 Backwaters' },
    { name: 'Varanasi', image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600', tag: '🛕 Spiritual' },
    { name: 'Rishikesh', image: 'https://images.unsplash.com/photo-1588083949404-c4f1ed1323b3?w=600', tag: '🧘 Adventure' },
    { name: 'Udaipur', image: 'https://images.unsplash.com/photo-1602301346610-ee4fd5a3e3f0?w=600', tag: '🏛️ Lakes' },
];

const SEASONAL_SUGGESTIONS = [
    { icon: '🌤️', title: 'This Weekend', subtitle: 'Quick getaway', prompt: 'Plan a weekend trip near my city' },
    { icon: '📅', title: 'Month End', subtitle: '3-4 day escape', prompt: 'Plan a 3-4 day trip for this month end' },
    { icon: '🌸', title: 'This Season', subtitle: 'Seasonal best', prompt: 'Suggest the best destination to visit this season in India' },
    { icon: '✈️', title: 'Long Vacation', subtitle: 'Week-long trip', prompt: 'Plan a week-long vacation with detailed itinerary' },
];

const AIPlannerScreen = ({ navigation }: any) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const scrollX = useRef(new Animated.Value(0)).current;

    // Auto-scroll destinations
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                const next = (prev + 1) % DESTINATIONS.length;
                flatListRef.current?.scrollToIndex({ index: next, animated: true });
                return next;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const openChat = (initialPrompt?: string) => {
        navigation.navigate('AIChat', { initialPrompt });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Hero Section with Auto-Scrolling Destinations */}
                <View style={styles.heroSection}>
                    <FlatList
                        ref={flatListRef}
                        data={DESTINATIONS}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                            { useNativeDriver: false }
                        )}
                        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                        keyExtractor={(item) => item.name}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => openChat(`Plan a trip to ${item.name}`)}
                                style={{ width }}
                            >
                                <Image source={{ uri: item.image }} style={styles.heroImage} />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View style={[styles.heroOverlay, { paddingTop: insets.top + SPACING.lg }]}>
                                    <View style={styles.heroHeader}>
                                        <View style={styles.heroAvatarWrap}>
                                            <Image source={require('../../assets/Tripzi AI.png')} style={styles.heroAvatar} />
                                        </View>
                                        <View>
                                            <Text style={styles.heroLabel}>Tripzi AI</Text>
                                            <Text style={styles.heroSublabel}>Your Travel Assistant</Text>
                                        </View>
                                    </View>
                                    <View style={styles.heroBottom}>
                                        <Text style={styles.heroTag}>{item.tag}</Text>
                                        <Text style={styles.heroTitle}>{item.name}</Text>
                                        <Text style={styles.heroSubtitle}>Tap to plan a trip here →</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                    {/* Dots indicator */}
                    <View style={styles.dotsContainer}>
                        {DESTINATIONS.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    { backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)' },
                                ]}
                            />
                        ))}
                    </View>
                </View>

                {/* Seasonal Suggestions */}
                <Animatable.View animation="fadeInUp" delay={200} duration={500}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Where to next? ✨</Text>
                    <View style={styles.seasonGrid}>
                        {SEASONAL_SUGGESTIONS.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.seasonCard, { backgroundColor: colors.card }]}
                                activeOpacity={0.7}
                                onPress={() => openChat(item.prompt)}
                            >
                                <Text style={styles.seasonIcon}>{item.icon}</Text>
                                <Text style={[styles.seasonTitle, { color: colors.text }]}>{item.title}</Text>
                                <Text style={[styles.seasonSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animatable.View>

                {/* Main CTA Button */}
                <Animatable.View animation="fadeInUp" delay={400} duration={500} style={styles.ctaSection}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openChat()}
                    >
                        <LinearGradient
                            colors={['#9d74f7', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.ctaButton}
                        >
                            <View style={styles.ctaIconWrap}>
                                <Image source={require('../../assets/Tripzi AI.png')} style={styles.ctaIcon} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.ctaTitle}>Plan & Create Trip Cards</Text>
                                <Text style={styles.ctaSubtitle}>Chat with Tripzi AI to plan your perfect trip</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={22} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animatable.View>

                {/* Popular Destinations Grid */}
                <Animatable.View animation="fadeInUp" delay={600} duration={500}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Destinations 🗺️</Text>
                    <View style={styles.destGrid}>
                        {DESTINATIONS.map((dest, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.destCard}
                                activeOpacity={0.8}
                                onPress={() => openChat(`Plan a trip to ${dest.name}`)}
                            >
                                <Image source={{ uri: dest.image }} style={styles.destImage} />
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                                    style={[StyleSheet.absoluteFill, { borderRadius: BORDER_RADIUS.md }]}
                                />
                                <View style={styles.destOverlay}>
                                    <Text style={styles.destTag}>{dest.tag}</Text>
                                    <Text style={styles.destName}>{dest.name}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animatable.View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Hero
    heroSection: { height: 300 },
    heroImage: { width: width, height: 300, resizeMode: 'cover' },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        padding: SPACING.lg,
    },
    heroHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    heroAvatarWrap: {
        width: 36, height: 36, borderRadius: 18,
        overflow: 'hidden', backgroundColor: '#fff', elevation: 2,
    },
    heroAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroLabel: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    heroSublabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
    heroBottom: { gap: 4 },
    heroTag: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
    heroTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
    heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: FONT_SIZE.sm },
    dotsContainer: {
        position: 'absolute', bottom: 12,
        flexDirection: 'row', alignSelf: 'center', gap: 6,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },

    // Sections
    sectionTitle: {
        fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold,
        marginHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.md,
    },

    // Seasonal Grid
    seasonGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: SPACING.md, gap: SPACING.sm,
    },
    seasonCard: {
        width: (width - SPACING.md * 2 - SPACING.sm) / 2,
        padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
        alignItems: 'center', gap: 4, elevation: 1,
    },
    seasonIcon: { fontSize: 28 },
    seasonTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    seasonSubtitle: { fontSize: 11 },

    // CTA
    ctaSection: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
    ctaButton: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    ctaIconWrap: {
        width: 44, height: 44, borderRadius: 22,
        overflow: 'hidden', backgroundColor: '#fff',
    },
    ctaIcon: { width: '100%', height: '100%', resizeMode: 'cover' },
    ctaTitle: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    ctaSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

    // Destinations Grid
    destGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: SPACING.md, gap: SPACING.sm,
    },
    destCard: {
        width: (width - SPACING.md * 2 - SPACING.sm) / 2,
        height: 130, borderRadius: BORDER_RADIUS.md, overflow: 'hidden',
    },
    destImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    destOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: SPACING.sm,
    },
    destTag: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
    destName: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default AIPlannerScreen;
