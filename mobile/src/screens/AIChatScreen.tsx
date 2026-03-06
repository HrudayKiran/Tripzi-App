import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, FlatList, TextInput, Image, ActivityIndicator, Alert, Animated, Keyboard, Modal } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, NEUTRAL } from '../styles';
import { aiService, AIMessage, AIModel, PlaceImage } from '../services/AIService';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Typing Dots Component ──────────────────────────────────────────
const TypingDots = ({ color }: { color: string }) => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            );
        };
        const a1 = animate(dot1, 0);
        const a2 = animate(dot2, 150);
        const a3 = animate(dot3, 300);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.typingDotsRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View
                    key={i}
                    style={[
                        styles.typingDot,
                        { backgroundColor: color, transform: [{ translateY: dot }] },
                    ]}
                />
            ))}
        </View>
    );
};

// ─── Models Config ──────────────────────────────────────────────────
const MODELS: { id: AIModel; label: string; icon: string; desc: string }[] = [
    { id: 'llama-3.3-70b-versatile', label: 'Detailed', icon: '🧠', desc: 'Best for trip planning' },
    { id: 'llama-3.1-8b-instant', label: 'Quick', icon: '⚡', desc: 'Faster responses' },
];

// ─── Dynamic Suggestions ────────────────────────────────────────────
const getContextSuggestions = (messages: AIMessage[]): string[] => {
    if (messages.length <= 1) {
        return ['Plan a trip to Manali', 'Hidden gems in Kerala', 'Budget trip to Goa', 'Weekend getaway ideas'];
    }

    const lastAiMsg = messages.find(m => m.user._id === 'tripzi-ai');
    const lastText = lastAiMsg?.text?.toLowerCase() || '';

    if (lastText.includes('where are you starting') || lastText.includes('origin') || lastText.includes('from where')) {
        return ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai'];
    }
    if (lastText.includes('destination') || lastText.includes('where') || lastText.includes('which place')) {
        return ['Goa', 'Ladakh', 'Coorg', 'Rishikesh', 'Udaipur'];
    }
    if (lastText.includes('budget') || lastText.includes('cost') || lastText.includes('₹') || lastText.includes('spend')) {
        return ['₹5,000 per person', '₹10,000 per person', '₹20,000 per person', 'Budget friendly'];
    }
    if (lastText.includes('transport') || lastText.includes('travel') || lastText.includes('getting there')) {
        return ['Train', 'Flight', 'Car / Road Trip', 'Bike', 'Bus'];
    }
    if (lastText.includes('accommodation') || lastText.includes('stay') || lastText.includes('hotel') || lastText.includes('sleep')) {
        return ['Hotel', 'Hostel', 'Homestay', 'Camping', 'Not needed'];
    }
    if (lastText.includes('duration') || lastText.includes('how many days') || lastText.includes('how long')) {
        return ['2 days', '3 days', '5 days', '1 week'];
    }
    if (lastText.includes('when') || lastText.includes('date') || lastText.includes('start date') || lastText.includes('departure')) {
        return ['This weekend', 'Next week', 'End of this month', 'I\'m flexible'];
    }
    if (lastText.includes('traveler') || lastText.includes('people') || lastText.includes('group') || lastText.includes('how many')) {
        return ['Solo trip', '2 people', '4-5 friends', 'Large group (8+)'];
    }
    if (lastText.includes('trip type') || lastText.includes('kind of') || lastText.includes('interest') || lastText.includes('adventure')) {
        return ['Adventure', 'Sightseeing', 'Beach & Relax', 'Trekking', 'Road trip'];
    }
    if (lastText.includes('shall i create') || lastText.includes('trip card') || lastText.includes('confirm') || lastText.includes('summary')) {
        return ['Yes, create the trip card!', 'Change the budget', 'Add more places', 'Looks good, go ahead!'];
    }
    if (lastText.includes('gender') || lastText.includes('who can join')) {
        return ['Anyone can join', 'Male only', 'Female only'];
    }
    if (lastText.includes('mandatory') || lastText.includes('bring') || lastText.includes('pack')) {
        return ['ID Proof, warm clothes', 'Medicines, sunscreen', 'Tent, sleeping bag', 'Just the basics'];
    }
    if (lastText.includes('posted') || lastText.includes('success') || lastText.includes('done') || lastText.includes('created')) {
        return ['Plan another trip', 'Show me popular destinations', 'Thanks!'];
    }

    return ['Create trip card', 'Suggest more places', 'Change plans', 'Show budget breakdown'];
};

