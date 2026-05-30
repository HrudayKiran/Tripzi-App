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

const TypedFlashList = FlashList as any;
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { ChatSkeleton } from '../components/Skeletons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, BRAND, STATUS, NEUTRAL } from '../styles';
import { useChatMessagesQuery, ChatMessage, ReplyTo } from '../hooks/useChatMessagesQuery';
import { useChatsQuery } from '../hooks/useChatsQuery';
import { getPublicProfilesByIds } from '../utils/publicProfiles';
import { getBooleanPreference, PREFERENCE_KEYS } from '../utils/preferences';
import * as Haptics from 'expo-haptics';
import DefaultAvatar from '../components/DefaultAvatar';
import LocationPickerModal from '../components/LocationPickerModal';
import LiveLocationMapModal from '../components/LiveLocationMapModal';
import { supabase } from '../lib/supabase';
import { uploadDirectChatImageToR2, uploadGroupChatImageToR2 } from '../utils/imageUpload';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=';

const formatLocationCoordinates = (latitude: number, longitude: number) =>
    `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

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
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
    }, []);
    const chat = chats.find((c) => c.id === chatId);
    const isGroupChat = isGroupParam || chat?.type === 'group';
    const chatCollection = routeCollectionName || (isGroupChat ? 'group_chats' : 'chats');
    const clearedAt = currentUser ? chat?.clearedAt?.[currentUser.id] : undefined;


    const chatType = chatCollection === 'group_chats' ? 'group' : 'direct';
    const { messages, loading, sendMessage, markAsRead } = useChatMessagesQuery(chatId, chatType);
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

    // Location state
    const [gettingLocation, setGettingLocation] = useState(false);
    const [showLocationOptions, setShowLocationOptions] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    // Live Location state
    const [isSharingLive, setIsSharingLive] = useState(false);
    const [showLiveMap, setShowLiveMap] = useState(false);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const [activeSharersCount, setActiveSharersCount] = useState(0);

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
    const otherParticipantUid = chat?.participants.find((uid) => uid !== currentUser?.id) || otherUserId;
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

    // Mark messages as read when entering chat or when new messages arrive
    useEffect(() => {
        if (chatId) {
            markAsRead();
        }
    }, [chatId, messages.length, markAsRead]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    // Fetch last seen + live profile photo for direct chats
    useEffect(() => {
        if (!otherParticipantUid || chat?.type === 'group') return;
        const loadPresence = async () => {
            const { data, error } = await supabase.from('profiles').select('photo_url, presence, last_seen_at').eq('id', otherParticipantUid).maybeSingle();
            if (error || !data) return;
            if (data.photo_url) setLivePhoto(data.photo_url);
            const presence = typeof data.presence === 'string' ? data.presence.toLowerCase() : '';
            const lastSeenValue = data.last_seen_at;
            
            if (presence === 'online') { 
                setLastSeenText('online'); 
                return; 
            }
            if (presence === 'away') { 
                setLastSeenText('away'); 
                return; 
            }
            
            if (lastSeenValue) {
                try {
                    const ts = new Date(lastSeenValue);
                    const diffMs = Date.now() - ts.getTime();
                    if (diffMs < 60 * 1000) setLastSeenText('last seen just now');
                    else if (diffMs < 60 * 60 * 1000) setLastSeenText(`last seen ${Math.floor(diffMs / 60000)} min ago`);
                    else if (diffMs < 24 * 60 * 60 * 1000) setLastSeenText(`last seen ${Math.floor(diffMs / 3600000)}h ago`);
                    else setLastSeenText(`last seen ${format(ts, 'MMM d, h:mm a')}`);
                } catch { 
                    setLastSeenText(presence === 'offline' ? 'offline' : ''); 
                }
            } else { 
                setLastSeenText(presence === 'offline' ? 'offline' : (presence || '')); 
            }
        };
        loadPresence();
        const channel = supabase.channel(`presence-${otherParticipantUid}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${otherParticipantUid}` }, () => { loadPresence(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [otherParticipantUid, chat?.type]);










    // Auto-save incoming media to gallery if preference enabled
    useEffect(() => {
        if (!messages.length || !currentUser) return;

        const incomingImageIds = messages
            .filter((message) => message.type === 'image' && !!message.mediaUrl && message.senderId !== currentUser.id)
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
                message.senderId !== currentUser.id &&
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
    }, [messages, currentUser]);

    // Typing indicator listener (throttled — only reads typing field)
    useEffect(() => {
        if (!chatId || !currentUser) return;

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
                            if (uid === currentUser.id) return false;
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
                        if (uid === currentUser.id) return false;
                        const ts = new Date(timestamp as string);
                        return Date.now() - ts.getTime() < 10000;
                    });
                setOtherUserTyping(typingUsers.length > 0);
            }
        });

        return () => { supabase.removeChannel(channel); };
    }, [chatId, currentUser]);

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
                .select('*')
                .eq('chat_id', chatId)
                .eq('is_active', true)
                .gt('updated_at', new Date(Date.now() - 3600000).toISOString());

            if (error) return;

            setActiveSharersCount(data?.length || 0);

            if (currentUser) {
                const myShare = data?.find(s => s.user_id === currentUser.id);
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
    }, [chatId, currentUser]);

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
        if (!chatId || !currentUser) return;

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
                    typing[currentUser.id] = new Date().toISOString();
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
                if (typing[currentUser.id]) {
                    delete typing[currentUser.id];
                    supabase.from(table).update({ typing }).eq('id', chatId);
                }
            });
        }
    }, [chatId, currentUser, isTyping, chatCollection]);

    // Handle text input
    const handleTextChange = async (text: string) => {
        setInputText(text);

        try {
            const hapticsEnabled = await getBooleanPreference(PREFERENCE_KEYS.hapticsEnabled, true);
            if (hapticsEnabled) {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch {
            // Ignore
        }

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
            await sendMessage(textToSend, replyingTo || undefined, mentions);
            setReplyingTo(null);
        } catch (error) {

            setInputText(textToSend); // Restore on error
        } finally {
            setSending(false);
            sendingRef.current = false; // Unlock
        }
    };



    const pickImage = async (useCamera: boolean = false) => {
        setShowAttachmentPicker(false);

        try {
            const permission = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant access to continue.');
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    allowsEditing: false,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    allowsEditing: false,
                });

            if (!result.canceled && result.assets[0]) {
                setPreviewImage(result.assets[0].uri);
            }
        } catch (error) {

            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const sendImageMessage = async (imageUri: string) => {
        if (!currentUser || !chatId) return;
        setUploading(true);

        try {
            const isGroup = chat?.type === 'group';
            const uploadFn = isGroup ? uploadGroupChatImageToR2 : uploadDirectChatImageToR2;
            const { success, url, error: uploadError } = await uploadFn(imageUri, currentUser.id, chatId);
            if (!success || !url) throw new Error(uploadError || 'Upload failed');
            const downloadUrl = url;

            const { data: userData } = await supabase.from('profiles').select('name').eq('id', currentUser.id).maybeSingle();
            const uData: any = userData || {};
            const senderName = uData.name || currentUser.user_metadata?.full_name || 'User';

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

            // Get chat data to find participants and existing unread_count
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('participants, unread_count')
                .eq('id', chatId)
                .maybeSingle();

            let newUnread: any = {};
            if (chatData) {
                const participants = chatData.participants || [];
                const currentUnread = chatData.unread_count || {};
                participants.forEach((pId: string) => {
                    if (pId !== currentUser.id) {
                        newUnread[pId] = (currentUnread[pId] || 0) + 1;
                    } else {
                        newUnread[pId] = 0;
                    }
                });
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
                    unread_count: newUnread,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', chatId);

            // Invalidate React Query Cache to render immediately for sender
            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

        } catch (error) {
            Alert.alert('Error', 'Failed to send image.');
        } finally {
            setUploading(false);
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

    const updateLiveShareCoordinates = async (coords: { latitude: number; longitude: number; heading?: number | null }) => {
        if (!currentUser || !chatId) {
            return;
        }

        try {
            const isGroup = chat?.type === 'group';
            await supabase
                .from('live_shares')
                .upsert({
                    chat_id: chatId,
                    chat_type: isGroup ? 'group' : 'direct',
                    user_id: currentUser.id,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    heading: coords.heading ?? null,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'chat_id,user_id' });
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

            // Get chat data to find participants and existing unread_count
            const { data: chatData } = await supabase
                .from(parentTable)
                .select('participants, unread_count')
                .eq('id', chatId)
                .maybeSingle();

            let newUnread: any = {};
            if (chatData) {
                const participants = chatData.participants || [];
                const currentUnread = chatData.unread_count || {};
                participants.forEach((pId: string) => {
                    if (pId !== currentUser.id) {
                        newUnread[pId] = (currentUnread[pId] || 0) + 1;
                    } else {
                        newUnread[pId] = 0;
                    }
                });
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
                    unread_count: newUnread,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', chatId);

            // Invalidate React Query Cache to render immediately for sender
            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });

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

                            await updateLiveShareCoordinates(initialLocation.coords);
                            startLocationWatcher();

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
                await supabase
                    .from('live_shares')
                    .update({ is_active: false })
                    .eq('chat_id', chatId)
                    .eq('user_id', currentUser.id);
            } catch (error) {
                // Error stopping live sharing
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

        const canDeleteForEveryone = selectedMessage.senderId === currentUser.id &&
            selectedMessage.createdAt &&
            differenceInMinutes(new Date(), (selectedMessage.createdAt as any).toDate ? (selectedMessage.createdAt as any).toDate() : new Date(selectedMessage.createdAt as any)) < 60;

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
                        try {
                            if (forEveryone && canDeleteForEveryone) {
                                await supabase
                                    .from('messages')
                                    .update({
                                        deleted_for_everyone_at: new Date().toISOString(),
                                        text: '',
                                        media_url: null,
                                    })
                                    .eq('id', selectedMessage.id);
                            } else {
                                const { data: msg } = await supabase
                                    .from('messages')
                                    .select('deleted_for')
                                    .eq('id', selectedMessage.id)
                                    .single();

                                const deletedFor = msg?.deleted_for || [];
                                if (!deletedFor.includes(currentUser.id)) {
                                    deletedFor.push(currentUser.id);
                                    await supabase
                                        .from('messages')
                                        .update({ deleted_for: deletedFor })
                                        .eq('id', selectedMessage.id);
                                }
                            }
                        } catch (error) {
                            // Error handling
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

    const getMessageStatus = (message: ChatMessage) => {
        if (message.senderId !== currentUser?.id) return null;

        const readByOthers = Object.keys(message.readBy || {}).filter(uid => uid !== currentUser?.id);
        if (readByOthers.length > 0) return 'read';
        if (message.deliveredTo?.length > 0) return 'delivered';
        if (message.status === 'sent') return 'sent';
        return 'pending';
    };

    // Clear all messages in chat
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
                            const table = 'chats';

                            const { data } = await supabase.from(table).select('cleared_at').eq('id', chatId).maybeSingle();
                            const clearedAt = data?.cleared_at || {};
                            clearedAt[currentUser.id] = new Date().toISOString();

                            await supabase.from(table).update({ cleared_at: clearedAt }).eq('id', chatId);
                            setShowChatMenu(false);
                        } catch (error) {
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

    // Handle bulk delete
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
                        try {
                            if (!currentUser) return;
                            const ids = Array.from(selectedMessages);
                            if (forEveryone) {
                                await supabase
                                    .from('messages')
                                    .update({
                                        deleted_for_everyone_at: new Date().toISOString(),
                                        text: '',
                                        media_url: null,
                                    })
                                    .in('id', ids);
                            } else {
                                for (const id of ids) {
                                    const { data: msg } = await supabase.from('messages').select('deleted_for').eq('id', id).single();
                                    const deletedFor = msg?.deleted_for || [];
                                    if (!deletedFor.includes(currentUser.id)) {
                                        deletedFor.push(currentUser.id);
                                        await supabase.from('messages').update({ deleted_for: deletedFor }).eq('id', id);
                                    }
                                }
                            }
                            setSelectedMessages(new Set());
                            setIsSelectionMode(false);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete messages.');
                        }
                    },
                },
            ]
        );
    };

    // Cancel selection mode
    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedMessages(new Set());
    };

    const formatMessageTime = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return format(date, 'h:mm a');
        } catch {
            return '';
        }
    };

    const formatDayHeader = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (isToday(date)) return 'Today';
            if (isYesterday(date)) return 'Yesterday';
            return format(date, 'MMMM d, yyyy');
        } catch {
            return '';
        }
    };

    const shouldShowDayHeader = (message: ChatMessage, index: number) => {
        if (index === 0) return true;
        const prevMessage = messages[index - 1];
        if (!message.createdAt || !prevMessage?.createdAt) return false;

        const msgDate = (message.createdAt as any).toDate ? (message.createdAt as any).toDate() : new Date(message.createdAt as any);
        const prevDate = (prevMessage.createdAt as any).toDate ? (prevMessage.createdAt as any).toDate() : new Date(prevMessage.createdAt as any);

        return !isSameDay(msgDate, prevDate);
    };

    const renderStatusIcon = (status: string | null) => {
        if (!status) return null;

        switch (status) {
            case 'pending':
                return <Icon name="Clock" size={14} color="rgba(255,255,255,0.7)" />;
            case 'sent':
                return <Icon name="Check" size={14} color="rgba(255,255,255,0.7)" />;
            case 'delivered':
                return <Icon name="Checks" size={14} color="rgba(255,255,255,0.7)" />;
            case 'read':
                return <Icon name="Checks" size={14} color="#60A5FA" />;
            default:
                return null;
        }
    };

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

    const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
        const isOwn = item.senderId === currentUser?.id;
        const showDayHeader = shouldShowDayHeader(item, index);
        const status = getMessageStatus(item);

        if (item.deletedForEveryoneAt) {
            return (
                <View style={styles.deletedMessageContainer}>
                    {showDayHeader && (
                        <View style={styles.dayHeaderContainer}>
                            <Text style={[styles.dayHeaderText, { color: colors.textSecondary, backgroundColor: dayChipBg }]}>
                                {formatDayHeader(item.createdAt)}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.deletedBubble, { backgroundColor: dayChipBg }]}>
                        <Icon name="Prohibit" size={14} color={colors.textSecondary} />
                        <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
                            This message was deleted
                        </Text>
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

        const showSenderAvatar = !isOwn && chat?.type === 'group';
        const senderPhoto = chat?.participantDetails?.[item.senderId]?.photoURL || undefined;

        return (
            <View>
                {showDayHeader && (
                    <View style={styles.dayHeaderContainer}>
                        <Text style={[styles.dayHeaderText, { color: colors.textSecondary, backgroundColor: dayChipBg }]}>
                            {formatDayHeader(item.createdAt)}
                        </Text>
                    </View>
                )}

                <Pressable onLongPress={() => handleLongPress(item)} delayLongPress={300}>
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
                        <View
                            style={[
                                styles.messageBubble,
                                isOwn ? styles.ownBubble : styles.otherBubble,
                                { backgroundColor: isOwn ? colors.primary : bubbleOtherBg },
                                shadowSoft,
                                (item.type === 'image' || item.type === 'location') && styles.mediaBubble,
                            ]}
                        >
                            {showSenderAvatar && (
                                <Text style={[styles.senderInBubbleName, { color: colors.primary }]}>
                                    {item.senderName || 'User'}
                                </Text>
                            )}
                            {/* Reply preview */}
                            {item.replyTo && (
                                <View style={[styles.replyPreview, { borderLeftColor: isOwn ? '#fff' : colors.primary }]}>
                                    <Text style={[styles.replyName, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.primary }]}>
                                        Reply
                                    </Text>
                                    <Text
                                        style={[styles.replyText, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}
                                        numberOfLines={1}
                                    >
                                        {item.replyTo.text}
                                    </Text>
                                </View>
                            )}

                            {/* Text content - FIXED: Was missing */}
                            {item.text && !item.deletedForEveryoneAt && (
                                <Text style={[
                                    styles.messageText,
                                    { color: isOwn ? '#fff' : colors.text, marginBottom: (item.type !== 'text') ? 4 : 0 }
                                ]}>
                                    {item.text}
                                </Text>
                            )}

                            {/* Image message */}
                            {item.type === 'image' && item.mediaUrl && (
                                <TouchableOpacity onPress={() => setViewingImage(item.mediaUrl!)}>
                                    <Image
                                        source={{ uri: item.mediaUrl }}
                                        style={styles.messageImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                </TouchableOpacity>
                            )}

                            {/* Location message */}
                            {item.type === 'location' && item.location && (
                                <TouchableOpacity
                                    onPress={() => openLocationInMaps(item.location!.latitude, item.location!.longitude)}
                                    style={styles.locationContainer}
                                >
                                    <View style={styles.locationMapPreview}>
                                        <Icon name="MapPin" size={40} color={colors.primary} />
                                    </View>
                                    <View style={styles.locationInfo}>
                                        <Text style={[styles.locationLabel, { color: isOwn ? '#fff' : colors.text }]}>
                                            📍 Shared Location
                                        </Text>
                                        {item.location.address && (
                                            <Text style={[styles.locationAddress, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]} numberOfLines={2}>
                                                {item.location.address}
                                            </Text>
                                        )}
                                        <Text style={[styles.locationCoordinates, { color: isOwn ? 'rgba(255,255,255,0.72)' : colors.textSecondary }]}>
                                            {formatLocationCoordinates(item.location.latitude, item.location.longitude)}
                                        </Text>
                                        <Text style={[styles.locationTap, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.primary }]}>
                                            Tap to open in Google Maps
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}



                            {/* Trip Share message */}
                            {item.type === 'trip_share' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        if ((item as any).tripId) {
                                            router.push({ pathname: '/trip/[id]', params: { id: (item as any).tripId } });
                                        }
                                    }}
                                    style={styles.tripShareContainer}
                                >
                                    {(item as any).tripImage && (
                                        <Image
                                            source={{ uri: (item as any).tripImage }}
                                            style={styles.tripShareImage}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    )}
                                    <View style={styles.tripShareInfo}>
                                        <Text style={[styles.tripShareLabel, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.primary }]}>
                                            🗺️ Shared Trip
                                        </Text>
                                        <Text style={[styles.tripShareTitle, { color: isOwn ? '#fff' : colors.text }]} numberOfLines={2}>
                                            {(item as any).tripTitle || 'Trip'}
                                        </Text>
                                        <Text style={[styles.tripShareTap, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.primary }]}>
                                            Tap to view trip
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}





                            {/* Timestamp and status */}
                            <View style={styles.messageFooter}>
                                {item.editedAt && (
                                    <Text style={[styles.editedLabel, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                                        edited
                                    </Text>
                                )}
                                <Text style={[styles.messageTime, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                                    {formatMessageTime(item.createdAt)}
                                </Text>
                                {isOwn && renderStatusIcon(status)}
                            </View>
                        </View>
                    </View>
                </Pressable>
            </View>
        );
    };

    if (loading || loadingAuth) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                {/* Skeleton Header */}
                <View style={[styles.header, { backgroundColor: colors.card }, shadowStyle]}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8ED' }} />
                    <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8ED' }} />
                        <View style={{ marginLeft: 12 }}>
                            <View style={{ width: 120, height: 13, borderRadius: 7, backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8ED' }} />
                            <View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8ED', marginTop: 6 }} />
                        </View>
                    </View>
                </View>
                {/* Skeleton Messages */}
                <ChatSkeleton />
                {/* Skeleton Composer */}
                <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDarkMode ? '#2A2A2A' : '#E8E8ED' }} />
                    <View style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: isDarkMode ? '#1F1F1F' : '#EAEAEF', marginHorizontal: 8 }} />
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
                        <Icon name="Info" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.iconButton} activeOpacity={0.7} onPress={() => setShowChatMenu(true)}>
                    <Icon name="DotsThreeVertical" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Live Location Banner */}
            {activeSharersCount > 0 && (
                <TouchableOpacity
                    style={[styles.liveBanner, { backgroundColor: colors.primary }]}
                    onPress={() => setShowLiveMap(true)}
                >
                    <Icon name="NavigationArrow" size={20} color="#fff" />
                    <Text style={styles.liveBannerText}>
                        {activeSharersCount} {activeSharersCount === 1 ? 'person is' : 'people are'} sharing live location
                    </Text>
                    <Icon name="CaretRight" size={16} color="#fff" />
                </TouchableOpacity>
            )}

            {/* My Live Status */}
            {isSharingLive && (
                <View style={[styles.myLiveBar, { backgroundColor: '#DC2626' }]}>
                    <Text style={styles.myLiveText}>You are sharing live location</Text>
                    <TouchableOpacity onPress={() => stopLiveSharing(true)}>
                        <Text style={styles.stopLiveText}>STOP</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Uploading/Getting Location indicator */}
            {(uploading || gettingLocation) && (
                <View style={[styles.uploadingBar, { backgroundColor: colors.primary }]}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.uploadingText}>
                        {gettingLocation ? 'Getting location...' : 'Sending...'}
                    </Text>
                </View>
            )}



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
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    estimatedItemSize={80}
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
                        style={[styles.attachButton, { backgroundColor: colors.card }, shadowSoft]}
                        onPress={() => setShowAttachmentPicker(true)}
                        activeOpacity={0.7}
                    >
                        <Icon name="PlusCircle" size={24} color={colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.input, { backgroundColor: inputBg, color: colors.text, borderColor: isDarkMode ? '#222' : '#D8D8E0' }]}
                        value={inputText}
                        onChangeText={handleTextChange}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={1000}
                    />

                    {inputText.trim() ? (
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: colors.primary }, shadowSoft]}
                            onPress={handleSend}
                            disabled={sending}
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
            <Modal visible={showContextMenu} transparent animationType="fade">
                <Pressable
                    style={styles.contextMenuOverlay}
                    onPress={() => { setShowContextMenu(false); setSelectedMessage(null); }}
                >
                    <View style={[styles.contextMenu, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
                        <TouchableOpacity style={styles.contextMenuItem} onPress={handleReply}>
                            <View style={[styles.contextMenuIcon, { backgroundColor: isDarkMode ? '#252525' : '#F0F0F3' }]}>
                                <Icon name="ArrowUUpLeft" size={18} color={colors.primary} />
                            </View>
                            <Text style={[styles.contextMenuText, { color: colors.text }]}>Reply</Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === currentUser?.id && selectedMessage?.type === 'text' && (
                            <TouchableOpacity style={styles.contextMenuItem} onPress={handleEdit}>
                                <View style={[styles.contextMenuIcon, { backgroundColor: isDarkMode ? '#252525' : '#F0F0F3' }]}>
                                    <Icon name="PencilSimple" size={18} color={colors.primary} />
                                </View>
                                <Text style={[styles.contextMenuText, { color: colors.text }]}>Edit</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.contextMenuItem} onPress={() => handleDelete(false)}>
                            <View style={[styles.contextMenuIcon, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEE2E2' }]}>
                                <Icon name="Trash" size={18} color="#EF4444" />
                            </View>
                            <Text style={[styles.contextMenuText, { color: '#EF4444' }]}>Delete for Me</Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === currentUser?.id && (
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => handleDelete(true)}>
                                <View style={[styles.contextMenuIcon, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEE2E2' }]}>
                                    <Icon name="Trash" size={18} color="#EF4444" />
                                </View>
                                <Text style={[styles.contextMenuText, { color: '#EF4444' }]}>Delete for Everyone</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Modal>

            {/* Chat Menu (Three-dots) */}
            <Modal visible={showChatMenu} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.dropdownOverlay}
                    activeOpacity={1}
                    onPress={() => setShowChatMenu(false)}
                >
                    <View style={[styles.dropdownMenu, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
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
                            Alert.alert('Share Live Location', 'Select duration', [
                                { text: '15 Mins', onPress: () => startLiveSharing(15) },
                                { text: '1 Hour', onPress: () => startLiveSharing(60) },
                                { text: '8 Hours', onPress: () => startLiveSharing(480) },
                                { text: 'Cancel', style: 'cancel' }
                            ]);
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

            {/* Image Viewer */}
            <Modal visible={!!viewingImage} transparent animationType="fade">
                <Pressable style={styles.imageViewerModal} onPress={() => setViewingImage(null)}>
                    <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
                        <Icon name="X" size={28} color="#fff" />
                    </TouchableOpacity>
                    {viewingImage && (
                        <Image
                            source={{ uri: viewingImage }}
                            style={styles.fullImage}
                            contentFit="contain"
                            transition={200}
                        />
                    )}
                </Pressable>
            </Modal>

            {/* Image Preview Modal (Before Send) */}
            <Modal visible={!!previewImage} transparent animationType="slide">
                <View style={[styles.imageViewerModal, { backgroundColor: '#000' }]}>
                    <View style={[styles.previewHeader, { top: insets.top + 12 }]}>
                        <Text style={styles.previewTitle}>Ready to send</Text>
                        <Text style={styles.previewSubtitle}>Check the image before sharing it.</Text>
                    </View>
                    <Image
                        source={{ uri: previewImage || '' }}
                        style={styles.fullImage}
                        contentFit="contain"
                        transition={200}
                    />

                    <View style={[styles.previewActions, { bottom: Math.max(insets.bottom, 20) + 20 }]}>
                        <TouchableOpacity
                            style={[styles.previewButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setPreviewImage(null)}
                        >
                            <Text style={styles.previewButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.previewButton, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                if (previewImage) {
                                    sendImageMessage(previewImage);
                                    setPreviewImage(null);
                                }
                            }}
                        >
                            <Text style={[styles.previewButtonText, { fontWeight: 'bold' }]}>Send</Text>
                            <Icon name="PaperPlaneRight" size={16} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>


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
        marginBottom: 3,
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
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
    },
    ownBubble: {
        borderBottomRightRadius: 6,
    },
    otherBubble: {
        borderBottomLeftRadius: 6,
    },
    mediaBubble: {
        padding: 4,
        borderRadius: 18,
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
        borderRadius: 16,
    },

    // Message footer
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
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

    // Deleted messages
    deletedMessageContainer: {
        alignItems: 'center',
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
        borderRadius: 14,
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 60,
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
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 4,
    },
    tripShareImage: {
        width: 200,
        height: 120,
        borderRadius: 14,
    },
    tripShareInfo: { paddingTop: 8 },
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
});

export default ChatScreen;
