import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, TextInput, ActivityIndicator, Alert, Animated, Keyboard, Modal, Dimensions, TouchableWithoutFeedback, ScrollView, Linking } from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { syncDatabase } from '../database/sync';
import { showUploadNotification, completeUploadNotification, failUploadNotification } from '../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, NEUTRAL } from '../styles';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { aiService, AIMessage, PlaceImage, AIModel, Conversation } from '../services/AIService';
import useAIPlannerQuery from '../hooks/useAIPlannerQuery';
import { useQueryClient } from '@tanstack/react-query';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

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
    if (messages.length === 0) return [];

    const lastAiMsg = messages.find(m => m.user._id === 'tripzi-ai');

    // 1. If the AI provided explicit suggestions in the response, use them (Perfect accuracy)
    if (lastAiMsg?.suggestions && lastAiMsg.suggestions.length > 0) {
        return lastAiMsg.suggestions;
    }

    // 2. Fallback to keyword-based suggestions (Rule-based accuracy)
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
    if (lastText.includes('posted') || lastText.includes('success') || lastText.includes('done') || lastText.includes('created')) {
        return ['Plan another trip', 'Show me popular destinations', 'Thanks!'];
    }

    return ['Create trip card', 'Suggest more places', 'Change plans', 'Show budget breakdown'];
};

const EMPTY_STATE_SUGGESTIONS = [
    { icon: '🏖️', title: 'Plan a Beach Trip', prompt: 'Plan a relaxing 3-day beach trip to Goa' },
    { icon: '🏔️', title: 'Mountain Escape', prompt: 'Plan an adventure trip to Manali for a group of 4' },
    { icon: '💡', title: 'Tripzi Features', prompt: 'How do I use Tripzi features like joining trips or finding travel buddies?' },
    { icon: '🎒', title: 'Backpacking', prompt: 'Plan a budget backpacking trip to Rishikesh' },
];

