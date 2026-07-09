import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
    Pressable,
    Dimensions,
    Linking,
    Animated,
} from 'react-native';
import { FlashList } from "@shopify/flash-list";
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { ImageZoom } from '@likashefqet/react-native-image-zoom';

const TypedFlashList = FlashList as any;
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { ChatSkeleton, AvatarSkeleton, TextSkeleton } from '../components/Skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import { useChatMessagesQuery, ChatMessage, ReplyTo } from '../hooks/useChatMessagesQuery';
import { useChatsQuery } from '../hooks/useChatsQuery';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getPublicProfilesByIds } from '../utils/publicProfiles';
import { getBooleanPreference, PREFERENCE_KEYS } from '../utils/preferences';
// Haptics removed from keystrokes for performance (H5)
import DefaultAvatar from '../components/DefaultAvatar';
import LocationPickerModal from '../components/LocationPickerModal';
import LiveLocationMapModal from '../components/LiveLocationMapModal';
import CustomMediaPickerModal from '../components/CustomMediaPickerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { supabase } from '../lib/supabase';
import { database } from '../database';
import Message from '../database/models/Message';
import { Q } from '@nozbe/watermelondb';
import MessageContextMenu from '../components/MessageContextMenu';
import { uploadDirectChatImageToR2, uploadGroupChatImageToR2 } from '../utils/imageUpload';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveChatStore } from '../store/activeChatStore';
import { workersApi } from '../lib/workersApi';
import { getOnlineUsersPresenceState } from '../hooks/usePresence';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

