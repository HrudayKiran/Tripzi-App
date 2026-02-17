import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, FlatList, TextInput, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../styles/constants';
import { aiService, AIMessage } from '../services/AIService';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

const AIChatScreen = ({ navigation }: any) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        // Initial Greeting
        setMessages([
            {
                _id: 1,
                text: "Hi! I'm Tripzi AI. 🤖\n\nI can act as your personal travel consultant. Tell me where you want to go, and I'll ask you for details to create the perfect trip plan!\n\nTry: \"Plan a trip to Coorg\"",
                createdAt: new Date(),
                user: {
                    _id: 'tripzi-ai',
                    name: 'Tripzi AI',
                },
            },
        ]);
    }, []);

    const [isAgeVerified, setIsAgeVerified] = useState<boolean | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    useEffect(() => {
        const checkAgeVerification = async () => {
            const user = auth().currentUser;
            if (!user) return;

            try {
                const userDoc = await firestore().collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    setIsAgeVerified(userDoc.data()?.ageVerified === true);
                } else {
                    setIsAgeVerified(false);
                }
            } catch (error) {

                setIsAgeVerified(false);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        const unsubscribe = navigation.addListener('focus', checkAgeVerification);
        checkAgeVerification(); // Also check on mount
        return unsubscribe;
    }, [navigation]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMsg: AIMessage = {
            _id: Math.round(Math.random() * 1000000),
            text: inputText.trim(),
            createdAt: new Date(),
            user: { _id: 'user', name: 'User' },
        };

        setMessages(prev => [userMsg, ...prev]);
        setInputText('');
        setIsTyping(true);

        try {
            const responses = await aiService.sendMessage(userMsg.text, messages); // Pass history
            const newAiMessages = responses.reverse();
            setMessages(prev => [...newAiMessages, ...prev]);
        } catch (error) {

            Alert.alert("Error", "Failed to connect to AI. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    if (isLoadingProfile) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isAgeVerified === false) {
        return (
            <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl }]}>
                <LinearGradient
                    colors={[colors.background, colors.card]}
                    style={StyleSheet.absoluteFill}
                />
                <View style={{
                    width: 120, height: 120, borderRadius: 60, backgroundColor: colors.card,
                    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl, elevation: 4
                }}>
                    <Ionicons name="lock-closed" size={60} color={colors.primary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.text, textAlign: 'center', marginBottom: SPACING.md }]}>
                    Age Verification Required
                </Text>
                <Text style={[styles.messageText, { color: colors.textSecondary, textAlign: 'center', marginBottom: SPACING.xxl }]}>
                    To use the AI Trip Planner and ensure a safe community, we need to verify your age first.
                </Text>
                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary, paddingHorizontal: SPACING.xxl, height: 50, justifyContent: 'center' }]}
                    onPress={() => navigation.navigate('AgeVerification')}
                >
                    <Text style={[styles.createButtonText, { fontSize: FONT_SIZE.md }]}>Verify Age Now</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleQuickReply = (text: string) => {
        setInputText(text);
    };


    const handleCreateTrip = (tripData: any) => {
        navigation.navigate('CreateTrip', { initialTripData: tripData });
    };

    const handleAutoPostTrip = async (trip: any) => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Error', 'Please login to post a trip.');
            return;
        }

        Alert.alert(
            "Post with AI? 🤖",
            "I'll automatically create this trip and post it to your profile.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Review & Post",
                    onPress: async () => {
                        try {
                            // Prepare image URLs using LoremFlickr (Stock photos)
                            const imageKeywords = trip.imageKeywords || [];
                            const mainKeyword = imageKeywords[0] || trip.toLocation;

                            // Helper to generate URL - use specific keywords
                            // key is to use simple terms. 
                            const getImageUrl = (keyword: string) => {
                                const cleanKeyword = keyword.split(',')[0].trim(); // Take first word if comma separated
                                return `https://loremflickr.com/800/600/${encodeURIComponent(cleanKeyword)}/all`;
                            };

                            const coverImageUri = getImageUrl(mainKeyword);
                            const finalImages = imageKeywords.length > 0
                                ? imageKeywords.map((k: string) => getImageUrl(k))
                                : [coverImageUri];

                            // Construct Trip Data with STRICT mapping
                            const tripData = {
                                title: trip.title,
                                images: finalImages,
                                imageLocations: imageKeywords, // Save keywords as "locations" for reference
                                fromLocation: trip.fromLocation || 'Unknown',
                                toLocation: trip.toLocation,
                                mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.toLocation)}`,
                                fromDate: firestore.Timestamp.now(), // Default to now (AI doesn't give specific dates usually)
                                toDate: firestore.Timestamp.fromMillis(Date.now() + (trip.durationDays || 3) * 24 * 60 * 60 * 1000),
                                duration: `${trip.durationDays || 3} days`,
                                tripTypes: [trip.tripType || 'adventure'],
                                transportModes: [trip.transportMode || 'mixed'], // New Field
                                costPerPerson: trip.cost || 0,
                                totalCost: trip.cost || 0,
                                cost: trip.cost || 0,
                                accommodationType: trip.accommodationType || 'hotel', // New Field
                                bookingStatus: 'to_book',
                                accommodationDays: trip.durationDays || 3,
                                maxTravelers: trip.maxTravelers || 5, // New Field
                                currentTravelers: 1,
                                genderPreference: 'anyone',
                                description: trip.description,
                                mandatoryItems: trip.mandatoryItems || [], // New Field
                                placesToVisit: trip.placesToVisit || [],
                                userId: currentUser.uid,
                                participants: [currentUser.uid],
                                likes: [],
                                createdAt: firestore.FieldValue.serverTimestamp(),
                                location: trip.toLocation,
                                tripType: trip.tripType || 'adventure',
                                coverImage: finalImages[0],
                            };

                            // Save to Firestore
                            const tripRef = await firestore().collection('trips').add(tripData);

                            // Create Group Chat
                            await firestore().collection('chats').doc(`trip_${tripRef.id}`).set({
                                type: 'group',
                                tripId: tripRef.id,
                                tripTitle: trip.title,
                                participants: [currentUser.uid],
                                createdBy: currentUser.uid,
                                createdAt: firestore.FieldValue.serverTimestamp(),
                                lastMessage: 'Trip information posted by AI!',
                                lastMessageTime: firestore.FieldValue.serverTimestamp(),
                            });

                            // Notify User
                            const successMsg: AIMessage = {
                                _id: Math.round(Math.random() * 1000000),
                                text: `Done! 🎉 I've posted "${trip.title}" to your profile.\n\nGo check it out in your profile!`,
                                createdAt: new Date(),
                                user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                            };
                            setMessages(prev => [successMsg, ...prev]);

                        } catch (error: any) {

                            Alert.alert("Error", "Failed to auto-post trip. Please try 'Edit & Post' instead.");
                        }
                    }
                }
            ]
        );
    };

    const renderTripCard = (jsonString: string) => {
        try {
            // ROBUST JSON EXTRACTION:
            let potentialJson = '';

            // 1. Try to find JSON inside code blocks first ```json ... ```
            const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = jsonString.match(codeBlockRegex);

            if (match && match[1]) {
                potentialJson = match[1];
            } else {
                // 2. Fallback: Find first '{' and last '}'
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace === -1 || lastBrace === -1) return null;
                potentialJson = jsonString.substring(firstBrace, lastBrace + 1);
            }

            // Remove control characters that might break JSON (newlines, tabs in wrong places)
            // But we need to keep spaces.
            // A simple approach is just to parse.

            const trip = JSON.parse(potentialJson);

            if (trip.type !== 'trip_plan') return null;

            // Normalize Description if Itinerary exists
            if (trip.itinerary && Array.isArray(trip.itinerary)) {
                trip.description = trip.description + "\n\n" + trip.itinerary.join("\n");
            }

            // Generate Image URLs using LoremFlickr handling
            // We use keywords if available (from new prompt), else check imagePrompts (legacy), else location
            const keywords = trip.imageKeywords || trip.imagePrompts || [];
            const mainKeyword = keywords[0] || trip.toLocation;

            // Helper to generate URL - use specific keywords
            // key is to use simple terms. 
            const getImageUrl = (keyword: string) => {
                // Take first 2 words max to be specific but not too long
                const cleanKeyword = keyword.split(',')[0].trim().split(' ').slice(0, 2).join(' ');
                return `https://loremflickr.com/800/600/${encodeURIComponent(cleanKeyword)}/all`;
            };

            const coverImageUri = getImageUrl(mainKeyword);

            return (
                <Animatable.View animation="fadeInUp" style={[styles.tripCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                    {/* Dynamic AI Cover Image */}
                    <View style={{ height: 120, width: '100%', backgroundColor: colors.border }}>
                        <Image
                            source={{ uri: coverImageUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={[styles.tripCardBadge, { position: 'absolute', top: 8, right: 8 }]}>
                            <Ionicons name="sparkles" size={12} color="#fff" />
                            <Text style={styles.tripCardBadgeText}>AI Plan</Text>
                        </View>
                    </View>

                    <LinearGradient
                        colors={[colors.primary, '#7C3AED']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.tripCardHeader, { paddingTop: SPACING.xs }]}
                    >
                        <Text style={styles.tripCardTitle} numberOfLines={1}>{trip.title}</Text>
                    </LinearGradient>

                    <View style={styles.tripCardBody}>
                        <View style={styles.tripCardRow}>
                            <Ionicons name="location" size={16} color={colors.textSecondary} />
                            <Text style={[styles.tripCardText, { color: colors.text }]}>{trip.toLocation}</Text>
                        </View>
                        <View style={styles.tripCardRow}>
                            <Ionicons name="wallet" size={16} color={colors.textSecondary} />
                            <Text style={[styles.tripCardText, { color: colors.text }]}>₹{trip.cost}</Text>
                        </View>
                        <View style={styles.tripCardRow}>
                            <Ionicons name="time" size={16} color={colors.textSecondary} />
                            <Text style={[styles.tripCardText, { color: colors.text }]}>~{trip.durationDays} Days</Text>
                        </View>
                        <View style={styles.tripCardRow}>
                            <Ionicons name="bus" size={16} color={colors.textSecondary} />
                            <Text style={[styles.tripCardText, { color: colors.text }]} numberOfLines={1}>{trip.transportMode || 'Mixed'}</Text>
                        </View>

                        <Text style={[styles.tripCardDesc, { color: colors.textSecondary, maxHeight: 100 }]} numberOfLines={4}>
                            {trip.description}
                        </Text>

                        {/* Additional Images (Thumbnails) */}
                        {keywords.length > 1 && (
                            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8, marginTop: 4 }}>
                                {keywords.slice(1, 4).map((k: string, idx: number) => (
                                    <Image
                                        key={idx}
                                        source={{ uri: `https://loremflickr.com/100/100/${encodeURIComponent(k)}?random=${idx}` }}
                                        style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: colors.border }}
                                    />
                                ))}
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
                            <TouchableOpacity
                                style={[styles.createButton, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }]}
                                onPress={() => handleCreateTrip(trip)}
                            >
                                <Text style={[styles.createButtonText, { color: colors.primary }]}>✏️ Edit & Post</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.createButton, { flex: 1, backgroundColor: colors.primary }]}
                                onPress={() => handleAutoPostTrip(trip)}
                            >
                                <Text style={styles.createButtonText}>🤖 Auto-Post</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animatable.View>
            );
        } catch (e) {

            return null; // Fallback to showing text
        }
    };

    const renderMessage = ({ item }: { item: AIMessage }) => {
        const isUser = item.user._id === 'user';

        // Check if message contains JSON for a trip plan (look for "type" and "trip_plan" generally)
        const tripCard = !isUser && (item.text.includes('trip_plan') && item.text.includes('type')) ? renderTripCard(item.text) : null;

        // If it's a trip card, we HIDE the text bubble completely to avoid showing raw JSON
        const showText = !tripCard;

        return (
            <Animatable.View
                animation={isUser ? "fadeInRight" : "fadeInLeft"}
                duration={300}
                style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.aiRow
                ]}
            >
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <Image
                            source={require('../../assets/Tripzi AI.png')}
                            style={styles.avatarImage}
                        />
                    </View>
                )}

                <View style={{ maxWidth: '100%' }}>
                    {showText && (
                        <View style={[
                            styles.bubble,
                            isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card },
                            isUser ? styles.userBubble : styles.aiBubble
                        ]}>
                            <Text style={[
                                styles.messageText,
                                isUser ? { color: '#fff' } : { color: colors.text }
                            ]}>
                                {item.text}
                            </Text>
                        </View>
                    )}
                    {tripCard}
                </View>
            </Animatable.View>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[colors.background, colors.card]}
                style={StyleSheet.absoluteFill}
            />
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, backgroundColor: 'rgba(255,255,255,0.8)' }]}>
                {/* Glassmorphism background approach or just transparent with blur if possible, fallback to slightly opaque */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, opacity: 0.9, borderBottomWidth: 1, borderBottomColor: colors.border }]} />

                <View style={styles.headerContent}>
                    <View style={styles.headerTitleContainer}>
                        <View style={styles.headerAvatarContainer}>
                            <Image
                                source={require('../../assets/Tripzi AI.png')}
                                style={styles.headerAvatarImage}
                            />
                        </View>
                        <View>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Tripzi AI</Text>
                            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>Your Travel Assistant</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setMessages([])}>
                        <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Chat List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item._id.toString()}
                    inverted
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.listContent}
                    ListFooterComponent={
                        isTyping ? (
                            <View style={styles.typingContainer}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={[styles.typingText, { color: colors.textSecondary }]}>Dreaming up your trip...</Text>
                            </View>
                        ) : null
                    }
                />

                {/* Suggestions */}
                {messages.length <= 1 && (
                    <View style={styles.suggestionsContainer}>
                        <Text style={[styles.suggestionsTitle, { color: colors.textSecondary }]}>Try asking:</Text>
                        <View style={styles.chipsRow}>
                            {['Plan a trip to Manali', 'Hidden gems in Kerala', 'Budget for Dubai', 'Packing for Ladakh'].map((chip, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.primaryLight }]}
                                    onPress={() => handleQuickReply(chip)}
                                >
                                    <Text style={[styles.chipText, { color: colors.text }]}>{chip}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Input Area */}
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Where do you want to go?"
                        placeholderTextColor={colors.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
                        onPress={handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Ionicons name="arrow-up" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },

    // Header Avatar Styles
    headerAvatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        marginRight: SPACING.md,
        backgroundColor: '#fff',
        elevation: 2,
    },
    headerAvatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    headerSubtitle: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

    listContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
    messageRow: {
        flexDirection: 'row',
        marginBottom: SPACING.lg,
        maxWidth: '85%'
    },
    userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
    aiRow: { alignSelf: 'flex-start' },

    // Chat Avatar Styles
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
        marginRight: SPACING.xs,
        marginTop: 0,
        backgroundColor: '#fff',
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    bubble: {
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.xl,
        marginBottom: SPACING.xs,
    },
    userBubble: { borderBottomRightRadius: 4 },
    aiBubble: { borderTopLeftRadius: 4 },
    messageText: { fontSize: FONT_SIZE.md, lineHeight: 22 },

    typingContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.lg, marginBottom: SPACING.md },
    typingText: { marginLeft: SPACING.sm, fontSize: FONT_SIZE.sm, fontStyle: 'italic' },

    suggestionsContainer: { padding: SPACING.md, paddingBottom: 0 },
    suggestionsTitle: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm, marginLeft: SPACING.xs },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
    },
    chipText: { fontSize: FONT_SIZE.sm },

    inputContainer: {
        flexDirection: 'row',
        padding: SPACING.md,
        borderTopWidth: 1,
        alignItems: 'flex-end',
        gap: SPACING.sm,
    },
    input: {
        flex: 1,
        minHeight: 48,
        maxHeight: 120,
        borderRadius: 24,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Trip Card Styles
    tripCard: {
        width: 260,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        marginTop: SPACING.xs,
        elevation: 4,
    },
    tripCardHeader: {
        padding: SPACING.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    tripCardTitle: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        flex: 1,
        marginRight: SPACING.sm,
    },
    tripCardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 4,
    },
    tripCardBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    tripCardBody: {
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    tripCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    tripCardText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: '500',
    },
    tripCardDesc: {
        fontSize: FONT_SIZE.xs,
        marginTop: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    createButton: {
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    createButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.sm,
        fontWeight: 'bold',
    },
});

export default AIChatScreen;