export default function AIPlannerScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    // UI State
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModel>('llama-3.1-8b-instant');
    const [showModelPicker, setShowModelPicker] = useState(false);

    const [conversationId, setConversationId] = useState<string | null>((params.conversationId as string) || null);
    const { conversations, messages: serverMsgs, loading: loadingQuery, refetchConversations } = useAIPlannerQuery(conversationId);
    const conversationCreated = useRef(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (serverMsgs.length > 0) {
            setMessages(serverMsgs);
        }
    }, [serverMsgs]);

    // Refs
    const flatListRef = useRef<any>(null);
    const inputRef = useRef<TextInput>(null);

    // Drawer State
    const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Rename Modal State
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameText, setRenameText] = useState('');
    const [chatToRename, setChatToRename] = useState<Conversation | null>(null);

    const initialPrompt = params.initialPrompt as string | undefined;

    useFocusEffect(
        useCallback(() => {
            refetchConversations();
            setConversationId(null);
            conversationCreated.current = false;
            setInputText('');
            setMessages([]);
        }, [])
    );

    const isLocationQuery = (text: string) => {
        const q = text.toLowerCase();
        return ['near', 'nearby', 'location', 'here', 'around', 'petrol', 'ev ', 'charging', 'rental', 'bunk', 'fuel', 'station'].some(t => q.includes(t));
    };

    const getCurrentLocation = async (forcePrompt = false) => {
        try {
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled && forcePrompt) {
                Alert.alert("GPS Disabled", "Please enable location services (GPS) in your device settings.");
                return null;
            }

            const { status } = await Location.getForegroundPermissionsAsync();

            if (status === 'granted') {
                let location = await Location.getLastKnownPositionAsync();

                if (!location) {
                    location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                }

                let city = 'Unknown';
                let country = 'Unknown';
                try {
                    const [place] = await Location.reverseGeocodeAsync({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                    city = place?.city || place?.region || 'Unknown';
                    country = place?.country || 'Unknown';
                } catch {
                    // Fail silent, we still have coords
                }

                return {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    city,
                    country,
                };
            }

            if (!forcePrompt) return null;

            // Try requesting
            const { status: newStatus } = await Location.requestForegroundPermissionsAsync();

            if (newStatus === 'granted') {
                return getCurrentLocation(true);
            }

            // If denied, open settings as last resort
            if (newStatus === 'denied') {
                Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings();
            }

            return null;
        } catch (err) {
            console.error('Location Error:', err);
            return null;
        }
    };



    const initChat = async (forceNew = false) => {
        if (conversationId && !forceNew) {
            try {
                const serverMsgs = await aiService.getConversationMessages(conversationId);
                if (serverMsgs.length > 0) {
                    const loadedMsgs: AIMessage[] = serverMsgs.map((m) => ({
                        _id: m.id,
                        text: m.content,
                        createdAt: new Date(m.created_at),
                        user: m.role === 'assistant'
                            ? { _id: 'tripzi-ai', name: 'Tripzi AI' }
                            : { _id: 'user', name: 'User' },
                        suggestions: m.suggestions,
                    }));
                    setMessages(loadedMsgs.reverse());
                    conversationCreated.current = true;
                    return;
                }
            } catch { /* fall through to welcome */ }
        }

        // Welcome state
        setMessages([]);
        if (initialPrompt && !forceNew) {
            setTimeout(() => {
                sendMessageDirectly(initialPrompt);
            }, 800);
        }
    };

    useEffect(() => {
        initChat();
    }, [conversationId]);

    const toggleDrawer = () => {
        const toValue = isDrawerOpen ? -DRAWER_WIDTH : 0;
        Animated.timing(drawerAnim, {
            toValue,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setIsDrawerOpen(!isDrawerOpen);
    };

    const handleNewChat = () => {
        if (isDrawerOpen) toggleDrawer();
        setConversationId(null);
        conversationCreated.current = false;
        setInputText('');
        initChat(true);
    };

    const handleSelectChat = (conv: Conversation) => {
        toggleDrawer();
        if (conv.id === conversationId) return;
        setConversationId(conv.id);
        conversationCreated.current = true;
        // Effect on conversationId change isn't there, so manually call initChat
        aiService.getConversationMessages(conv.id).then(serverMsgs => {
            if (serverMsgs.length > 0) {
                const loadedMsgs: AIMessage[] = serverMsgs.map((m) => ({
                    _id: m.id,
                    text: m.content,
                    createdAt: new Date(m.created_at),
                    user: m.role === 'assistant'
                        ? { _id: 'tripzi-ai', name: 'Tripzi AI' }
                        : { _id: 'user', name: 'User' },
                }));
                setMessages(loadedMsgs.reverse());
            }
        });
    };

    const handleDeleteChat = (conv: Conversation) => {
        Alert.alert(
            'Delete Chat',
            `Delete "${conv.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        await aiService.deleteConversation(conv.id);
                        queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
                        if (conversationId === conv.id) {
                            handleNewChat();
                        }
                    },
                },
            ]
        );
    };

    const openRenameModal = (conv: Conversation) => {
        setChatToRename(conv);
        setRenameText(conv.title);
        setRenameModalVisible(true);
    };

    const handleRenameSubmit = async () => {
        if (!chatToRename || !renameText.trim()) return;
        setRenameModalVisible(false);
        try {
            await aiService.renameConversation(chatToRename.id, renameText.trim());
            queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
        } catch {
            Alert.alert("Error", "Failed to rename chat");
        }
    };

    const ensureConversation = async (firstMessage: string): Promise<string | null> => {
        if (conversationId) return conversationId;
        if (conversationCreated.current) return conversationId;

        try {
            conversationCreated.current = true;
            // Generate title from first message
            const title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
            const conv = await aiService.createConversation(title, selectedModel);
            if (conv) {
                setConversationId(conv.id);
                queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
                return conv.id;
            }
        } catch { /* fall through */ }
        return null;
    };

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
            const isLoc = isLocationQuery(text);
            const location = await getCurrentLocation(false); // Silent check

            if (isLoc && !location) {
                const reqMsg: AIMessage = {
                    _id: 'loc-req-' + Date.now(),
                    text: 'TRIPZI_LOCATION_REQUIRED',
                    createdAt: new Date(),
                    user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                };
                setMessages(prev => [reqMsg, ...prev]);
                setIsTyping(false);
                return;
            }

            const convId = await ensureConversation(text);
            let newAiMessages: AIMessage[];

            if (convId) {
                const result = await aiService.sendConversationMessage(convId, text, selectedModel, location);
                if (result) {
                    newAiMessages = [{
                        _id: result.aiMessage.id,
                        text: result.aiMessage.content,
                        createdAt: new Date(result.aiMessage.created_at),
                        user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                        suggestions: result.aiMessage.suggestions,
                    }];
                } else {
                    const responses = await aiService.sendMessage(text, messages, selectedModel);
                    newAiMessages = responses.reverse();
                }
            } else {
                const responses = await aiService.sendMessage(text, messages, selectedModel);
                newAiMessages = responses.reverse();
            }

            for (const msg of newAiMessages) {
                if (msg.text.includes('trip_plan') && msg.text.includes('"type"')) {
                    await enrichTripImagesWith(msg);
                }
            }

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
            const startTime = Date.now();
            const isLoc = isLocationQuery(text);
            const location = await getCurrentLocation(false); // Silent check

            if (isLoc && !location) {
                const reqMsg: AIMessage = {
                    _id: 'loc-req-' + Date.now(),
                    text: 'TRIPZI_LOCATION_REQUIRED',
                    createdAt: new Date(),
                    user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                };
                setMessages(prev => [reqMsg, ...prev]);
                setIsTyping(false);
                return;
            }

            const convId = await ensureConversation(text);
            let newAiMessages: AIMessage[];

            if (convId) {
                const result = await aiService.sendConversationMessage(convId, text, selectedModel, location);
                if (result) {
                    newAiMessages = [{
                        _id: result.aiMessage.id,
                        text: result.aiMessage.content,
                        createdAt: new Date(result.aiMessage.created_at),
                        user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                        suggestions: result.aiMessage.suggestions,
                    }];
                } else {
                    const responses = await aiService.sendMessage(text, messages, selectedModel);
                    newAiMessages = responses.reverse();
                }
            } else {
                const responses = await aiService.sendMessage(text, messages, selectedModel);
                newAiMessages = responses.reverse();
            }

            for (const msg of newAiMessages) {
                if (msg.text.includes('trip_plan') && msg.text.includes('"type"')) {
                    await enrichTripImagesWith(msg);
                }
            }

            setMessages(prev => [...newAiMessages, ...prev]);
        } catch {
            Alert.alert("Error", "Failed to connect to AI. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

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
                msg.text = '```json\n' + JSON.stringify(trip) + '\n```';
            }
        } catch { }
    };

    const handleCreateTrip = (tripData: any) => {
        const unsplashImages: PlaceImage[] = tripData._unsplashImages || [];
        const imageUrls = unsplashImages.filter(img => img.imageUrl).map(img => img.imageUrl);
        const dataForCreateTrip = {
            ...tripData,
            images: imageUrls.length > 0 ? imageUrls : undefined,
            itinerary: Array.isArray(tripData.itinerary) ? tripData.itinerary.join('\n') : tripData.itinerary,
        };
        router.push({ pathname: '/trip/create', params: { initialTripData: JSON.stringify(dataForCreateTrip) } });
    };

    const handleAutoPostTrip = async (trip: any) => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return Alert.alert('Error', 'Please login to post a trip.');

        Alert.alert("Post Trip? 🤖", "I'll create this trip and post it to your profile.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Post It!",
                onPress: async () => {
                    try {
                        await showUploadNotification(0.2, 'Auto-posting trip...');
                        const images = trip._unsplashImages?.filter((i: any) => i.imageUrl).map((i: any) => i.imageUrl) || [`https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800`];
                        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();

                        const tripData = {
                            title: trip.title, images,
                            from_location: trip.fromLocation || 'Unknown', to_location: trip.toLocation,
                            from_date: new Date().toISOString(),
                            to_date: new Date(Date.now() + (trip.durationDays || 3) * 86400000).toISOString(),
                            trip_types: [trip.tripType || 'adventure'],
                            transport_modes: [trip.transportMode || 'mixed'],
                            cost_per_person: trip.cost || 0, total_cost: trip.cost || 0,
                            accommodation_type: trip.accommodationType || 'hotel',
                            accommodation_days: trip.durationDays || 3,
                            max_travelers: trip.maxTravelers || 5, current_travelers: 1,
                            gender_preference: trip.genderPreference || 'anyone',
                            description: trip.description,
                            places_to_visit: trip.placesToVisit || [],
                            user_id: currentUser.id,
                            owner_display_name: profile?.name || 'Traveler',
                            owner_photo_url: profile?.photo_url || null,
                            owner_username: profile?.username || null,
                            participants: [currentUser.id],
                            location: trip.toLocation, trip_type: trip.tripType || 'adventure',
                            cover_image: images[0],
                        };

                        const { data: tripRow, error: tripErr } = await supabase.from('trips').insert(tripData).select('id').single();
                        if (tripErr) throw tripErr;

                        await supabase.from('chats').insert({
                            type: 'group',
                            trip_id: tripRow.id,
                            trip_title: trip.title,
                            group_name: trip.title,
                            trip_image: images[0] || null,
                            participants: [currentUser.id],
                            participant_details: {
                                [currentUser.id]: {
                                    displayName: profile?.name || 'Traveler',
                                    photoURL: profile?.photo_url || '',
                                },
                            },
                            member_count: 1,
                            created_by: currentUser.id, 
                            last_message: { text: 'Trip created by Tripzi AI!', sender_id: null, created_at: new Date().toISOString() },
                        });

                        const successMsg: AIMessage = {
                            _id: Date.now() + Math.random(),
                            text: `Done! 🎉 "${trip.title}" has been posted to your profile!`,
                            createdAt: new Date(),
                            user: { _id: 'tripzi-ai', name: 'Tripzi AI' },
                        };
                        await completeUploadNotification('Trip Posted!', `"${trip.title}" has been posted.`);
                        
                        // Trigger sync
                        syncDatabase().catch(err => console.error('[AIPlanner] Post-creation sync failed:', err));
                        
                        setMessages(prev => [successMsg, ...prev]);
                    } catch {
                        await failUploadNotification('Auto-post failed');
                        Alert.alert("Error", "Failed to post trip.");
                    }
                }
            }
        ]);
    };

    const renderTripCard = (jsonString: string) => {
        try {
            let potentialJson = '';
            const match = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
            if (match?.[1]) potentialJson = match[1];
            else {
                const f = jsonString.indexOf('{'), l = jsonString.lastIndexOf('}');
                if (f === -1 || l === -1) return null;
                potentialJson = jsonString.substring(f, l + 1);
            }

            const trip = JSON.parse(potentialJson);
            if (trip.type !== 'trip_plan') return null;

            const coverUrl = trip._unsplashImages?.[0]?.imageUrl || `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800`;
            const itineraryItems: string[] = Array.isArray(trip.itinerary) ? trip.itinerary : (typeof trip.itinerary === 'string' ? trip.itinerary.split('\n').filter((s: any) => s.trim()) : []);

            return (
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={[styles.tripCard, { backgroundColor: colors.card }]}
                >
                    <View style={{ height: 140, width: '100%', backgroundColor: colors.border }}>
                        <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
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
                            <View style={styles.tripCardDetail}><Ionicons name="time-outline" size={14} color={colors.textSecondary} /><Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>{trip.durationDays} days</Text></View>
                            <View style={styles.tripCardDetail}><Ionicons name="wallet-outline" size={14} color={colors.textSecondary} /><Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>₹{trip.cost}</Text></View>
                            <View style={styles.tripCardDetail}><Ionicons name="bus-outline" size={14} color={colors.textSecondary} /><Text style={[styles.tripCardDetailText, { color: colors.textSecondary }]}>{trip.transportMode}</Text></View>
                        </View>
                        <Text style={[styles.tripCardDesc, { color: colors.textSecondary }]} numberOfLines={3}>{trip.description}</Text>
                        {itineraryItems.length > 0 && (
                            <View style={styles.itinerarySection}>
                                <Text style={[styles.itineraryTitle, { color: colors.text }]}>📋 Itinerary</Text>
                                {itineraryItems.slice(0, 3).map((item, idx) => (
                                    <View key={idx} style={styles.itineraryItem}>
                                        <View style={[styles.itineraryDot, { backgroundColor: colors.primary }]} />
                                        <Text style={[styles.itineraryText, { color: colors.textSecondary }]} numberOfLines={2}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        <View style={styles.tripCardActions}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }]} onPress={() => handleCreateTrip(trip)}>
                                <Text style={[styles.actionBtnText, { color: colors.primary }]}>✏️ Edit & Post</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleAutoPostTrip(trip)}>
                                <Text style={styles.actionBtnTextWhite}>🤖 Auto-Post</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </MotiView>
            );
        } catch { return null; }
    };

    const renderLocationRequest = () => (
        <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.locationRequestCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
        >
            <View style={styles.locationRequestIcon}>
                <Ionicons name="location" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.locationRequestTitle, { color: colors.text }]}>Location Access Required</Text>
            <Text style={[styles.locationRequestDesc, { color: colors.textSecondary }]}>
                To find nearby petrol bunks, EV stations, and rentals, Tripzi AI needs to know your location.
            </Text>
            <TouchableOpacity
                style={[styles.locationRequestBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                    setIsTyping(true);
                    const loc = await getCurrentLocation(true);
                    setIsTyping(false);

                    if (loc) {
                        setMessages(prev => {
                            // Filter out the request card and any previous confirmation messages
                            const filtered = prev.filter(m => m.text !== 'TRIPZI_LOCATION_REQUIRED' && !m.text.includes("I have your location now"));
                            return [
                                {
                                    _id: 'loc-confirmed-' + Date.now(),
                                    text: "Great! I have your location now. Please ask your question again and I'll find the best nearby options for you! 📍",
                                    createdAt: new Date(),
                                    user: { _id: 'tripzi-ai', name: 'Tripzi AI' }
                                },
                                ...filtered
                            ];
                        });
                    }
                }}
            >
                <Text style={styles.locationRequestBtnText}>Allow Location Access</Text>
            </TouchableOpacity>
        </MotiView>
    );

    const renderMessage = ({ item }: { item: AIMessage }) => {
        const isUser = item.user._id === 'user';
        if (item.text === 'TRIPZI_LOCATION_REQUIRED') return renderLocationRequest();
        const tripCard = !isUser && (item.text.includes('trip_plan') && item.text.includes('"type"')) ? renderTripCard(item.text) : null;
        const showText = !tripCard;

        return (
            <MotiView
                from={{ opacity: 0, translateX: isUser ? 20 : -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
            >
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <Image source={require('../../assets/Tripzi AI.png')} style={styles.avatarImage} contentFit="cover" />
                    </View>
                )}
                <View style={{ maxWidth: '100%' }}>
                    {showText && (
                        <View style={[styles.bubble, isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card }, isUser ? styles.userBubble : styles.aiBubble]}>
                            <Text style={[styles.messageText, isUser ? { color: '#fff' } : { color: colors.text }]}>{item.text}</Text>
                        </View>
                    )}
                    {tripCard}
                </View>
            </MotiView>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateHero}>
                <Image source={require('../../assets/Tripzi AI.png')} style={styles.emptyStateLogo} contentFit="cover" />
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Tripzi AI</Text>
                <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>Your personal travel planner. What are we exploring next?</Text>
            </View>
            <View style={styles.emptySuggestionsGrid}>
                {EMPTY_STATE_SUGGESTIONS.map((s, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[styles.emptySuggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => { setInputText(s.prompt); setTimeout(() => inputRef.current?.focus(), 100); }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.emptySuggestionIcon}>{s.icon}</Text>
                        <Text style={[styles.emptySuggestionTitle, { color: colors.text }]}>{s.title}</Text>
                        <Text style={[styles.emptySuggestionDesc, { color: colors.textSecondary }]} numberOfLines={2}>{s.prompt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const suggestions = getContextSuggestions(messages);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + SPACING.xs, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={toggleDrawer} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="menu" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modelBadge, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowModelPicker(true)} activeOpacity={0.7}>
                        <Text style={[styles.modelBadgeText, { color: colors.text }]}>{MODELS.find(m => m.id === selectedModel)?.label}</Text>
                        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNewChat} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="create-outline" size={26} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 72}>
                {messages.length === 0 ? (
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACING.lg }}>
                        {renderEmptyState()}
                    </ScrollView>
                ) : (
                    <TypedFlashList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item._id.toString()}
                        inverted
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.listContent, { paddingBottom: SPACING.sm }]}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                        estimatedItemSize={200}
                        ListHeaderComponent={
                            isTyping ? (
                                <View style={styles.typingContainer}>
                                    <View style={styles.avatarContainer}><Image source={require('../../assets/Tripzi AI.png')} style={styles.avatarImage} contentFit="cover" /></View>
                                    <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card }]}><TypingDots color={colors.primary} /></View>
                                </View>
                            ) : null
                        }
                    />
                )}

                {/* Suggestions above input */}
                {suggestions.length > 0 && (
                    <View style={[styles.suggestionsContainer, { borderTopColor: colors.border }]}>
                        <TypedFlashList
                            data={suggestions} horizontal showsHorizontalScrollIndicator={false}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setInputText(item); setTimeout(() => inputRef.current?.focus(), 100); }}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            estimatedItemSize={100}
                        />
                    </View>
                )}

                {/* Input Area */}
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom + SPACING.xs, SPACING.md) }]}>
                    <TextInput
                        ref={inputRef} style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Message Tripzi AI..." placeholderTextColor={colors.textSecondary}
                        value={inputText} onChangeText={setInputText} multiline maxLength={500}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]} onPress={handleSend} disabled={!inputText.trim() || isTyping}>
                        {isTyping ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Side Drawer */}
            {isDrawerOpen && (
                <TouchableWithoutFeedback onPress={toggleDrawer}>
                    <Animated.View style={[styles.drawerOverlay, { opacity: drawerAnim.interpolate({ inputRange: [-DRAWER_WIDTH, 0], outputRange: [0, 1] }) }]} />
                </TouchableWithoutFeedback>
            )}
            <Animated.View style={[styles.drawerContainer, { backgroundColor: colors.card, transform: [{ translateX: drawerAnim }], paddingTop: insets.top }]}>
                <View style={styles.drawerHeader}>
                    <Text style={[styles.drawerTitle, { color: colors.text }]}>Chat History</Text>
                    <TouchableOpacity onPress={toggleDrawer}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
                    <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: colors.primary }]} onPress={handleNewChat}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.newChatBtnText}>New Chat</Text>
                    </TouchableOpacity>
                    <Text style={[styles.drawerSectionTitle, { color: colors.textSecondary }]}>Recent</Text>
                    {conversations.map(conv => (
                        <View key={conv.id} style={[styles.drawerItemWrap, conversationId === conv.id && { backgroundColor: 'rgba(157,116,247,0.1)', borderRadius: BORDER_RADIUS.md }]}>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => handleSelectChat(conv)}>
                                <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
                                <Text style={[styles.drawerItemText, { color: colors.text }]} numberOfLines={1}>{conv.title}</Text>
                            </TouchableOpacity>
                            <View style={styles.drawerItemActions}>
                                <TouchableOpacity onPress={() => openRenameModal(conv)} style={styles.drawerActionBtn}>
                                    <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteChat(conv)} style={styles.drawerActionBtn}>
                                    <Ionicons name="trash" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </Animated.View>

            {/* Rename Modal */}
            <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.renameModalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.renameModalTitle, { color: colors.text }]}>Rename Chat</Text>
                        <TextInput
                            style={[styles.renameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={renameText}
                            onChangeText={setRenameText}
                            autoFocus
                        />
                        <View style={styles.renameModalActions}>
                            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenameModalVisible(false)}>
                                <Text style={[styles.renameBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.renameSubmitBtn, { backgroundColor: colors.primary }]} onPress={handleRenameSubmit}>
                                <Text style={[styles.renameBtnText, { color: '#fff' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Model Picker */}
            <Modal visible={showModelPicker} transparent animationType="fade" onRequestClose={() => setShowModelPicker(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModelPicker(false)}>
                    <MotiView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 200 }}
                        style={[styles.modelDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Text style={[styles.modelDropdownTitle, { color: colors.textSecondary }]}>Select AI Model</Text>
                        {MODELS.map((model) => (
                            <TouchableOpacity key={model.id} style={[styles.modelOption, selectedModel === model.id && { backgroundColor: 'rgba(157,116,247,0.1)' }]} onPress={() => { setSelectedModel(model.id); setShowModelPicker(false); }}>
                                <Text style={styles.modelOptionIcon}>{model.icon}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modelOptionLabel, { color: colors.text }]}>{model.label}</Text>
                                    <Text style={[styles.modelOptionDesc, { color: colors.textSecondary }]}>{model.desc}</Text>
                                </View>
                                {selectedModel === model.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </MotiView>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {},
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
    iconBtn: { padding: SPACING.xs },
    modelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    modelBadgeText: { fontSize: 13, fontWeight: FONT_WEIGHT.semibold },

    // Empty State
    emptyStateContainer: { flex: 1, alignItems: 'center', paddingTop: height * 0.05 },
    emptyStateHero: { alignItems: 'center', marginBottom: SPACING.xl },
    emptyStateLogo: { width: 64, height: 64, borderRadius: 32, marginBottom: SPACING.md },
    emptyStateTitle: { fontSize: 24, fontWeight: FONT_WEIGHT.bold, marginBottom: 8 },
    emptyStateSubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    emptySuggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, justifyContent: 'center' },
    emptySuggestionCard: { width: '45%', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    emptySuggestionIcon: { fontSize: 24, marginBottom: 8 },
    emptySuggestionTitle: { fontSize: 14, fontWeight: FONT_WEIGHT.semibold, marginBottom: 4 },
    emptySuggestionDesc: { fontSize: 12 },

    // Drawer
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
    drawerContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, zIndex: 11, elevation: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)' },
    drawerTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold },
    newChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: 8, marginBottom: SPACING.lg },
    newChatBtnText: { color: '#fff', fontSize: 16, fontWeight: FONT_WEIGHT.semibold },
    drawerSectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    drawerItemWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    drawerItem: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 12 },
    drawerItemText: { fontSize: 15, flex: 1 },
    drawerItemActions: { flexDirection: 'row', alignItems: 'center' },
    drawerActionBtn: { padding: 8 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
    modelDropdown: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: 320 },
    modelDropdownTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
    modelOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg },
    modelOptionIcon: { fontSize: 24 },
    modelOptionLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    modelOptionDesc: { fontSize: 12, marginTop: 2 },

    renameModalContent: { width: '100%', maxWidth: 320, padding: 20, borderRadius: BORDER_RADIUS.xl },
    renameModalTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold, marginBottom: 16 },
    renameInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 12, fontSize: 16, marginBottom: 20 },
    renameModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    renameCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
    renameSubmitBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: BORDER_RADIUS.md },
    renameBtnText: { fontSize: 15, fontWeight: FONT_WEIGHT.semibold },

    // Chat items
    listContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
    messageRow: { flexDirection: 'row', marginBottom: SPACING.md, maxWidth: '85%' },
    userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
    aiRow: { alignSelf: 'flex-start' },
    avatarContainer: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', marginRight: SPACING.xs, backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.08)', borderWidth: 1 },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.xl, marginBottom: 2 },
    userBubble: { borderBottomRightRadius: 4 },
    aiBubble: { borderTopLeftRadius: 4 },
    messageText: { fontSize: FONT_SIZE.md, lineHeight: 22 },

    typingContainer: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 0, marginBottom: SPACING.md },
    typingDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    typingDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.7 },

    suggestionsContainer: { paddingVertical: SPACING.sm, borderTopWidth: 0.5 },
    chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.xl, borderWidth: 1 },
    chipText: { fontSize: FONT_SIZE.sm },

    inputContainer: { flexDirection: 'row', padding: SPACING.sm, paddingHorizontal: SPACING.md, borderTopWidth: 1, alignItems: 'flex-end', gap: SPACING.sm },
    input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16 },
    sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    // Location Request Card
    locationRequestCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, alignItems: 'center', marginHorizontal: SPACING.lg, marginVertical: SPACING.md },
    locationRequestIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(157,116,247,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
    locationRequestTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold, marginBottom: 8 },
    locationRequestDesc: { fontSize: 14, textAlign: 'center', marginBottom: SPACING.lg, paddingHorizontal: SPACING.sm },
    locationRequestBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, borderRadius: BORDER_RADIUS.md },
    locationRequestBtnText: { color: '#fff', fontSize: 15, fontWeight: FONT_WEIGHT.bold },

    // Trip Card
    tripCard: { width: width * 0.75, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginTop: SPACING.sm },
    tripCardBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    tripCardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    tripCardOverlayTitle: { position: 'absolute', bottom: 12, left: 12, right: 12, color: '#fff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    tripCardBody: { padding: SPACING.md },
    tripCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: 4 },
    tripCardText: { fontSize: 15, fontWeight: '600' },
    tripCardDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
    tripCardDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 8 },
    tripCardDetailText: { fontSize: 12, fontWeight: '500' },
    tripCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: SPACING.sm },
    itinerarySection: { marginTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.3)', paddingTop: SPACING.sm },
    itineraryTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    itineraryItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 6 },
    itineraryDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
    itineraryText: { fontSize: 13, flex: 1 },
    tripCardActions: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    actionBtnTextWhite: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