const formatLocationCoordinates = (latitude: number, longitude: number) =>
    `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

const formatEndedTime = (expiresAt: string | Date | undefined) => {
    if (!expiresAt) return 'Sharing ended';
    try {
        const date = new Date(expiresAt);
        const diffMins = differenceInMinutes(new Date(), date);
        if (diffMins < 1) {
            return 'Ended just now';
        }
        if (diffMins < 60) {
            return `Ended ${diffMins} min ago`;
        }
        if (diffMins < 24 * 60) {
            return `Ended today at ${format(date, 'h:mm a')}`;
        }
        return `Ended on ${format(date, 'MMM d')} at ${format(date, 'h:mm a')}`;
    } catch (e) {
        return 'Sharing ended';
    }
};

const ZoomableImage = ({ uri, onClose }: { uri: string; onClose: () => void }) => {
    return (
        <GestureHandlerRootView style={{ flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <ImageZoom
                uri={uri}
                style={{ width: '100%', height: '100%' }}
                minScale={1}
                maxScale={5}
                isSingleTapEnabled={true}
                onSingleTap={onClose}
            />
        </GestureHandlerRootView>
    );
};

const InlineMap = ({
    latitude,
    longitude,
    isLive,
    children,
    onPress,
    style,
}: {
    latitude: number;
    longitude: number;
    isLive?: boolean;
    children?: React.ReactNode;
    onPress?: () => void;
    style?: any;
}) => {
    const [mapReady, setMapReady] = useState(false);
    const { colors, isDarkMode } = useTheme();
    const shimmerAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 0.8,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shimmerAnim]);

    return (
        <View style={[style, { overflow: 'hidden', position: 'relative' }]}>
            <MapView
                provider={PROVIDER_GOOGLE}
                style={[StyleSheet.absoluteFillObject, { opacity: mapReady ? 1 : 0 }]}
                liteMode={Platform.OS === 'android' && !isLive}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                initialRegion={{
                    latitude,
                    longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }}
                onMapReady={() => setMapReady(true)}
                onPress={onPress}
            >
                {children}
            </MapView>
            {!mapReady && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#222' : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                    <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? '#333' : '#F3F4F6', opacity: shimmerAnim }]} />
                    <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
                        <Icon name="MapPin" size={32} color={colors.primary} style={{ opacity: 0.6 }} />
                    </View>
                </View>
            )}
        </View>
    );
};

const ChatScreen = () => {
    const queryClient = useQueryClient();
    const router = useRouter();
    const params = useLocalSearchParams();
    const chatId = (params.id as string) || (params.chatId as string);
    const routeCollectionName = params.collectionName as 'chats' | 'group_chats' | undefined;
    const otherUserId = params.otherUserId as string | undefined;
    const otherUserName = params.otherUserName as string | undefined;
    const otherUserPhoto = params.otherUserPhoto as string | undefined;
    const isGroupParam = String(params.isGroupChat) === 'true';
    const tripTitle = params.tripTitle as string | undefined;
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const { chats } = useChatsQuery();
    const { user: currentUser, userId: currentUserId, isLoading: loadingAuth } = useCurrentUser();
    const chat = chats.find((c) => c.id === chatId);
    const isGroupChat = isGroupParam || chat?.type === 'group';
    const chatCollection = routeCollectionName || (isGroupChat ? 'group_chats' : 'direct_chats');
    const clearedAt = currentUserId ? chat?.clearedAt?.[currentUserId] : undefined;


    const chatType = chatCollection === 'group_chats' ? 'group' : 'direct';
    const { messages, loading, sendMessage, markAsRead, loadMoreMessages, hasMore } = useChatMessagesQuery(chatId, chatType, clearedAt);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const flatListRef = useRef<any>(null);
    const sendingRef = useRef(false); // Ref-based lock to prevent double-send

    // Context menu state
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [showContextMenu, setShowContextMenu] = useState(false);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);

    // Edit state
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
    const [editText, setEditText] = useState('');

    // Attachment picker state
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);

    // Image viewer state
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [customPickerVisible, setCustomPickerVisible] = useState(false);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);

    // Location state
    const [gettingLocation, setGettingLocation] = useState(false);
    const [showLocationOptions, setShowLocationOptions] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    // Live Location state
    const [isSharingLive, setIsSharingLive] = useState(false);
    const [showLiveMap, setShowLiveMap] = useState(false);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const [activeSharersCount, setActiveSharersCount] = useState(0);
    const [activeSharers, setActiveSharers] = useState<any[]>([]);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [showLiveDurationModal, setShowLiveDurationModal] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(15);
    const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);

    // Typing indicator state
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingUpdate = useRef<number>(0);

    // Chat menu state (three-dots)
    const [showChatMenu, setShowChatMenu] = useState(false);

    // Multi-select state for bulk message deletion
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());

    // Mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

    // Last seen / online status
    const [lastSeenText, setLastSeenText] = useState('');
    const [rawPresence, setRawPresence] = useState('');
    const [rawLastSeen, setRawLastSeen] = useState<string | null>(null);
    // Live profile photo from public_profiles
    const [livePhoto, setLivePhoto] = useState<string | null>(null);
    const seededIncomingMediaIds = useRef<Set<string>>(new Set());
    const skipInitialAutoSave = useRef(true);
    const galleryPermissionDenied = useRef(false);

    // Neumorphic computed styles
    const shadowStyle = isDarkMode
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 } as const, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }
        : { shadowColor: '#B0B0C8', shadowOffset: { width: 0, height: 2 } as const, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 };
    const shadowSoft = isDarkMode
        ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 } as const, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 }
        : { shadowColor: '#B0B0C8', shadowOffset: { width: 0, height: 1 } as const, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 };
    const bubbleOtherBg = isDarkMode ? '#1E1E1E' : '#F0F0F3';
    const dayChipBg = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
    const inputBg = isDarkMode ? '#141414' : '#EAEAEF';

    const getSenderPhoto = useCallback((senderId: string) => {
        if (senderId === currentUserId) {
            return currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.photoURL || null;
        }
        return chat?.participantDetails?.[senderId]?.photoURL || null;
    }, [currentUserId, currentUser, chat]);

    const getSenderName = useCallback((senderId: string, fallbackName?: string) => {
        if (senderId === currentUserId) {
            return currentUser?.user_metadata?.full_name || 'You';
        }
        return chat?.participantDetails?.[senderId]?.displayName || fallbackName || 'User';
    }, [currentUserId, currentUser, chat]);

    // Typing dot animations
    const typingAnim1 = useRef(new Animated.Value(0)).current;
    const typingAnim2 = useRef(new Animated.Value(0)).current;
    const typingAnim3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!otherUserTyping) {
            typingAnim1.setValue(0);
            typingAnim2.setValue(0);
            typingAnim3.setValue(0);
            return;
        }
        const createBounce = (anim: Animated.Value, delay: number) =>
            Animated.loop(Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, { toValue: -5, duration: 200, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.delay(Math.max(0, 600 - delay)),
            ]));
        const a1 = createBounce(typingAnim1, 0);
        const a2 = createBounce(typingAnim2, 150);
        const a3 = createBounce(typingAnim3, 300);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, [otherUserTyping]);

    const groupMembers = React.useMemo(() => {
        if (chat?.type !== 'group' || !chat.participantDetails) return [];
        return Object.entries(chat.participantDetails).map(([uid, details]: [string, any]) => ({
            uid,
            ...details
        }));
    }, [chat]);

    // Get chat details
    const otherParticipantUid = currentUser ? (chat?.participants.find((uid) => uid !== currentUser.id) || otherUserId) : otherUserId;
    const otherParticipant = chat?.participantDetails?.[otherParticipantUid || ''];

    const displayName = chat?.type === 'group'
        ? (chat.groupName || tripTitle || 'Group Chat')
        : otherParticipant?.displayName || otherUserName || 'User';
    const displayPhoto = livePhoto || (chat?.type === 'group'
        ? chat.groupIcon
        : otherParticipant?.photoURL || otherUserPhoto);



    // Render Mention Suggestions
    const renderMentionSuggestions = () => {
        if (!mentionQuery) return null;

        return (
            <View style={[styles.mentionList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Tag Everyone Option */}
                {mentionQuery.toLowerCase() === 'everyone'.substring(0, mentionQuery.length) || 'everyone'.includes(mentionQuery.toLowerCase()) ? (
                    <TouchableOpacity style={[styles.mentionItem, { borderBottomColor: colors.border }]} onPress={handleSelectTagEveryone}>
                        <View style={[styles.mentionAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                            <Icon name="Users" size={16} color="#fff" />
                        </View>
                        <Text style={[styles.mentionName, { color: colors.text }]}>Everyone</Text>
                    </TouchableOpacity>
                ) : null}

                <TypedFlashList
                    data={filteredMembers}
                    keyExtractor={(item) => item.uid}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.mentionItem, { borderBottomColor: colors.border }]} onPress={() => handleSelectMention(item)}>
                            {item.photoURL ? (
                                <Image
                                    source={{ uri: item.photoURL }}
                                    style={styles.mentionAvatar}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View style={[styles.mentionAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={{ color: '#fff', fontSize: 12 }}>{item.displayName?.charAt(0)}</Text>
                                </View>
                            )}
                            <Text style={[styles.mentionName, { color: colors.text }]}>{item.displayName}</Text>
                        </TouchableOpacity>
                    )}
                    estimatedItemSize={40}
                />
            </View>
        );
    };

    // Track active chat for notification suppression (skip banner if already viewing this chat)
    const { setActiveChatId, clearActiveChatId } = useActiveChatStore();
    useEffect(() => {
        if (chatId) setActiveChatId(chatId);
        return () => clearActiveChatId();
    }, [chatId]);

    // Mark messages as read when entering chat or when new messages arrive
    useEffect(() => {
        if (chatId) {
            markAsRead();
        }
    }, [chatId, messages.length, markAsRead]);

    // Scroll to bottom on new messages (only if user is near the bottom)
    const isNearBottom = useRef(true);
    useEffect(() => {
        if (messages.length > 0 && isNearBottom.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    // Fetch initial presence + live profile photo for direct chats (DB only, one-time)
    // Live updates come from the updateStatusText interval below via getOnlineUsersPresenceState().
    useEffect(() => {
        if (!otherParticipantUid || chat?.type === 'group') return;

        const loadPresence = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('photo_url, presence, last_seen_at')
                .eq('id', otherParticipantUid)
                .maybeSingle();
            if (error || !data) return;
            if (data.photo_url) setLivePhoto(data.photo_url);
            setRawPresence(typeof data.presence === 'string' ? data.presence.toLowerCase() : '');
            setRawLastSeen(data.last_seen_at);
        };

        loadPresence();
        // No channel subscription — ChatScreen reads presence via getOnlineUsersPresenceState()
        // called inside the 10-second updateStatusText interval below.
    }, [otherParticipantUid, chat?.type]);

    // Periodic effect to recalculate presence status text based on raw presence and last seen time
    useEffect(() => {
        if (!otherParticipantUid || chat?.type === 'group') return;

        const updateStatusText = () => {
            // First check live Presence channel (real-time, no subscription needed)
            const livePresence = otherParticipantUid ? getOnlineUsersPresenceState(otherParticipantUid) : null;
            if (livePresence) {
                // Update rawPresence/rawLastSeen from live channel state
                setRawPresence(livePresence.status || 'online');
                if (livePresence.online_at) setRawLastSeen(livePresence.online_at);
            }

            // Determine final presence (using latest rawPresence which may have just been updated)
            let finalPresence = livePresence?.status ?? rawPresence;
            if (finalPresence === 'away') {
                finalPresence = 'offline';
            }
            if (rawLastSeen) {
                try {
                    const ts = new Date(rawLastSeen);
                    const diffMs = Date.now() - ts.getTime();
                    // Enforce offline timeout override if last_seen_at is older than 40 seconds (40000ms)
                    if (diffMs > 40000) {
                        finalPresence = 'offline';
                    }
                } catch { }
            }

            if (finalPresence === 'online') {
                setLastSeenText('online');
                return;
            }

            if (rawLastSeen) {
                try {
                    const ts = new Date(rawLastSeen);
                    const diffMs = Date.now() - ts.getTime();
                    if (diffMs < 60 * 1000) {
                        setLastSeenText('last seen just now');
                    } else if (diffMs < 60 * 60 * 1000) {
                        setLastSeenText(`last seen ${Math.floor(diffMs / 60000)} min ago`);
                    } else if (diffMs < 24 * 60 * 60 * 1000) {
                        setLastSeenText(`last seen ${Math.floor(diffMs / 3600000)}h ago`);
                    } else {
                        setLastSeenText(`last seen ${format(ts, 'MMM d, h:mm a')}`);
                    }
                } catch {
                    setLastSeenText(finalPresence === 'offline' ? 'offline' : '');
                }
            } else {
                setLastSeenText(finalPresence === 'offline' ? 'offline' : (finalPresence || ''));
            }
        };

        updateStatusText(); // Run immediately

        // Recalculate status text every 10 seconds
        const timer = setInterval(updateStatusText, 10000);
        return () => clearInterval(timer);
    }, [rawPresence, rawLastSeen, otherParticipantUid, chat?.type]);










    // Auto-save incoming media to gallery if preference enabled
    useEffect(() => {
        if (!messages.length || !currentUserId) return;

        const incomingImageIds = messages
            .filter((message) => message.type === 'image' && !!message.mediaUrl && message.senderId !== currentUserId)
            .map((message) => message.id);

        if (skipInitialAutoSave.current) {
            incomingImageIds.forEach((id) => seededIncomingMediaIds.current.add(id));
            skipInitialAutoSave.current = false;
            return;
        }

        const newIncomingImages = messages.filter(
            (message) =>
                message.type === 'image' &&
                !!message.mediaUrl &&
                message.senderId !== currentUserId &&
                !seededIncomingMediaIds.current.has(message.id)
        );

        if (newIncomingImages.length === 0) {
            return;
        }

        const saveIncomingMedia = async () => {
            const shouldSave = await getBooleanPreference(PREFERENCE_KEYS.saveToGallery, true);
            if (!shouldSave || galleryPermissionDenied.current) {
                newIncomingImages.forEach((message) => seededIncomingMediaIds.current.add(message.id));
                return;
            }

            let permission = await MediaLibrary.getPermissionsAsync();
            if (permission.status !== 'granted') {
                permission = await MediaLibrary.requestPermissionsAsync();
            }

            if (permission.status !== 'granted') {
                galleryPermissionDenied.current = true;
                return;
            }

            for (const message of newIncomingImages) {
                try {
                    const extension = message.mediaUrl?.split('.').pop()?.split('?')[0] || 'jpg';
                    const localUri = `${FileSystem.cacheDirectory}${message.id}.${extension}`;
                    await FileSystem.downloadAsync(message.mediaUrl!, localUri);
                    await MediaLibrary.createAssetAsync(localUri);
                    seededIncomingMediaIds.current.add(message.id);
                } catch {
                    // Keep the message unsaved; the app should continue normally.
                }
            }
        };

        void saveIncomingMedia();
    }, [messages, currentUserId]);

    // Typing indicator listener (throttled — only reads typing field)
    useEffect(() => {
        if (!chatId || !currentUserId) return;

        const table = chatCollection;
        const channel = supabase
            .channel(`typing-${chatId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: table,
                filter: `id=eq.${chatId}`,
            }, (payload) => {
                const data = payload.new as any;
                if (data?.typing) {
                    const typingUsers = Object.entries(data.typing)
                        .filter(([uid, timestamp]: [string, any]) => {
                            if (uid === currentUserId) return false;
                            const ts = new Date(timestamp);
                            return Date.now() - ts.getTime() < 10000;
                        });
                    setOtherUserTyping(typingUsers.length > 0);
                } else {
                    setOtherUserTyping(false);
                }
            })
            .subscribe();

        supabase.from(table).select('typing').eq('id', chatId).maybeSingle().then(({ data }) => {
            if (data?.typing) {
                const typingUsers = Object.entries(data.typing)
                    .filter(([uid, timestamp]: [string, any]) => {
                        if (uid === currentUserId) return false;
                        const ts = new Date(timestamp as string);
                        return Date.now() - ts.getTime() < 10000;
                    });
                setOtherUserTyping(typingUsers.length > 0);
            }
        });

        return () => { supabase.removeChannel(channel); };
    }, [chatId, currentUserId]);

    // Check for active live sharers
    useEffect(() => {
        if (!chatId) return;
        const channel = supabase
            .channel(`live-shares-${chatId}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'live_shares',
                filter: `chat_id=eq.${chatId}`,
            }, () => {
                fetchActiveSharers();
            })
            .subscribe();

        const fetchActiveSharers = async () => {
            const { data, error } = await supabase
                .from('live_shares')
                .select(`
                    id, chat_id, chat_type, user_id, latitude, longitude, is_active, expires_at, updated_at, heading,
                    profiles:user_id (
                        name,
                        photo_url
                    )
                `)
                .eq('chat_id', chatId)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());

            if (error) return;

            const list = (data || []).map((d: any) => {
                const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
                return {
                    ...d,
                    profiles: profile
                };
            });
            setActiveSharers(list);
            setActiveSharersCount(list.length);

            if (currentUserId) {
                const myShare = list.find(s => s.user_id === currentUserId);
                if (myShare && !isSharingLive) {
                    setIsSharingLive(true);
                    startLiveLocationHeaderResume();
                } else if (!myShare && isSharingLive) {
                    setIsSharingLive(false);
                    stopLiveSharing(false);
                }
            }
        };

        fetchActiveSharers();

        return () => { supabase.removeChannel(channel); };
    }, [chatId, currentUserId, isSharingLive]);

    const startLiveLocationHeaderResume = async () => {
        // Silently resume watcher if permissions allow
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted' && !locationSubscription.current) {
                startLocationWatcher();
            }
        } catch (e) { }
    };

    // Update typing status
    const updateTypingStatus = useCallback((isTypingParam: boolean) => {
        if (!chatId || !currentUserId) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        const table = chatCollection;

        if (isTypingParam) {
            const now = Date.now();
            // Throttle DB updates to once every 2 seconds
            if (!isTyping || (now - lastTypingUpdate.current > 2000)) {
                setIsTyping(true);
                lastTypingUpdate.current = now;
                supabase.from(table).select('typing').eq('id', chatId).maybeSingle().then(({ data }) => {
                    const typing = data?.typing || {};
                    typing[currentUserId] = new Date().toISOString();
                    supabase.from(table).update({ typing }).eq('id', chatId);
                });
            }

            typingTimeoutRef.current = setTimeout(() => {
                updateTypingStatus(false);
            }, 3000);
        } else {
            setIsTyping(false);
            lastTypingUpdate.current = 0;
            supabase.from(table).select('typing').eq('id', chatId).maybeSingle().then(({ data }) => {
                const typing = data?.typing || {};
                if (typing[currentUserId]) {
                    delete typing[currentUserId];
                    supabase.from(table).update({ typing }).eq('id', chatId);
                }
            });
        }
    }, [chatId, currentUserId, isTyping, chatCollection]);

    // Handle text input — H5: removed haptics from keystrokes for performance
    const handleTextChange = (text: string) => {
        setInputText(text);

        // Mention logic
        if (chat?.type === 'group') {
            const lastAt = text.lastIndexOf('@');
            if (lastAt !== -1) {
                const query = text.substring(lastAt + 1);
                // Check if query contains space (end of mention)
                if (!query.includes(' ')) {
                    setMentionQuery(query);
                    const lowerQuery = query.toLowerCase();
                    const matches = groupMembers.filter(m =>
                        (m.displayName || '').toLowerCase().includes(lowerQuery)
                    );
                    setFilteredMembers(matches);
                } else {
                    setMentionQuery(null);
                }
            } else {
                setMentionQuery(null);
            }
        }

        if (text.length > 0) {
            updateTypingStatus(true);
        } else {
            updateTypingStatus(false);
        }
    };

    const handleSelectMention = (member: any) => {
        if (!mentionQuery) return;
        const lastAt = inputText.lastIndexOf('@');
        const prefix = inputText.substring(0, lastAt);
        const suffix = inputText.substring(lastAt + mentionQuery.length + 1); // +1 might be wrong if query is varying
        // actually simplest is: replace the last @query with @Name 
        const newText = prefix + `@${member.displayName} ` + suffix; // Add space
        setInputText(newText);
        setMentionQuery(null);
    };

    const handleSelectTagEveryone = () => {
        if (!mentionQuery) return;
        const lastAt = inputText.lastIndexOf('@');
        const prefix = inputText.substring(0, lastAt);
        const newText = prefix + `@everyone `;
        setInputText(newText);
        setMentionQuery(null);
    };

    const handleSend = async () => {
        // Use ref for immediate check to prevent rapid double-taps
        if (!inputText.trim() || sending || sendingRef.current) return;

        sendingRef.current = true; // Lock immediately
        setSending(true);
        setIsTyping(false);
        updateTypingStatus(false);

        const textToSend = inputText.trim();
        setInputText(''); // Clear input immediately to prevent re-send
        setMentionQuery(null);

        // Extract mentions
        const mentions: string[] = [];
        if (chat?.type === 'group') {
            if (textToSend.includes('@everyone')) {
                mentions.push('everyone');
            }
            groupMembers.forEach(m => {
                if (textToSend.includes(`@${m.displayName}`)) {
                    mentions.push(m.uid);
                }
            });
        }

        try {
            const result = await sendMessage(textToSend, replyingTo || undefined, mentions);
            setReplyingTo(null);
            if (result && result.status === 'pending') {
                Alert.alert('Offline Mode', 'Your message has been saved locally and will be sent automatically when you are back online.');
            }
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to send message.');
            setInputText(textToSend); // Restore on error
        } finally {
            setSending(false);
            sendingRef.current = false; // Unlock
        }
    };



    const pickImage = async (useCamera: boolean = false) => {
        setShowAttachmentPicker(false);

        if (!useCamera) {
            setCustomPickerVisible(true);
            return;
        }

        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant access to continue.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                setPreviewImages([result.assets[0].uri]);
                setPreviewModalVisible(true);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const sendImageMessage = async (imageUri: string) => {
        if (!currentUser || !chatId) return;

        // Fetch name for optimistic message
        const { data: userData } = await supabase.from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
        const uData: any = userData || {};
        const senderName = uData.name || currentUser.user_metadata?.full_name || 'User';

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
            const list = old || [];
            return [...list, {
                id: tempId,
                senderId: currentUser.id,
                senderName: senderName,
                type: 'image',
                mediaUrl: imageUri,
                status: 'pending',
                readBy: {},
                deliveredTo: [],
                deletedFor: [],
                createdAt: new Date(),
            }];
        });

        setUploading(true);

        try {
            const isGroup = chat?.type === 'group';
            const uploadFn = isGroup ? uploadGroupChatImageToR2 : uploadDirectChatImageToR2;
            const { success, url, error: uploadError } = await uploadFn(imageUri, currentUser.id, chatId);
            if (!success || !url) throw new Error(uploadError || 'Upload failed');
            const downloadUrl = url;

            await supabase.from('messages').insert({
                chat_id: chatId,
                chat_type: isGroup ? 'group' : 'direct',
                sender_id: currentUser.id,
                sender_name: senderName,
                type: 'image',
                media_url: downloadUrl,
                status: 'sent',
                read_by: {},
                delivered_to: [],
            });

            const parentTable = isGroup ? 'group_chats' : 'direct_chats';

            // M5: Use RPC for atomic unread count increment
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('participants')
                .eq('id', chatId)
                .maybeSingle();

            if (chatData) {
                const participants = chatData.participants || [];
                for (const pId of participants) {
                    if (pId !== currentUser.id) {
                        await supabase.rpc('increment_unread_count', {
                            p_chat_id: chatId,
                            p_chat_type: isGroup ? 'group' : 'direct',
                            p_user_id: pId,
                        });
                    }
                }
            }

            await supabase
                .from(parentTable)
                .update({
                    last_message: {
                        text: '📷 Photo',
                        sender_id: currentUser.id,
                        sender_name: senderName,
                        created_at: new Date().toISOString(),
                        type: 'image',
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', chatId);

            // Send push notification to other participants (fire-and-forget)
            workersApi('/chat/send-notification', {
                method: 'POST',
                body: {
                    chatId,
                    chatType: isGroup ? 'group' : 'direct',
                    senderName,
                    messagePreview: '📷 Photo',
                },
            }).catch(() => {});

        } catch (error) {
            Alert.alert('Error', 'Failed to send image.');
            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
                return (old || []).filter(m => m.id !== tempId);
            });
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmMediaSelection = (uris: string[]) => {
        if (uris.length > 0) {
            setPreviewImages(uris);
            setPreviewModalVisible(true);
        }
    };

    const sendMultipleImages = async (uris: string[]) => {
        setUploading(true);
        setPreviewModalVisible(false);
        try {
            for (const uri of uris) {
                await sendImageMessage(uri);
            }
        } catch (error) {
            // Handled inside sendImageMessage
        } finally {
            setUploading(false);
            setPreviewImages([]);
        }
    };

    const requestForegroundLocationPermission = async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
            Alert.alert('Permission needed', 'Please enable location access to use this option.');
            return false;
        }
        return true;
    };

    const updateLiveShareCoordinates = async (coords: { latitude: number; longitude: number; heading?: number | null }, expiresAt?: string) => {
        if (!currentUser || !chatId) {
            return;
        }

        try {
            const isGroup = chat?.type === 'group';
            const payload: any = {
                chat_id: chatId,
                chat_type: isGroup ? 'group' : 'direct',
                user_id: currentUser.id,
                latitude: coords.latitude,
                longitude: coords.longitude,
                heading: coords.heading ?? null,
                is_active: true,
                updated_at: new Date().toISOString(),
            };
            if (expiresAt) {
                payload.expires_at = expiresAt;
            }

            await supabase
                .from('live_shares')
                .upsert(payload, { onConflict: 'chat_id,user_id' });
        } catch (error) {
            // Error updating live location
        }
    };

    // Location sharing
    const sendLocation = async (pickedLocation?: { latitude: number; longitude: number; address?: string }) => {
        setShowAttachmentPicker(false);
        setGettingLocation(true);

        try {
            let locationData;

            if (pickedLocation) {
                locationData = {
                    coords: {
                        latitude: pickedLocation.latitude,
                        longitude: pickedLocation.longitude
                    },
                    address: pickedLocation.address
                };
            } else {
                const hasLocationPermission = await requestForegroundLocationPermission();
                if (!hasLocationPermission) {
                    setGettingLocation(false);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                locationData = {
                    coords: location.coords,
                    address: ''
                };
            }

            // Get address if not provided
            let address = locationData.address || '';
            if (!address) {
                try {
                    const [addressResult] = await Location.reverseGeocodeAsync({
                        latitude: locationData.coords.latitude,
                        longitude: locationData.coords.longitude,
                    });
                    if (addressResult) {
                        address = [addressResult.street, addressResult.city, addressResult.country]
                            .filter(Boolean)
                            .join(', ');
                    }
                } catch (e) {
                    // Geocoding failed
                }
            }

            if (!currentUser || !chatId) return;

            const userDoc = await supabase.from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
            const userData: any = userDoc.data || {};

            const isGroup = chat?.type === 'group';
            const senderName = userData?.name || currentUser.user_metadata?.full_name || 'User';

            // Optimistic Update
            const tempId = `temp-${Date.now()}`;
            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
                const list = old || [];
                return [...list, {
                    id: tempId,
                    senderId: currentUser.id,
                    senderName: senderName,
                    type: 'location',
                    location: {
                        latitude: locationData.coords.latitude,
                        longitude: locationData.coords.longitude,
                        address: address,
                    },
                    status: 'pending',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: new Date(),
                }];
            });

            await supabase.from('messages').insert({
                chat_id: chatId,
                chat_type: isGroup ? 'group' : 'direct',
                sender_id: currentUser.id,
                sender_name: senderName,
                type: 'location',
                location: {
                    latitude: locationData.coords.latitude,
                    longitude: locationData.coords.longitude,
                    address: address,
                },
                status: 'sent',
                read_by: {},
                delivered_to: [],
                deleted_for: [],
            });

            const parentTable = isGroup ? 'group_chats' : 'direct_chats';

            // M5: Use RPC for atomic unread count increment
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('participants')
                .eq('id', chatId)
                .maybeSingle();

            if (chatData) {
                const participants = chatData.participants || [];
                for (const pId of participants) {
                    if (pId !== currentUser.id) {
                        await supabase.rpc('increment_unread_count', {
                            p_chat_id: chatId,
                            p_chat_type: isGroup ? 'group' : 'direct',
                            p_user_id: pId,
                        });
                    }
                }
            }

            await supabase
                .from(parentTable)
                .update({
                    last_message: {
                        text: '📍 Location',
                        sender_id: currentUser.id,
                        sender_name: senderName,
                        created_at: new Date().toISOString(),
                        type: 'location',
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', chatId);

            // Send push notification to other participants (fire-and-forget)
            workersApi('/chat/send-notification', {
                method: 'POST',
                body: {
                    chatId,
                    chatType: isGroup ? 'group' : 'direct',
                    senderName,
                    messagePreview: '📍 Location',
                },
            }).catch(() => {});

        } catch (error) {
            Alert.alert('Error', 'Failed to get location.');
        } finally {
            setGettingLocation(false);
        }
    };

    // Live Location Logic
    const startLiveSharing = (durationMinutes: number) => {
        Alert.alert(
            'Share Live Location',
            `Share your live location for ${durationMinutes} minutes?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start Sharing', onPress: async () => {
                        try {
                            if (!currentUser || !chatId) {
                                return;
                            }

                            const hasLocationPermission = await requestForegroundLocationPermission();
                            if (!hasLocationPermission) {
                                return;
                            }

                            setIsSharingLive(true);

                            const initialLocation = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });

                            const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

                            await updateLiveShareCoordinates(initialLocation.coords, expiresAt);
                            startLocationWatcher();

                            // Send a live location message to the chat
                            const userDoc = await supabase.from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
                            const userData: any = userDoc?.data || {};
                            const isGroup = chat?.type === 'group';
                            const senderName = userData?.name || currentUser.user_metadata?.full_name || 'User';

                            // Optimistic update for live location
                            const tempId = `temp-${Date.now()}`;
                            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
                                const list = old || [];
                                return [...list, {
                                    id: tempId,
                                    senderId: currentUser.id,
                                    senderName: senderName,
                                    type: 'location',
                                    location: {
                                        latitude: initialLocation.coords.latitude,
                                        longitude: initialLocation.coords.longitude,
                                        isLive: true,
                                        expires_at: expiresAt,
                                        duration: durationMinutes,
                                    },
                                    status: 'pending',
                                    readBy: {},
                                    deliveredTo: [],
                                    deletedFor: [],
                                    createdAt: new Date(),
                                }];
                            });

                            await supabase.from('messages').insert({
                                chat_id: chatId,
                                chat_type: isGroup ? 'group' : 'direct',
                                sender_id: currentUser.id,
                                sender_name: senderName,
                                type: 'location',
                                location: {
                                    latitude: initialLocation.coords.latitude,
                                    longitude: initialLocation.coords.longitude,
                                    isLive: true,
                                    expires_at: expiresAt,
                                    duration: durationMinutes,
                                },
                                status: 'sent',
                                read_by: {},
                                delivered_to: [],
                                deleted_for: [],
                            });

                            const parentTable = isGroup ? 'group_chats' : 'direct_chats';

                            // M5: Use RPC for atomic unread count increment
                            const { data: chatData } = await supabase
                                .from(parentTable)
                                .select('participants')
                                .eq('id', chatId)
                                .maybeSingle();

                            if (chatData) {
                                const participants = chatData.participants || [];
                                for (const pId of participants) {
                                    if (pId !== currentUser.id) {
                                        await supabase.rpc('increment_unread_count', {
                                            p_chat_id: chatId,
                                            p_chat_type: isGroup ? 'group' : 'direct',
                                            p_user_id: pId,
                                        });
                                    }
                                }
                            }

                            await supabase
                                .from(parentTable)
                                .update({
                                    last_message: {
                                        text: '📍 Live Location',
                                        sender_id: currentUser.id,
                                        sender_name: senderName,
                                        created_at: new Date().toISOString(),
                                        type: 'location',
                                    },
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', chatId);

                            // Send push notification (fire-and-forget)
                            workersApi('/chat/send-notification', {
                                method: 'POST',
                                body: {
                                    chatId,
                                    chatType: isGroup ? 'group' : 'direct',
                                    senderName,
                                    messagePreview: '📍 Live Location',
                                },
                            }).catch(() => {});

                        } catch (error) {
                            setIsSharingLive(false);
                        }
                    }
                }
            ]
        );
    };

    // Auto-cleanup watcher when screen unmounts or user stops sharing
    useEffect(() => {
        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
            }
        };
    }, []);

    const startLocationWatcher = async () => {
        if (locationSubscription.current) return;

        try {
            const permission = await Location.getForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                await stopLiveSharing(true);
                return;
            }

            const sub = await Location.watchPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000, // 10 seconds
                distanceInterval: 20, // 20 meters
            }, async (loc) => {
                await updateLiveShareCoordinates(loc.coords);
            });
            locationSubscription.current = sub;
        } catch (e) {

        }
    };

    const stopLiveSharing = async (updateDoc = true) => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        setIsSharingLive(false);

        if (updateDoc && currentUser && chatId) {
            try {
                // Update live shares remotely
                await supabase
                    .from('live_shares')
                    .update({ is_active: false, expires_at: new Date().toISOString() })
                    .eq('chat_id', chatId)
                    .eq('user_id', currentUser.id);

                // Find the active live location message in WatermelonDB
                const messagesCollection = database.get('messages');
                const localMsgs = await messagesCollection.query(
                    Q.where('chat_id', chatId),
                    Q.where('sender_id', currentUser.id),
                    Q.where('type', 'location'),
                    Q.sortBy('created_at', Q.desc),
                    Q.take(1)
                ).fetch();

                if (localMsgs.length > 0) {
                    const localMsg = localMsgs[0] as Message;
                    const locObj = localMsg.locationData;
                    if (locObj && locObj.isLive) {
                        locObj.expires_at = new Date().toISOString();

                        // Update locally in WatermelonDB
                        await database.write(async () => {
                            await localMsg.update((rec: any) => {
                                rec.locationRaw = JSON.stringify(locObj);
                                rec._raw.updated_at = Date.now();
                            });
                        });

                        // Update remotely in Supabase
                        await supabase
                            .from('messages')
                            .update({ location: locObj })
                            .eq('id', localMsg.id);
                    }
                }

                // Invalidate query to trigger visual re-render immediately
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            } catch (error) {
                if (__DEV__) console.warn('[stopLiveSharing] Error stopping live sharing:', error);
            }
        }
    };

    // Open location in maps
    const openLocationInMaps = (lat: number, lng: number) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            Alert.alert('Location unavailable', 'This location could not be opened.');
            return;
        }

        const fallbackUrl = `${GOOGLE_MAPS_SEARCH_URL}${lat},${lng}`;
        const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lng}`,
            android: `geo:0,0?q=${lat},${lng}`,
        }) || fallbackUrl;

        Linking.openURL(url).catch(() => {
            Linking.openURL(fallbackUrl);
        });
    };



    const handleReplyPress = (replyToId: string) => {
        const index = messages.findIndex(m => m.id === replyToId);
        if (index !== -1) {
            try {
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.5,
                });
                setHighlightedMessageId(replyToId);
                setTimeout(() => {
                    setHighlightedMessageId(null);
                }, 1000);
            } catch (e) {
                // Fallback
            }
        }
    };

    // Long press handler
    const handleLongPress = (message: ChatMessage) => {
        setSelectedMessage(message);
        setShowContextMenu(true);
    };

    // Context menu actions
    const handleReply = () => {
        if (!selectedMessage) return;
        setReplyingTo({
            messageId: selectedMessage.id,
            text: selectedMessage.text
                || (selectedMessage.type === 'image'
                    ? '📷 Photo'
                    : selectedMessage.type === 'location'
                        ? '📍 Location'
                        : selectedMessage.type === 'trip_share'
                            ? '🧳 Trip'
                            : '🎤 Voice'),
            senderId: selectedMessage.senderId,
        });
        setShowContextMenu(false);
        setSelectedMessage(null);
    };

    const handleEdit = () => {
        if (!selectedMessage || selectedMessage.senderId !== currentUser?.id) return;
        setEditingMessage(selectedMessage);
        setEditText(selectedMessage.text || '');
        setShowContextMenu(false);
        setSelectedMessage(null);
    };

    const handleDelete = (forEveryone: boolean = false) => {
        if (!selectedMessage || !currentUser) return;

        // L2: Use Date directly, no .toDate() Firestore remnant
        const canDeleteForEveryone = selectedMessage.senderId === currentUser.id &&
            selectedMessage.createdAt &&
            differenceInMinutes(new Date(), new Date(selectedMessage.createdAt as any)) < 60;

        Alert.alert(
            'Delete Message',
            forEveryone && canDeleteForEveryone
                ? 'This message will be deleted for everyone.'
                : 'This message will be removed from your view.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Optimistic Update
                        queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
                            if (!old) return [];
                            return old.map((m) => {
                                if (m.id === selectedMessage.id) {
                                    if (forEveryone && canDeleteForEveryone) {
                                        return {
                                            ...m,
                                            deletedForEveryoneAt: new Date(),
                                            text: '',
                                            mediaUrl: undefined,
                                        };
                                    } else {
                                        return {
                                            ...m,
                                            deletedFor: [...(m.deletedFor || []), currentUser.id],
                                        };
                                    }
                                }
                                return m;
                            });
                        });

                        try {
                            if (forEveryone && canDeleteForEveryone) {
                                // D2: Use RPC for atomic delete-for-everyone
                                const { error: rpcError } = await supabase.rpc('delete_message_for_everyone', {
                                    p_message_id: selectedMessage.id,
                                    p_sender_id: currentUser.id,
                                });
                                if (rpcError) throw rpcError;
                            } else {
                                // D1: Use RPC for atomic delete-for-me (no race condition)
                                const { error: rpcError } = await supabase.rpc('delete_message_for_user', {
                                    p_message_id: selectedMessage.id,
                                    p_user_id: currentUser.id,
                                });
                                if (rpcError) throw rpcError;
                            }
                        } catch (error) {
                            // D5: Proper error handling instead of silent swallowing
                            if (__DEV__) console.error('[handleDelete] Error:', error);
                            Alert.alert('Error', 'Failed to delete message. Please try again.');
                            // Revert optimistic update on failure
                            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                        }
                    },
                },
            ]
        );

        setShowContextMenu(false);
        setSelectedMessage(null);
    };

    const saveEdit = async () => {
        if (!editingMessage || !editText.trim()) return;

        try {
            await supabase
                .from('messages')
                .update({
                    text: editText.trim(),
                    edited_at: new Date().toISOString(),
                })
                .eq('id', editingMessage.id);
            setEditingMessage(null);
            setEditText('');
        } catch (error) {
            Alert.alert('Error', 'Failed to edit message.');
        }
    };

    const getMessageStatus = useCallback((message: ChatMessage) => {
        if (message.senderId !== currentUserId) return null;

        const readByOthers = Object.keys(message.readBy || {}).filter(uid => uid !== currentUserId);
        if (readByOthers.length > 0) return 'read';
        if (message.deliveredTo?.length > 0) return 'delivered';
        if (message.status === 'sent') return 'sent';
        return 'pending';
    }, [currentUserId]);

    // Clear all messages in chat — D3/C5: Fixed to use correct table + RPC
    const handleClearChat = () => {
        Alert.alert(
            'Clear Chat',
            'Are you sure you want to delete all messages? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!currentUser || !chatId) return;
                            const chatTypeForRpc = (chat?.type === 'group' || isGroupParam) ? 'group' : 'direct';

                            // Use RPC for atomic clear in the backend
                            const { error: rpcError } = await supabase.rpc('clear_chat_for_user', {
                                p_chat_id: chatId,
                                p_chat_type: chatTypeForRpc,
                                p_user_id: currentUser.id,
                            });
                            if (rpcError) throw rpcError;

                            const nowStr = new Date().toISOString();
                            const nowMs = Date.now();
                            const parentTable = chatTypeForRpc === 'group' ? 'group_chats' : 'direct_chats';

                            // Update local database immediately (cleared_at and delete local messages)
                            try {
                                await database.write(async () => {
                                    // 1. Update local chat cleared_at
                                    try {
                                        const chatRecord = await database.get(parentTable).find(chatId);
                                        await chatRecord.update((rec: any) => {
                                            let currentClearedAt: Record<string, string> = {};
                                            if (rec.clearedAtRaw) {
                                                try {
                                                    currentClearedAt = JSON.parse(rec.clearedAtRaw) || {};
                                                } catch (e) { }
                                            }
                                            currentClearedAt[currentUser.id] = nowStr;
                                            rec.clearedAtRaw = JSON.stringify(currentClearedAt);
                                            rec._raw.updated_at = nowMs;
                                        });
                                    } catch (chatFindErr) {
                                        if (__DEV__) console.warn('[handleClearChat] Chat record not found locally to update cleared_at');
                                    }

                                    // 2. Delete messages of this chat locally
                                    const messagesCollection = database.get('messages');
                                    const localMsgs = await messagesCollection.query(
                                        Q.where('chat_id', chatId),
                                        Q.where('created_at', Q.lte(nowMs))
                                    ).fetch();

                                    const batch = localMsgs.map(m => m.prepareDestroyPermanently());
                                    if (batch.length > 0) {
                                        await database.batch(...batch);
                                    }
                                });
                            } catch (dbErr) {
                                console.error('[handleClearChat] Local database write failed:', dbErr);
                            }

                            // Clear local cache
                            queryClient.setQueryData<ChatMessage[]>(['messages', chatId], []);

                            // Invalidate chats to update clearedAt immediately on UI/Cache
                            queryClient.invalidateQueries({ queryKey: ['chats', currentUser.id] });
                            queryClient.invalidateQueries({ queryKey: ['groupChats', currentUser.id] });

                            setShowChatMenu(false);
                        } catch (error) {
                            if (__DEV__) console.error('[handleClearChat] Error:', error);
                            Alert.alert('Error', 'Failed to clear chat.');
                        }
                    },
                },
            ]
        );
    };

    // Toggle message selection
    const toggleMessageSelection = (messageId: string) => {
        setSelectedMessages((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    // Handle bulk delete — using RPCs for atomic operations
    const handleBulkDelete = (forEveryone: boolean = false) => {
        if (selectedMessages.size === 0) return;

        Alert.alert(
            `Delete ${selectedMessages.size} Message${selectedMessages.size > 1 ? 's' : ''}`,
            forEveryone
                ? 'These messages will be deleted for everyone.'
                : 'These messages will be removed from your view.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const ids = Array.from(selectedMessages);

                        // Optimistic Update
                        queryClient.setQueryData<ChatMessage[]>(['messages', chatId], (old) => {
                            if (!old) return [];
                            return old.map((m) => {
                                if (ids.includes(m.id)) {
                                    if (forEveryone) {
                                        return {
                                            ...m,
                                            deletedForEveryoneAt: new Date(),
                                            text: '',
                                            mediaUrl: undefined,
                                        };
                                    } else {
                                        return {
                                            ...m,
                                            deletedFor: [...(m.deletedFor || []), currentUser!.id],
                                        };
                                    }
                                }
                                return m;
                            });
                        });

                        try {
                            if (!currentUser) return;
                            if (forEveryone) {
                                // Use RPC for each message (atomic per message)
                                await Promise.all(ids.map(id =>
                                    supabase.rpc('delete_message_for_everyone', {
                                        p_message_id: id,
                                        p_sender_id: currentUser.id,
                                    })
                                ));
                            } else {
                                // Use RPC for atomic delete-for-me
                                await Promise.all(ids.map(id =>
                                    supabase.rpc('delete_message_for_user', {
                                        p_message_id: id,
                                        p_user_id: currentUser.id,
                                    })
                                ));
                            }
                        } catch (error) {
                            if (__DEV__) console.error('[handleBulkDelete] Error:', error);
                            Alert.alert('Error', 'Failed to delete messages.');
                            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
                        } finally {
                            setSelectedMessages(new Set());
                            setIsSelectionMode(false);
                        }
                    },
                },
            ]
        );
    };

    // Cancel selection mode
    const cancelSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedMessages(new Set());
    }, []);

    // L1: Removed .toDate() Firestore remnant
    const formatMessageTime = useCallback((timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            return format(date, 'h:mm a');
        } catch {
            return '';
        }
    }, []);

    // L1: Removed .toDate() Firestore remnant
    const formatDayHeader = useCallback((timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            if (isToday(date)) return 'Today';
            if (isYesterday(date)) return 'Yesterday';
            return format(date, 'MMMM d, yyyy');
        } catch {
            return '';
        }
    }, []);

    // L1: Removed .toDate() Firestore remnant
    const shouldShowDayHeader = useCallback((message: ChatMessage, index: number) => {
        if (index === 0) return true;
        const prevMessage = messages[index - 1];
        if (!message.createdAt || !prevMessage?.createdAt) return false;

        const msgDate = new Date(message.createdAt as any);
        const prevDate = new Date(prevMessage.createdAt as any);

        return !isSameDay(msgDate, prevDate);
    }, [messages]);

    const renderStatusIcon = useCallback((status: string | null, customColor?: string) => {
        if (!status) return null;

        const defaultColor = customColor || "rgba(255,255,255,0.7)";
        switch (status) {
            case 'pending':
                return <Icon name="Clock" size={14} color={defaultColor} />;
            case 'sent':
                return <Icon name="Check" size={14} color={defaultColor} />;
            case 'delivered':
                return <Icon name="Checks" size={14} color={defaultColor} />;
            case 'read':
                return <Icon name="Checks" size={14} color="#53BDEB" />;
            default:
                return null;
        }
    }, []);

    const getSystemMessageText = useCallback((text: string | undefined) => {
        if (!text || !currentUser || !chat) return text || '';

        const userName = chat.participantDetails?.[currentUser.id]?.displayName || currentUser.user_metadata?.full_name || 'User';

        let translated = text;

        // Pattern: "Name created the group..."
        if (translated.includes('created the group') || translated.includes('created this group')) {
            if (chat.createdBy === currentUser.id) {
                return 'You created this group';
            }
        }

        // Exact match check for "Actor added Member"
        if (translated.includes(' added ')) {
            const parts = translated.split(' added ');
            if (parts.length === 2) {
                const actorName = parts[0];
                const memberName = parts[1];

                const isActorMe = actorName.trim().toLowerCase() === userName.trim().toLowerCase();
                const isMemberMe = memberName.trim().toLowerCase() === userName.trim().toLowerCase();

                if (isActorMe) {
                    return `You added ${memberName}`;
                } else if (isMemberMe) {
                    return `${actorName} added You`;
                }
            }
        }

        // Exact match check for "Actor removed Member"
        if (translated.includes(' removed ')) {
            const parts = translated.split(' removed ');
            if (parts.length === 2) {
                const actorName = parts[0];
                const memberName = parts[1];

                const isActorMe = actorName.trim().toLowerCase() === userName.trim().toLowerCase();
                const isMemberMe = memberName.trim().toLowerCase() === userName.trim().toLowerCase();

                if (isActorMe) {
                    return `You removed ${memberName}`;
                } else if (isMemberMe) {
                    return `${actorName} removed You`;
                }
            }
        }

        // Exact match check for "Actor made Member an admin"
        if (translated.includes(' made ') && translated.includes(' an admin')) {
            const regex = /(.+) made (.+) an admin/;
            const match = translated.match(regex);
            if (match && match.length === 3) {
                const actorName = match[1];
                const memberName = match[2];

                const isActorMe = actorName.trim().toLowerCase() === userName.trim().toLowerCase();
                const isMemberMe = memberName.trim().toLowerCase() === userName.trim().toLowerCase();

                if (isActorMe) {
                    return `You made ${memberName} an admin`;
                } else if (isMemberMe) {
                    return `${actorName} made You an admin`;
                }
            }
        }

        // Generic fallback replaces caller name at the beginning with "You"
        if (translated.startsWith(userName)) {
            translated = 'You' + translated.substring(userName.length);
        }

        // Generic fallback replaces member name at the end with "You"
        if (translated.endsWith(userName)) {
            translated = translated.substring(0, translated.length - userName.length) + 'You';
        }

        return translated;
    }, [currentUser, chat]);

    const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
        const resolvedUserId = currentUserId || currentUser?.id || null;
        const isOwn = !!resolvedUserId && item.senderId === resolvedUserId;
        if (__DEV__) {
            console.log(`[renderMessage] msg: "${item.text || item.type}", senderId: "${item.senderId}", resolvedUserId: "${resolvedUserId}", isOwn: ${isOwn}, isDark: ${isDarkMode}`);
        }
        const showDayHeader = shouldShowDayHeader(item, index);
        const status = getMessageStatus(item);

        const showSenderAvatar = !isOwn && chat?.type === 'group';
        const senderPhoto = chat?.participantDetails?.[item.senderId]?.photoURL || undefined;

        if (item.deletedForEveryoneAt) {
            return (
                <View>
                    {showDayHeader && (
                        <View style={styles.dayHeaderContainer}>
                            <Text style={[styles.dayHeaderText, { color: colors.textSecondary, backgroundColor: dayChipBg }]}>
                                {formatDayHeader(item.createdAt)}
                            </Text>
                        </View>
                    )}
                    <View style={[
                        styles.messageRow,
                        isOwn && styles.ownMessageRow,
                        showSenderAvatar && { paddingLeft: 4, alignItems: 'flex-start' }
                    ]}>
                        {showSenderAvatar && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (item.senderId) {
                                        router.push({ pathname: '/profile/[id]', params: { id: item.senderId } });
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <DefaultAvatar
                                    uri={senderPhoto}
                                    name={item.senderName}
                                    size={32}
                                    style={{ marginRight: 8, marginTop: 2 }}
                                />
                            </TouchableOpacity>
                        )}
                        <View style={[
                            styles.messageBubble,
                            isOwn ? styles.ownBubble : styles.otherBubble,
                            { backgroundColor: isOwn ? (isDarkMode ? '#155241ff' : '#FFF8DE') : (isDarkMode ? '#202023' : '#F0F0F0') },
                            { flexDirection: 'row', alignItems: 'center', gap: 6 }
                        ]}>
                            <Icon name="Prohibit" size={14} color={colors.textSecondary} />
                            <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
                                {isOwn ? 'You deleted this message' : 'This message was deleted'}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        const isSystemMessage = item.type === 'system' || item.senderId === 'system';

        if (isSystemMessage) {
            return (
                <View>
                    {showDayHeader && (
                        <View style={styles.dayHeaderContainer}>
                            <Text style={[styles.dayHeaderText, { color: colors.textSecondary, backgroundColor: dayChipBg }]}>
                                {formatDayHeader(item.createdAt)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.systemMessageRow}>
                        <View style={[styles.systemMessageBubble, { backgroundColor: dayChipBg }]}>
                            <Text style={[styles.systemMessageText, { color: colors.textSecondary }]}>
                                {getSystemMessageText(item.text)}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        // Custom colors for own messages to avoid purple and ensure readability of blue ticks
        const ownBubbleBg = isDarkMode ? '#155241ff' : '#FFF8DE';
        const ownTextColor = isDarkMode ? '#F9F8F6' : '#1A1A1A';
        const ownTimeColor = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';

        return (
            <View>
                {showDayHeader && (
                    <View style={styles.dayHeaderContainer}>
                        <Text style={[styles.dayHeaderText, { color: colors.textSecondary, backgroundColor: dayChipBg }]}>
                            {formatDayHeader(item.createdAt)}
                        </Text>
                    </View>
                )}

                <View style={[
                    styles.messageRow,
                    isOwn && styles.ownMessageRow,
                    showSenderAvatar && { paddingLeft: 4, alignItems: 'flex-start' }
                ]}>
                    {showSenderAvatar && (
                        <TouchableOpacity
                            onPress={() => {
                                if (item.senderId) {
                                    router.push({ pathname: '/profile/[id]', params: { id: item.senderId } });
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <DefaultAvatar
                                uri={senderPhoto}
                                name={item.senderName}
                                size={32}
                                style={{ marginRight: 8, marginTop: 2 }}
                            />
                        </TouchableOpacity>
                    )}
                    <Pressable
                        onPress={() => {
                            if (item.type === 'image' && item.mediaUrl) {
                                setViewingImage(item.mediaUrl);
                            } else if (item.type === 'location' && item.location) {
                                if (item.location.isLive) {
                                    // Open modal for both active and ended live locations
                                    setShowLiveMap(true);
                                } else {
                                    openLocationInMaps(item.location.latitude, item.location.longitude);
                                }
                            } else if (item.type === 'trip_share' && (item as any).tripId) {
                                router.push({ pathname: '/trip/[id]', params: { id: (item as any).tripId } });
                            }
                        }}
                        onLongPress={() => handleLongPress(item)}
                        delayLongPress={300}
                        style={[
                            styles.messageBubble,
                            isOwn ? styles.ownBubble : styles.otherBubble,
                            { backgroundColor: isOwn ? ownBubbleBg : bubbleOtherBg },
                            shadowSoft,
                            (item.type === 'image' || item.type === 'location') && styles.mediaBubble,
                        ]}
                    >
                        {item.id === highlightedMessageId && (
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)', borderRadius: 12, zIndex: 10 }]} pointerEvents="none" />
                        )}
                        {showSenderAvatar && (
                            <Text style={[styles.senderInBubbleName, { color: colors.primary }]}>
                                {item.senderName || 'User'}
                            </Text>
                        )}
                        {/* Reply preview */}
                        {item.replyTo && (
                            <TouchableOpacity
                                onPress={() => handleReplyPress(item.replyTo!.messageId)}
                                style={[
                                    styles.replyPreview,
                                    { borderLeftColor: isOwn ? (isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.35)') : colors.primary },
                                    isOwn && { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 }
                                ]}
                            >
                                <Text style={[styles.replyName, { color: isOwn ? (isDarkMode ? 'rgba(255,255,255,0.9)' : colors.primary) : colors.primary }]}>
                                    Reply
                                </Text>
                                <Text
                                    style={[styles.replyText, { color: isOwn ? (isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)') : colors.textSecondary }]}
                                    numberOfLines={1}
                                >
                                    {item.replyTo.text}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Text content */}
                        {item.text && !item.deletedForEveryoneAt && (
                            <Text style={[
                                styles.messageText,
                                { color: isOwn ? ownTextColor : colors.text, marginBottom: (item.type !== 'text') ? 4 : 0 }
                            ]}>
                                {item.text + (item.type === 'text' ? (isOwn ? "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0" : "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0") : "")}
                            </Text>
                        )}

                        {/* Image message */}
                        {item.type === 'image' && item.mediaUrl && (
                            <View style={{ position: 'relative' }}>
                                <Image
                                    source={{ uri: item.mediaUrl }}
                                    style={styles.messageImage}
                                    contentFit="cover"
                                    transition={200}
                                />
                                {item.status === 'pending' && (
                                    <View style={[StyleSheet.absoluteFillObject, {
                                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: 12,
                                    }]}>
                                        <ActivityIndicator size="small" color="#fff" />
                                    </View>
                                )}
                                {!item.text && (
                                    <View style={styles.imageTimeOverlay}>
                                        <Text style={styles.imageTimeText}>
                                            {formatMessageTime(item.createdAt)}
                                        </Text>
                                        {isOwn && renderStatusIcon(status, '#fff')}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Location message */}
                        {item.type === 'location' && item.location && (
                            <View style={styles.bubbleMapContainer}>
                                {item.location.isLive ? (
                                    (() => {
                                        const activeShare = activeSharers.find(s => s.user_id === item.senderId);
                                        const isLiveActive = item.location!.expires_at && new Date(item.location!.expires_at) > new Date();

                                        if (isLiveActive) {
                                            const coords = activeShare ? {
                                                latitude: activeShare.latitude,
                                                longitude: activeShare.longitude,
                                            } : {
                                                latitude: item.location!.latitude,
                                                longitude: item.location!.longitude,
                                            };
                                            const markerPhoto = activeShare?.profiles?.photo_url || getSenderPhoto(item.senderId);
                                            const markerName = activeShare?.profiles?.name || getSenderName(item.senderId, item.senderName);

                                            return (
                                                <View style={styles.bubbleMapWrapper}>
                                                    <View style={{ position: 'relative' }}>
                                                        <InlineMap
                                                            latitude={coords.latitude}
                                                            longitude={coords.longitude}
                                                            isLive={true}
                                                            style={styles.bubbleMap}
                                                            onPress={() => setShowLiveMap(true)}
                                                        />
                                                        {/* Avatar overlay */}
                                                        <View style={styles.bubbleAvatarOverlay} pointerEvents="none">
                                                            <View style={styles.bubbleMarkerContainer}>
                                                                <DefaultAvatar
                                                                    uri={markerPhoto}
                                                                    name={markerName}
                                                                    size={30}
                                                                    style={{
                                                                        ...styles.bubbleMarkerAvatar,
                                                                        borderColor: '#25D366',
                                                                        borderWidth: 2
                                                                    }}
                                                                />
                                                                <View style={[styles.bubbleMarkerPin, { borderBottomColor: '#25D366' }]} />
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <View style={styles.bubbleMapInfo}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                                                            <Text style={[styles.locationLabel, { color: isOwn ? ownTextColor : colors.text }]}>
                                                                Live Location
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.locationAddress, { color: isOwn ? ownTimeColor : colors.textSecondary }]}>
                                                            Sharing live location...
                                                        </Text>
                                                        {isOwn && (
                                                            <TouchableOpacity
                                                                style={styles.stopLiveBubbleBtn}
                                                                onPress={() => stopLiveSharing(true)}
                                                            >
                                                                <Text style={styles.stopLiveBubbleText}>Stop Sharing</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>
                                            );
                                        } else {
                                            const coords = {
                                                latitude: item.location!.latitude,
                                                longitude: item.location!.longitude,
                                            };
                                            const markerPhoto = getSenderPhoto(item.senderId);
                                            const markerName = getSenderName(item.senderId, item.senderName);
                                            const endedText = formatEndedTime(item.location!.expires_at);

                                            return (
                                                <View style={styles.bubbleMapWrapper}>
                                                    <View style={{ position: 'relative' }}>
                                                        <InlineMap
                                                            latitude={coords.latitude}
                                                            longitude={coords.longitude}
                                                            style={styles.bubbleMap}
                                                            onPress={() => setShowLiveMap(true)}
                                                        />
                                                        {/* Avatar overlay — lite mode maps can't render Marker children */}
                                                        <View style={styles.bubbleAvatarOverlay} pointerEvents="none">
                                                            <View style={styles.bubbleMarkerContainer}>
                                                                <DefaultAvatar
                                                                    uri={markerPhoto}
                                                                    name={markerName}
                                                                    size={30}
                                                                    style={{
                                                                        ...styles.bubbleMarkerAvatar,
                                                                        borderColor: '#9ca3af',
                                                                        borderWidth: 2
                                                                    }}
                                                                />
                                                                <View style={[styles.bubbleMarkerPin, { borderBottomColor: '#9ca3af' }]} />
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <View style={styles.bubbleMapInfo}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Icon name="Radio" size={16} color={colors.textSecondary} />
                                                            <Text style={[styles.locationLabel, { color: isOwn ? ownTextColor : colors.text }]}>
                                                                Live Location Ended
                                                            </Text>
                                                        </View>
                                                        <Text style={[styles.locationAddress, { color: isOwn ? ownTimeColor : colors.textSecondary }]}>
                                                            {endedText}
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        }
                                    })()
                                ) : (
                                    <View style={styles.bubbleMapWrapper}>
                                        <InlineMap
                                            latitude={item.location.latitude}
                                            longitude={item.location.longitude}
                                            style={styles.bubbleMap}
                                            onPress={() => openLocationInMaps(item.location!.latitude, item.location!.longitude)}
                                        >
                                            <Marker coordinate={{ latitude: item.location.latitude, longitude: item.location.longitude }} />
                                        </InlineMap>
                                        <View style={styles.bubbleMapInfo}>
                                            <Text style={[styles.locationLabel, { color: isOwn ? ownTextColor : colors.text }]}>
                                                📍 Shared Location
                                            </Text>
                                            {item.location.address && (
                                                <Text style={[styles.locationAddress, { color: isOwn ? ownTimeColor : colors.textSecondary }]} numberOfLines={2}>
                                                    {item.location.address}
                                                </Text>
                                            )}
                                            <Text style={[styles.locationCoordinates, { color: isOwn ? ownTimeColor : colors.textSecondary }]}>
                                                {formatLocationCoordinates(item.location.latitude, item.location.longitude)}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Trip Share message */}
                        {item.type === 'trip_share' && (
                            <View style={styles.tripShareContainer}>
                                {(item as any).tripImage && (
                                    <Image
                                        source={{ uri: (item as any).tripImage }}
                                        style={styles.tripShareImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                )}
                                <View style={styles.tripShareInfo}>
                                    <Text style={[styles.tripShareLabel, { color: isOwn ? (isDarkMode ? 'rgba(255,255,255,0.8)' : colors.primary) : colors.primary }]}>
                                        🗺️ Shared Trip
                                    </Text>
                                    <Text style={[styles.tripShareTitle, { color: isOwn ? ownTextColor : colors.text }]} numberOfLines={2}>
                                        {(item as any).tripTitle || 'Trip'}
                                    </Text>
                                    <Text style={[styles.tripShareTap, { color: isOwn ? (isDarkMode ? 'rgba(255,255,255,0.6)' : colors.primary) : colors.primary }]}>
                                        Tap to view trip
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Timestamp and status */}
                        {!(item.type === 'image' && !item.text) && (
                            <View style={[
                                styles.whatsappFooter,
                                (item.type === 'location' || item.type === 'trip_share') && { bottom: 6, right: 10 }
                            ]}>
                                {item.editedAt && (
                                    <Text style={[styles.editedLabel, { color: isOwn ? ownTimeColor : colors.textSecondary }]}>
                                        edited
                                    </Text>
                                )}
                                <Text style={[styles.whatsappTime, { color: isOwn ? ownTimeColor : colors.textSecondary }]}>
                                    {formatMessageTime(item.createdAt)}
                                </Text>
                                {isOwn && renderStatusIcon(status, ownTimeColor)}
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>
        );
    }, [
        currentUserId,
        currentUser,
        chat,
        isDarkMode,
        shouldShowDayHeader,
        getMessageStatus,
        colors,
        dayChipBg,
        formatDayHeader,
        router,
        getSystemMessageText,
        bubbleOtherBg,
        shadowSoft,
        highlightedMessageId,
        formatMessageTime,
        activeSharers,
        renderStatusIcon,
        getSenderPhoto,
        getSenderName,
        viewingImage,
    ]);

    const handleScroll = useCallback((e: any) => {
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
        isNearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 150;
    }, []);

    const handleEndReached = useCallback(() => {
        if (hasMore) loadMoreMessages();
    }, [hasMore, loadMoreMessages]);

    if (loading || loadingAuth) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                {/* Skeleton Header */}
                <View style={[styles.header, { backgroundColor: colors.card }, shadowStyle]}>
                    <AvatarSkeleton size={36} />
                    <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <AvatarSkeleton size={44} style={{ marginLeft: 4 }} />
                        <View style={{ marginLeft: 12 }}>
                            <TextSkeleton width={120} height={14} />
                            <TextSkeleton width={80} height={10} style={{ marginTop: 6 }} />
                        </View>
                    </View>
                </View>
                {/* Skeleton Messages */}
                <ChatSkeleton />
                {/* Skeleton Composer */}
                <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
                    <AvatarSkeleton size={40} />
                    <TextSkeleton width="82%" height={40} borderRadius={20} style={{ marginHorizontal: 8 }} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card }, shadowStyle]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                    <Icon name="CaretLeft" size={22} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => {
                        const isGroup = chat?.type === 'group' || isGroupParam;
                        if (isGroup) {
                            router.push({ pathname: '/chat/info', params: { id: chatId } });
                        } else if (otherParticipantUid) {
                            router.push({ pathname: '/profile/[id]', params: { id: otherParticipantUid } });
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <View style={styles.avatarWrapper}>
                        <DefaultAvatar
                            uri={displayPhoto}
                            name={displayName}
                            size={44}
                            style={styles.headerAvatar}
                            isGroup={chat?.type === 'group' || isGroupParam}
                        />
                        {!(chat?.type === 'group' || isGroupParam) && lastSeenText === 'online' && (
                            <View style={[styles.onlineDot, { borderColor: colors.card }]} />
                        )}
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
                        <Text style={[styles.headerStatus, {
                            color: otherUserTyping ? colors.primary
                                : lastSeenText === 'online' ? colors.success
                                    : colors.textSecondary
                        }]} numberOfLines={1}>
                            {otherUserTyping ? 'typing...' : (
                                (chat?.type === 'group' || isGroupParam)
                                    ? `${chat?.memberCount || chat?.participants?.length || 0} members${chat?.groupDescription ? ' · ' + chat.groupDescription.substring(0, 30) : ''}`
                                    : (lastSeenText || '')
                            )}
                        </Text>
                    </View>
                </TouchableOpacity>

                {(chat?.type === 'group' || isGroupParam) && (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => router.push({ pathname: '/chat/info', params: { id: chatId } })}
                        activeOpacity={0.7}
                    >
                        <Icon name="Info" size={22} color={colors.text} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.iconButton} activeOpacity={0.7} onPress={() => setShowChatMenu(true)}>
                    <Icon name="DotsThreeVertical" size={20} color={colors.text} weight="bold" />
                </TouchableOpacity>
            </View>

            {/* Live Location Banner removed */}





            {/* Messages */}
            <KeyboardAvoidingView
                style={styles.messagesContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
            >
                <TypedFlashList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item: ChatMessage) => item.id}
                    extraData={[currentUserId, colors, isDarkMode, highlightedMessageId, activeSharers]}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    estimatedItemSize={80}
                    onScroll={handleScroll}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.3}
                />

                {/* Typing indicator */}
                {otherUserTyping && (
                    <View style={[styles.typingIndicator, { backgroundColor: bubbleOtherBg }, shadowSoft]}>
                        <View style={styles.typingDots}>
                            <Animated.View style={[styles.typingDot, { backgroundColor: colors.textSecondary, transform: [{ translateY: typingAnim1 }] }]} />
                            <Animated.View style={[styles.typingDot, { backgroundColor: colors.textSecondary, transform: [{ translateY: typingAnim2 }] }]} />
                            <Animated.View style={[styles.typingDot, { backgroundColor: colors.textSecondary, transform: [{ translateY: typingAnim3 }] }]} />
                        </View>
                    </View>
                )}

                {/* Reply preview */}
                {replyingTo && (
                    <View style={[styles.replyingBar, { backgroundColor: colors.card, borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }]}>
                        <View style={styles.replyingContent}>
                            <View style={[styles.replyingIndicator, { backgroundColor: colors.primary }]} />
                            <View style={styles.replyingText}>
                                <Text style={[styles.replyingLabel, { color: colors.primary }]}>Replying</Text>
                                <Text style={[styles.replyingMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {replyingTo.text}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                            <Icon name="X" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Composer */}
                <View
                    style={[
                        styles.composer,
                        {
                            backgroundColor: colors.card,
                            borderTopColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
                            paddingBottom: Math.max(insets.bottom, SPACING.sm),
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.attachButton, { backgroundColor: colors.card, opacity: uploading ? 0.5 : 1 }, shadowSoft]}
                        onPress={() => !uploading && setShowAttachmentPicker(true)}
                        activeOpacity={0.7}
                        disabled={uploading}
                    >
                        <Icon name="PlusCircle" size={24} color={colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, color: colors.text, borderColor: isDarkMode ? '#222' : '#D8D8E0' }]}
                        value={inputText}
                        onChangeText={handleTextChange}
                        placeholder={uploading ? "Sending images..." : "Type a message..."}
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={1000}
                        editable={!uploading}
                    />

                    {inputText.trim() ? (
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: colors.primary }, shadowSoft]}
                            onPress={handleSend}
                            disabled={sending || uploading}
                            activeOpacity={0.7}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Icon name="PaperPlaneRight" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    ) : null}
                </View>
            </KeyboardAvoidingView>

            {/* Context Menu */}
            <MessageContextMenu
                visible={showContextMenu}
                onClose={() => { setShowContextMenu(false); setSelectedMessage(null); }}
                selectedMessage={selectedMessage}
                currentUserId={currentUserId || undefined}
                isDarkMode={isDarkMode}
                colors={colors}
                shadowStyle={shadowStyle}
                onReply={handleReply}
                onEdit={handleEdit}
                onDeleteForMe={() => handleDelete(false)}
                onDeleteForEveryone={() => handleDelete(true)}
            />

            {/* Chat Menu (Three-dots) */}
            <Modal visible={showChatMenu} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => setShowChatMenu(false)}
                >
                    <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF', top: insets.top + 52 }, shadowStyle]}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={handleClearChat}
                        >
                            <View style={[styles.contextMenuIcon, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEE2E2' }]}>
                                <Icon name="Trash" size={18} color="#EF4444" />
                            </View>
                            <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Clear chat</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Attachment Picker */}
            <Modal visible={showAttachmentPicker} transparent animationType="slide">
                <Pressable style={styles.attachmentOverlay} onPress={() => setShowAttachmentPicker(false)}>
                    <View style={[styles.attachmentPicker, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.attachmentTitle, { color: colors.text }]}>Send Attachment</Text>

                        <View style={styles.attachmentOptions}>
                            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(true)}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#9d74f7' }, shadowSoft]}>
                                    <Icon name="Camera" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(false)}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#EC4899' }, shadowSoft]}>
                                    <Icon name="Image" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Gallery</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.attachmentOption} onPress={() => {
                                setShowAttachmentPicker(false);
                                setShowLocationOptions(true);
                            }}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#10B981' }, shadowSoft]}>
                                    <Icon name="MapPin" size={26} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Location</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Location Options Modal */}
            <Modal visible={showLocationOptions} transparent animationType="fade">
                <Pressable style={styles.attachmentOverlay} onPress={() => setShowLocationOptions(false)}>
                    <View style={[styles.attachmentPicker, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
                        <View style={styles.sheetHandle} />
                        <Text style={[styles.attachmentTitle, { color: colors.text }]}>Share Location</Text>

                        <TouchableOpacity style={styles.locationOption} onPress={() => {
                            setShowLocationOptions(false);
                            sendLocation();
                        }}>
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#3B82F6' }, shadowSoft]}>
                                <Icon name="NavigationArrow" size={22} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Current Location</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Share your accurate position</Text>
                            </View>
                            <Icon name="CaretRight" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.locationOption} onPress={() => {
                            setShowLocationOptions(false);
                            setShowMapPicker(true);
                        }}>
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#F59E0B' }, shadowSoft]}>
                                <Icon name="MapTrifold" size={22} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Pick on Map</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Select a location on map</Text>
                            </View>
                            <Icon name="CaretRight" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.locationOption} onPress={() => {
                            setShowLocationOptions(false);
                            setShowLiveDurationModal(true);
                        }}>
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#10B981' }, shadowSoft]}>
                                <Icon name="Radio" size={22} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Live Location</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Share real-time movement</Text>
                            </View>
                            <Icon name="CaretRight" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Map Picker Modal */}
            <LocationPickerModal
                visible={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onSelectLocation={(loc) => sendLocation(loc)}
            />

            {/* Live Map Modal */}
            <LiveLocationMapModal
                visible={showLiveMap}
                onClose={() => setShowLiveMap(false)}
                chatId={chatId}
                currentUser={currentUser}
                collectionName={chatCollection}
            />

            {/* Edit Message Modal */}
            <Modal visible={!!editingMessage} transparent animationType="fade">
                <View style={styles.editModalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
                        <Text style={[styles.editModalTitle, { color: colors.text }]}>Edit Message</Text>
                        <TextInput
                            style={[styles.editInput, { backgroundColor: inputBg, color: colors.text, borderColor: isDarkMode ? '#333' : '#D8D8E0' }]}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                        />
                        <View style={styles.editModalButtons}>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: isDarkMode ? '#252525' : '#F0F0F3' }]}
                                onPress={() => { setEditingMessage(null); setEditText(''); }}
                            >
                                <Text style={[styles.editButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: colors.primary }, shadowSoft]}
                                onPress={saveEdit}
                            >
                                <Text style={styles.editButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Live Location Duration Modal */}
            <Modal visible={showLiveDurationModal} transparent animationType="fade">
                <View style={styles.editModalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF', padding: 20 }, shadowStyle]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                            <Text style={[styles.editModalTitle, { color: colors.text, marginBottom: 0 }]}>Share Live Location</Text>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                            Select how long you want to share your live location. Participants in this chat will see your location in real-time.
                        </Text>

                        <View style={{ position: 'relative', zIndex: 50, marginBottom: 20 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                                Duration
                            </Text>
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 14,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: durationDropdownOpen ? colors.primary : (isDarkMode ? '#3A3A3C' : '#E5E7EB'),
                                    backgroundColor: isDarkMode ? '#2C2C2E' : '#F2F2F7',
                                }}
                                onPress={() => setDurationDropdownOpen(!durationDropdownOpen)}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Icon name="Clock" size={20} color={colors.primary} />
                                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                                        {selectedDuration === 15 ? '15 Minutes' : selectedDuration === 60 ? '1 Hour' : '8 Hours'}
                                    </Text>
                                </View>
                                <Icon name={durationDropdownOpen ? "CaretUp" : "CaretDown"} size={16} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {durationDropdownOpen && (
                                <View style={{
                                    marginTop: 4,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: isDarkMode ? '#3A3A3C' : '#E5E7EB',
                                    backgroundColor: isDarkMode ? '#2C2C2E' : '#FFFFFF',
                                    overflow: 'hidden',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 10,
                                    elevation: 5,
                                }}>
                                    {[
                                        { label: '15 Minutes', value: 15 },
                                        { label: '1 Hour', value: 60 },
                                        { label: '8 Hours', value: 480 },
                                    ].map((opt) => {
                                        const selected = selectedDuration === opt.value;
                                        return (
                                            <TouchableOpacity
                                                key={opt.value}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: 14,
                                                    backgroundColor: selected ? (isDarkMode ? 'rgba(157, 116, 247, 0.15)' : 'rgba(157, 116, 247, 0.08)') : 'transparent',
                                                    borderBottomWidth: opt.value !== 480 ? 0.5 : 0,
                                                    borderBottomColor: isDarkMode ? '#3A3A3C' : '#E5E7EB',
                                                }}
                                                onPress={() => {
                                                    setSelectedDuration(opt.value);
                                                    setDurationDropdownOpen(false);
                                                }}
                                            >
                                                <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: selected ? '600' : '400', fontSize: 14 }}>
                                                    {opt.label}
                                                </Text>
                                                {selected && <Icon name="Check" size={16} color={colors.primary} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        <View style={styles.editModalButtons}>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDarkMode ? '#3A3A3C' : '#E5E7EB' }]}
                                onPress={() => {
                                    setDurationDropdownOpen(false);
                                    setShowLiveDurationModal(false);
                                }}
                            >
                                <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: colors.primary }, shadowSoft]}
                                onPress={() => {
                                    setDurationDropdownOpen(false);
                                    setShowLiveDurationModal(false);
                                    startLiveSharing(selectedDuration);
                                }}
                            >
                                <Text style={styles.editButtonText}>Start Sharing</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Image Viewer */}
            <Modal visible={!!viewingImage} transparent animationType="fade">
                <Pressable style={styles.imageViewerModal} onPress={() => setViewingImage(null)}>
                    <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
                        <Icon name="X" size={28} color="#fff" />
                    </TouchableOpacity>
                    {viewingImage && (
                        <ZoomableImage uri={viewingImage} onClose={() => setViewingImage(null)} />
                    )}
                </Pressable>
            </Modal>

            {/* Custom Media Picker Modal */}
            <CustomMediaPickerModal
                visible={customPickerVisible}
                onClose={() => setCustomPickerVisible(false)}
                onConfirmSelection={handleConfirmMediaSelection}
            />

            {/* Reusable Image Preview Modal */}
            <ImagePreviewModal
                visible={previewModalVisible}
                initialImages={previewImages}
                onClose={() => {
                    setPreviewModalVisible(false);
                    setPreviewImages([]);
                }}
                onSend={sendMultipleImages}
            />


        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    // Core
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        zIndex: 10,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
    },
    avatarWrapper: {
        position: 'relative',
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 13,
        height: 13,
        borderRadius: 7,
        backgroundColor: '#22C55E',
        borderWidth: 2,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    headerTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    headerName: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.1,
    },
    headerStatus: {
        fontSize: 12,
        marginTop: 2,
        letterSpacing: 0.1,
    },

    // Messages area
    messagesContainer: { flex: 1 },
    messagesContent: {
        paddingHorizontal: 14,
        paddingVertical: 16,
    },

    // Day header chip
    dayHeaderContainer: {
        alignItems: 'center',
        marginVertical: 16,
    },
    dayHeaderText: {
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 12,
        overflow: 'hidden',
        letterSpacing: 0.3,
    },

    // Message rows
    messageRow: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingHorizontal: 2,
    },
    ownMessageRow: {
        justifyContent: 'flex-end',
    },

    // System messages
    systemMessageRow: {
        alignItems: 'center',
        marginBottom: 8,
    },
    systemMessageBubble: {
        maxWidth: '88%',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 12,
    },
    systemMessageText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        fontWeight: '500',
        letterSpacing: 0.1,
    },

    // Message bubbles
    messageBubble: {
        maxWidth: '78%',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        position: 'relative',
    },
    ownBubble: {
        borderBottomRightRadius: 2,
    },
    otherBubble: {
        borderBottomLeftRadius: 2,
    },
    mediaBubble: {
        padding: 0,
        borderRadius: 12,
        overflow: 'hidden',
    },

    // Reply preview in bubble
    replyPreview: {
        borderLeftWidth: 3,
        paddingLeft: 10,
        marginBottom: 6,
        borderRadius: 2,
    },
    replyName: {
        fontSize: 11,
        fontWeight: '600',
    },
    replyText: {
        fontSize: 12,
    },

    // Message text
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        letterSpacing: 0.1,
    },

    // Message images
    messageImage: {
        width: SCREEN_WIDTH * 0.6,
        height: SCREEN_WIDTH * 0.6,
        borderRadius: 12,
    },
    imageTimeOverlay: {
        position: 'absolute',
        bottom: 6,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    imageTimeText: {
        fontSize: 10,
        color: '#ffffff',
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },

    // Message footer
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
    },
    whatsappFooter: {
        position: 'absolute',
        bottom: 4,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    editedLabel: {
        fontSize: 10,
        fontStyle: 'italic',
        marginRight: 4,
    },
    messageTime: {
        fontSize: 10,
        letterSpacing: 0.2,
    },
    whatsappTime: {
        fontSize: 10,
        letterSpacing: 0.1,
    },

    // Deleted messages
    deletedMessageContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    deletedBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6,
    },
    deletedText: {
        fontSize: 13,
        fontStyle: 'italic',
    },

    // Location messages
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 220,
    },
    locationMapPreview: {
        width: 56,
        height: 56,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    locationInfo: { flex: 1 },
    locationLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    locationAddress: {
        fontSize: 12,
        marginTop: 2,
    },
    locationCoordinates: {
        fontSize: 11,
        marginTop: 4,
    },
    locationTap: {
        fontSize: 11,
        marginTop: 4,
        fontWeight: '500',
    },

    // Voice
    voiceContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },
    voicePlayButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    voiceWaveform: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 2 },
    voiceBar: { width: 3, borderRadius: 2 },
    voiceDuration: { fontSize: 11, marginLeft: 8 },

    // Typing indicator
    typingIndicator: {
        marginLeft: 16,
        marginBottom: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 6,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 5,
        alignItems: 'center',
    },
    typingDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },

    // Reply bar
    replyingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    replyingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    replyingIndicator: {
        width: 3,
        height: 36,
        borderRadius: 2,
        marginRight: 10,
    },
    replyingText: { flex: 1 },
    replyingLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    replyingMessage: {
        fontSize: 13,
    },

    // Mention list
    mentionList: { maxHeight: 200, borderTopWidth: 1 },
    mentionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
    mentionAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
    mentionAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    mentionName: { fontSize: 15 },

    // Composer
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    attachButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        marginHorizontal: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        fontSize: 15,
        maxHeight: 100,
        borderWidth: 1,
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Context menu
    contextMenuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contextMenu: {
        minWidth: 220,
        borderRadius: 18,
        paddingVertical: 8,
        overflow: 'hidden',
    },
    contextMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    contextMenuIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contextMenuText: {
        fontSize: 15,
        fontWeight: '500',
    },

    // Bottom sheet handle
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(128,128,128,0.3)',
        alignSelf: 'center',
        marginBottom: 16,
    },

    // Attachment picker
    attachmentOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    attachmentPicker: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 36,
    },
    attachmentTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 24,
        letterSpacing: 0.2,
    },
    attachmentOptions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    attachmentOption: {
        alignItems: 'center',
    },
    attachmentIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    attachmentLabel: {
        fontSize: 13,
        fontWeight: '500',
    },

    // Edit modal
    editModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    editModal: {
        width: '100%',
        borderRadius: 20,
        padding: 24,
    },
    editModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        letterSpacing: 0.2,
    },
    editInput: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    editModalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16,
    },
    editButton: {
        paddingHorizontal: 22,
        paddingVertical: 11,
        borderRadius: 12,
    },
    editButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },

    // Image viewer
    imageViewerModal: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageViewerClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    fullImage: { width: '100%', height: '78%' },

    // Preview
    previewHeader: {
        position: 'absolute',
        left: 24,
        right: 24,
        zIndex: 10,
    },
    previewTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    previewSubtitle: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 14,
        marginTop: 4,
    },
    previewActions: {
        position: 'absolute',
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
    },
    previewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 32,
        borderRadius: 30,
    },
    previewButtonText: { color: '#fff', fontSize: 16 },

    // Dropdown menu
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    dropdownMenu: {
        position: 'absolute',
        right: 16,
        minWidth: 170,
        borderRadius: 16,
        paddingVertical: 6,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    dropdownText: {
        fontSize: 15,
        fontWeight: '500',
    },

    // Selection mode
    selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    selectionBarText: { fontSize: 15, fontWeight: '600' },
    selectionBarActions: { flexDirection: 'row', gap: 12 },
    selectionBarButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },

    // Trip share
    tripShareContainer: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 4,
    },
    tripShareImage: {
        width: 200,
        height: 120,
        borderRadius: 8,
    },
    tripShareInfo: {
        paddingTop: 8,
        paddingRight: 60,
        paddingBottom: 4,
    },
    tripShareLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    tripShareTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    tripShareTap: {
        fontSize: 11,
        fontWeight: '500',
    },

    // Location option
    locationOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.15)',
    },
    locationOptionIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    locationOptionInfo: { flex: 1 },
    locationOptionTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    locationOptionSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },

    // Video
    videoContainer: { overflow: 'hidden', borderRadius: 14 },
    messageVideo: { width: SCREEN_WIDTH * 0.6, height: SCREEN_WIDTH * 0.6, borderRadius: 14 },

    // Live location bars
    liveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 16,
        gap: 8,
        marginHorizontal: 14,
        marginTop: 8,
        borderRadius: 12,
    },
    liveBannerText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    myLiveBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 9,
        paddingHorizontal: 16,
        marginHorizontal: 14,
        marginTop: 6,
        borderRadius: 12,
    },
    myLiveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    stopLiveText: { color: '#fff', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },

    // Upload/recording bars
    uploadingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8,
        marginHorizontal: 14,
        marginTop: 6,
        borderRadius: 12,
    },
    uploadingText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    recordingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    recordingPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: 8 },
    recordingText: { color: '#fff', fontSize: 13, flex: 1 },
    cancelRecordingBtn: { padding: 8 },

    // Sender name
    senderName: { fontSize: 10, marginLeft: 16, marginBottom: 2, fontWeight: '700' },
    senderInBubbleName: { fontSize: 12, fontWeight: '700', marginBottom: 4, letterSpacing: 0.1 },
    bubbleMapContainer: {
        width: SCREEN_WIDTH * 0.65,
        borderRadius: 12,
        overflow: 'hidden',
    },
    bubbleMapWrapper: {
        width: '100%',
    },
    bubbleMap: {
        height: 150,
        width: '100%',
    },
    bubbleMapInfo: {
        padding: 10,
        paddingRight: 60,
        gap: 2,
    },
    stopLiveBubbleBtn: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#EF4444',
        borderRadius: 6,
        alignItems: 'center',
    },
    stopLiveBubbleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    bubbleMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleMarkerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
    },
    bubbleMarkerPin: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderBottomWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#fff',
        transform: [{ rotate: '180deg' }],
        marginTop: -1,
    },
    bubbleAvatarOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ChatScreen;