const AIChatScreen = ({ navigation, route }: any) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModel>('llama-3.3-70b-versatile');
    const [showModelPicker, setShowModelPicker] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    const initialPrompt = route?.params?.initialPrompt;

    useEffect(() => {
        setMessages([
            {
                _id: 1,
                text: "Hey there! 👋 I'm Tripzi AI, your personal travel assistant.\n\nTell me a destination and I'll help you plan the perfect trip — from places to visit, budget, transport, and more!\n\nI'll gather all the details and create a beautiful Trip Card for you. 🗺️",
                createdAt: new Date(),
                user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
            },
        ]);

        // If initial prompt provided from AIPlannerScreen, auto-send it
        if (initialPrompt) {
            setTimeout(() => {
                sendMessageDirectly(initialPrompt);
            }, 800);
        }
    }, []);

    const sendMessageDirectly = async (text: string) => {
        const userMsg: AIMessage = {
            _id: Date.now() + Math.random(),
            text,
            createdAt: new Date(),
            user: { _id: 'user', name: 'User' },
        };

        setMessages(prev => [userMsg, ...prev]);
        setIsTyping(true);

        try {
            const responses = await aiService.sendMessage(text, messages, selectedModel);
            const newAiMessages = responses.reverse();

            for (const msg of newAiMessages) {
                if (msg.text.includes('trip_plan') && msg.text.includes('"type"')) {
                    await enrichTripImagesWith(msg);
                }
            }

            // Artificial delay for better UX — show typing dots for at least 1.5s
            await new Promise(resolve => setTimeout(resolve, 1500));

            setMessages(prev => [...newAiMessages, ...prev]);
        } catch {
            // silent
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text) return;

        Keyboard.dismiss();

        const userMsg: AIMessage = {
            _id: Date.now() + Math.random(),
            text,
            createdAt: new Date(),
            user: { _id: 'user', name: 'User' },
        };

        setMessages(prev => [userMsg, ...prev]);
        setInputText('');
        setIsTyping(true);

        try {
            // Track response start time
            const startTime = Date.now();

            const responses = await aiService.sendMessage(text, messages, selectedModel);
            const newAiMessages = responses.reverse();

            for (const msg of newAiMessages) {
                if (msg.text.includes('trip_plan') && msg.text.includes('"type"')) {
                    await enrichTripImagesWith(msg);
                }
            }

            // Ensure typing dots show for at least 1.5 seconds
            const elapsed = Date.now() - startTime;
            if (elapsed < 1500) {
                await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
            }

            setMessages(prev => [...newAiMessages, ...prev]);
        } catch {
            Alert.alert("Error", "Failed to connect to AI. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    // Fetch Unsplash images and replace imageKeywords with real URLs
    const enrichTripImagesWith = async (msg: AIMessage) => {
        try {
            const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = msg.text.match(codeBlockRegex);
            if (!match?.[1]) return;

            const trip = JSON.parse(match[1]);
            const places = trip.imageKeywords || trip.placesToVisit || [];
            if (places.length === 0) return;

            const images = await aiService.fetchPlaceImages(places);
            if (images.length > 0) {
                trip._unsplashImages = images;
                const updatedJson = JSON.stringify(trip);
                msg.text = '```json\n' + updatedJson + '\n```';
            }
        } catch {
            // Non-critical — images will fallback to placeholders
        }
    };

    const handleQuickReply = (text: string) => {
        setInputText(text);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleCreateTrip = (tripData: any) => {
        // Pass Unsplash images as the images array for CreateTripScreen
        const unsplashImages: PlaceImage[] = tripData._unsplashImages || [];
        const imageUrls = unsplashImages
            .filter((img: PlaceImage) => img.imageUrl)
            .map((img: PlaceImage) => img.imageUrl);

        const dataForCreateTrip = {
            ...tripData,
            images: imageUrls.length > 0 ? imageUrls : undefined,
            // Convert itinerary array to string if it's an array
            itinerary: Array.isArray(tripData.itinerary) ? tripData.itinerary.join('\n') : tripData.itinerary,
        };

        navigation.navigate('CreateTrip', { initialTripData: dataForCreateTrip });
    };

    const handleAutoPostTrip = async (trip: any) => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Error', 'Please login to post a trip.');
            return;
        }

        Alert.alert(
            "Post Trip? 🤖",
            "I'll create this trip and post it to your profile.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Post It!",
                    onPress: async () => {
                        try {
                            const unsplashImages: PlaceImage[] = trip._unsplashImages || [];
                            const finalImages = unsplashImages
                                .filter(img => img.imageUrl)
                                .map(img => img.imageUrl);

                            const images = finalImages.length > 0
                                ? finalImages
                                : [`https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800`];

                            const currentUserDoc = await firestore().collection('users').doc(currentUser.uid).get();
                            const currentUserData = currentUserDoc.data() || {};

                            const tripData = {
                                title: trip.title,
                                images,
                                imageLocations: (trip.placesToVisit || []).slice(0, images.length),
                                fromLocation: trip.fromLocation || 'Unknown',
                                toLocation: trip.toLocation,
                                mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.toLocation)}`,
                                fromDate: firestore.Timestamp.now(),
                                toDate: firestore.Timestamp.fromMillis(Date.now() + (trip.durationDays || 3) * 24 * 60 * 60 * 1000),
                                duration: `${trip.durationDays || 3} days`,
                                tripTypes: [trip.tripType || 'adventure'],
                                transportModes: [trip.transportMode || 'mixed'],
                                costPerPerson: trip.cost || 0,
                                totalCost: trip.cost || 0,
                                cost: trip.cost || 0,
                                accommodationType: trip.accommodationType || 'hotel',
                                bookingStatus: trip.bookingStatus || 'to_book',
                                accommodationDays: trip.durationDays || 3,
                                maxTravelers: trip.maxTravelers || 5,
                                currentTravelers: 1,
                                genderPreference: trip.genderPreference || 'anyone',
                                description: trip.description,
                                mandatoryItems: trip.mandatoryItems || [],
                                placesToVisit: trip.placesToVisit || [],
                                userId: currentUser.uid,
                                ownerDisplayName: currentUserData.name || currentUserData.displayName || currentUser.displayName || 'Traveler',
                                ownerPhotoURL: currentUserData.photoURL || currentUser.photoURL || null,
                                ownerUsername: currentUserData.username || null,
                                participants: [currentUser.uid],
                                likes: [],
                                createdAt: firestore.FieldValue.serverTimestamp(),
                                location: trip.toLocation,
                                tripType: trip.tripType || 'adventure',
                                coverImage: images[0],
                            };

                            const tripRef = await firestore().collection('trips').add(tripData);

                            await firestore().collection('chats').doc(`trip_${tripRef.id}`).set({
                                type: 'group',
                                tripId: tripRef.id,
                                tripTitle: trip.title,
                                participants: [currentUser.uid],
                                createdBy: currentUser.uid,
                                createdAt: firestore.FieldValue.serverTimestamp(),
                                lastMessage: 'Trip created by Tripzi AI!',
                                lastMessageTime: firestore.FieldValue.serverTimestamp(),
                            });

                            const successMsg: AIMessage = {
                                _id: Date.now() + Math.random(),
                                text: `Done! 🎉 "${trip.title}" has been posted to your profile!\n\nCheck it out in your trips.`,
                                createdAt: new Date(),
                                user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                            };
                            setMessages(prev => [successMsg, ...prev]);
                        } catch {
                            Alert.alert("Error", "Failed to post trip. Try 'Edit & Post' instead.");
                        }
                    }
                }
            ]
        );
    };

    const renderTripCard = (jsonString: string) => {
        try {
            let potentialJson = '';
            const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = jsonString.match(codeBlockRegex);

            if (match?.[1]) {
                potentialJson = match[1];
            } else {
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace === -1 || lastBrace === -1) return null;
                potentialJson = jsonString.substring(firstBrace, lastBrace + 1);
            }

            const trip = JSON.parse(potentialJson);
            if (trip.type !== 'trip_plan') return null;

            const unsplashImages: PlaceImage[] = trip._unsplashImages || [];
            const coverUrl = unsplashImages[0]?.imageUrl ||
                `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800`;

            const photographers = unsplashImages.filter(img => img.photographerName);

            // Parse itinerary for day-wise display
            const itineraryItems: string[] = Array.isArray(trip.itinerary) ? trip.itinerary :
                (typeof trip.itinerary === 'string' ? trip.itinerary.split('\n').filter((s: string) => s.trim()) : []);

            return (
                <Animatable.View animation="fadeInUp" style={[styles.tripCard, { backgroundColor: colors.card }]}>
                    {/* Cover Image */}
                    <View style={{ height: 140, width: '100%', backgroundColor: colors.border }}>
                        <Image
                            source={{ uri: coverUrl }}
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
                        <Text style={styles.tripCardOverlayTitle} numberOfLines={2}>{trip.title}</Text>
                    </View>

                    <View style={styles.tripCardBody}>
                        <View style={styles.tripCardRow}>
                            <Ionicons name="location" size={16} color={colors.primary} />
                            <Text style={[styles.tripCardText, { color: colors.text }]}>{trip.fromLocation} → {trip.toLocation}</Text>
                        </View>
                        <View style={styles.tripCardDetailsGrid}>
                            <View style={styles.tripCardDetail}>
                                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>{trip.durationDays} days</Text>
                            </View>
                            <View style={styles.tripCardDetail}>
                                <Ionicons name="wallet-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>₹{trip.cost?.toLocaleString()}</Text>
                            </View>
                            <View style={styles.tripCardDetail}>
                                <Ionicons name="bus-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>{trip.transportMode}</Text>
                            </View>
                            <View style={styles.tripCardDetail}>
                                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                                <Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>Max {trip.maxTravelers}</Text>
                            </View>
                        </View>

                        <Text style={[styles.tripCardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                            {trip.description}
                        </Text>

                        {/* Day-wise Itinerary */}
                        {itineraryItems.length > 0 && (
                            <View style={styles.itinerarySection}>
                                <Text style={[styles.itineraryTitle, { color: colors.text }]}>📋 Itinerary</Text>
                                {itineraryItems.slice(0, 5).map((item, idx) => (
                                    <View key={idx} style={styles.itineraryItem}>
                                        <View style={[styles.itineraryDot, { backgroundColor: colors.primary }]} />
                                        <Text style={[styles.itineraryText, { color: colors.textSecondary }]} numberOfLines={2}>{item}</Text>
                                    </View>
                                ))}
                                {itineraryItems.length > 5 && (
                                    <Text style={[styles.itineraryMore, { color: colors.primary }]}>+{itineraryItems.length - 5} more days...</Text>
                                )}
                            </View>
                        )}

                        {/* Place Images */}
                        {unsplashImages.length > 1 && (
                            <View style={styles.placeImagesRow}>
                                {unsplashImages.slice(0, 5).map((img, idx) => (
                                    <View key={idx} style={styles.placeImageWrap}>
                                        {img.imageUrl ? (
                                            <Image source={{ uri: img.imageUrl }} style={styles.placeImage} />
                                        ) : (
                                            <View style={[styles.placeImage, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                                                <Ionicons name="image-outline" size={16} color={colors.textSecondary} />
                                            </View>
                                        )}
                                        <Text style={[styles.placeImageLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {img.place.split(' ').slice(0, 2).join(' ')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Photographer attribution */}
                        {photographers.length > 0 && (
                            <Text style={[styles.attributionText, { color: colors.textSecondary }]}>
                                📷 {photographers.map(p => p.photographerName).slice(0, 3).join(', ')} via Unsplash
                            </Text>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.tripCardActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }]}
                                onPress={() => handleCreateTrip(trip)}
                            >
                                <Text style={[styles.actionBtnText, { color: colors.primary }]}>✏️ Edit & Post</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                                onPress={() => handleAutoPostTrip(trip)}
                            >
                                <Text style={styles.actionBtnTextWhite}>🤖 Auto-Post</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animatable.View>
            );
        } catch {
            return null;
        }
    };

    const renderMessage = ({ item }: { item: AIMessage }) => {
        const isUser = item.user._id === 'user';
        const tripCard = !isUser && (item.text.includes('trip_plan') && item.text.includes('"type"')) ? renderTripCard(item.text) : null;
        const showText = !tripCard;

        return (
            <Animatable.View
                animation={isUser ? "fadeInRight" : "fadeInLeft"}
                duration={300}
                style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
            >
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <Image source={require('../../assets/Tripzi AI.png')} style={styles.avatarImage} />
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

    const suggestions = getContextSuggestions(messages);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + SPACING.xs, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={styles.headerContent}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="chevron-back" size={26} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerAvatarContainer}>
                            <Image source={require('../../assets/Tripzi AI.png')} style={styles.headerAvatarImage} />
                        </View>
                        <View>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Tripzi AI</Text>
                            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
                                {isTyping ? 'Thinking...' : 'Your Travel Assistant'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        {/* Model Selector Button */}
                        <TouchableOpacity
                            style={[styles.modelBadge, { backgroundColor: colors.background, borderColor: colors.border }]}
                            onPress={() => setShowModelPicker(true)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.modelBadgeIcon}>{MODELS.find(m => m.id === selectedModel)?.icon}</Text>
                            <Text style={[styles.modelBadgeText, { color: colors.text }]}>
                                {MODELS.find(m => m.id === selectedModel)?.label}
                            </Text>
                            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                            setMessages([{
                                _id: 1,
                                text: "Hey there! 👋 I'm Tripzi AI, your personal travel assistant.\n\nTell me a destination and I'll help you plan the perfect trip!\n\nI'll gather all the details and create a Trip Card for you. 🗺️",
                                createdAt: new Date(),
                                user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                            }]);
                        }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Model Picker Modal — renders on top of everything */}
            <Modal
                visible={showModelPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModelPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModelPicker(false)}
                >
                    <Animatable.View animation="fadeInDown" duration={200} style={[styles.modelDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.modelDropdownTitle, { color: colors.textSecondary }]}>Select AI Model</Text>
                        {MODELS.map((model) => (
                            <TouchableOpacity
                                key={model.id}
                                style={[
                                    styles.modelOption,
                                    selectedModel === model.id && { backgroundColor: 'rgba(157,116,247,0.1)' },
                                ]}
                                onPress={() => {
                                    setSelectedModel(model.id);
                                    setShowModelPicker(false);
                                }}
                            >
                                <Text style={styles.modelOptionIcon}>{model.icon}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modelOptionLabel, { color: colors.text }]}>{model.label}</Text>
                                    <Text style={[styles.modelOptionDesc, { color: colors.textSecondary }]}>{model.desc}</Text>
                                </View>
                                {selectedModel === model.id && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </Animatable.View>
                </TouchableOpacity>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
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
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="none"
                    ListFooterComponent={
                        isTyping ? (
                            <View style={styles.typingContainer}>
                                <View style={styles.avatarContainer}>
                                    <Image source={require('../../assets/Tripzi AI.png')} style={styles.avatarImage} />
                                </View>
                                <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card }]}>
                                    <TypingDots color={colors.primary} />
                                </View>
                            </View>
                        ) : null
                    }
                />

                {/* Dynamic Suggestions */}
                <View style={[styles.suggestionsContainer, { borderTopColor: colors.border }]}>
                    <FlatList
                        data={suggestions}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => handleQuickReply(item)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {/* Input Area */}
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
                    <TextInput
                        ref={inputRef}
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Ask Tripzi AI anything..."
                        placeholderTextColor={colors.textSecondary}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isTyping}
                        testID="ai-send-btn"
                    >
                        {isTyping ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="arrow-up" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {},
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerBackBtn: { padding: SPACING.xs },
    headerAvatarContainer: {
        width: 36, height: 36, borderRadius: 18,
        overflow: 'hidden', backgroundColor: '#fff', elevation: 2,
    },
    headerAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    headerTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    headerSubtitle: { fontSize: 11, fontWeight: '600' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

    // Model Selector
    modelBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    },
    modelBadgeIcon: { fontSize: 14 },
    modelBadgeText: { fontSize: 11, fontWeight: FONT_WEIGHT.semibold },

    // Model Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: SPACING.xl,
    },
    modelDropdown: {
        borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
        overflow: 'hidden', width: '100%', maxWidth: 320,
        elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
    },
    modelDropdownTitle: {
        fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold,
        paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm,
    },
    modelOption: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg,
    },
    modelOptionIcon: { fontSize: 24 },
    modelOptionLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    modelOptionDesc: { fontSize: 12, marginTop: 2 },

    // Chat
    listContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
    messageRow: { flexDirection: 'row', marginBottom: SPACING.md, maxWidth: '85%' },
    userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
    aiRow: { alignSelf: 'flex-start' },
    avatarContainer: {
        width: 30, height: 30, borderRadius: 15,
        overflow: 'hidden', marginRight: SPACING.xs,
        backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.08)', borderWidth: 1,
    },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.xl, marginBottom: 2 },
    userBubble: { borderBottomRightRadius: 4 },
    aiBubble: { borderTopLeftRadius: 4 },
    messageText: { fontSize: FONT_SIZE.md, lineHeight: 22 },

    // Typing Indicator
    typingContainer: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 0, marginBottom: SPACING.md },
    typingDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    typingDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.7 },

    // Suggestions
    suggestionsContainer: { paddingVertical: SPACING.sm, borderTopWidth: 0.5 },
    chip: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.xl, borderWidth: 1,
    },
    chipText: { fontSize: FONT_SIZE.sm },

    // Input
    inputContainer: {
        flexDirection: 'row', padding: SPACING.sm, paddingHorizontal: SPACING.md,
        borderTopWidth: 1, alignItems: 'flex-end', gap: SPACING.sm,
    },
    input: {
        flex: 1, minHeight: 44, maxHeight: 100,
        borderRadius: 22, paddingHorizontal: SPACING.lg,
        paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.sm,
        paddingBottom: Platform.OS === 'ios' ? SPACING.sm : SPACING.sm,
        fontSize: FONT_SIZE.md,
    },
    sendButton: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
    },

    // Trip Card
    tripCard: {
        width: 280, borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden', marginTop: SPACING.xs, elevation: 4,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    },
    tripCardBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, gap: 4,
    },
    tripCardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    tripCardOverlayTitle: {
        position: 'absolute', bottom: 10, left: 12, right: 12,
        color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold,
    },
    tripCardBody: { padding: SPACING.md, gap: SPACING.sm },
    tripCardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    tripCardText: { fontSize: FONT_SIZE.sm, fontWeight: '500', flex: 1 },
    tripCardDetailsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    },
    tripCardDetail: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    tripCardDetailText: { fontSize: 12 },
    tripCardDesc: { fontSize: FONT_SIZE.xs, lineHeight: 18 },

    // Itinerary
    itinerarySection: { marginTop: 4, gap: 4 },
    itineraryTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    itineraryItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    itineraryDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
    itineraryText: { fontSize: 11, lineHeight: 16, flex: 1 },
    itineraryMore: { fontSize: 11, fontWeight: '600', marginLeft: 12 },

    // Place Images 
    placeImagesRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    placeImageWrap: { alignItems: 'center', width: 50 },
    placeImage: { width: 46, height: 46, borderRadius: 8, backgroundColor: '#f0f0f0' },
    placeImageLabel: { fontSize: 9, marginTop: 2, textAlign: 'center' },
    attributionText: { fontSize: 9, marginTop: 2, fontStyle: 'italic' },
    tripCardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
    actionBtn: {
        flex: 1, paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md, alignItems: 'center',
    },
    actionBtnText: { fontSize: FONT_SIZE.sm, fontWeight: 'bold' },
    actionBtnTextWhite: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: 'bold' },
});

export default AIChatScreen;
