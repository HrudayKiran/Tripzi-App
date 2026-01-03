import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
    Pressable,
    Dimensions,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Audio, Video, ResizeMode } from 'expo-av';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { useChatMessages, Message, ReplyTo } from '../hooks/useChatMessages';
import { useChats } from '../hooks/useChats';
import LocationPickerModal from '../components/LocationPickerModal';
import LiveLocationMapModal from '../components/LiveLocationMapModal';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes, addMinutes } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatScreenProps {
    navigation: any;
    route: {
        params: {
            chatId: string;
            otherUserId?: string;
            otherUserName?: string;
            otherUserPhoto?: string;
        };
    };
}

const ChatScreen = ({ navigation, route }: ChatScreenProps) => {
    const { chatId, otherUserId, otherUserName, otherUserPhoto } = route.params;
    const { colors } = useTheme();
    const { messages, loading, sendMessage, markAsRead } = useChatMessages(chatId);
    const { chats } = useChats();
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const sendingRef = useRef(false); // Ref-based lock to prevent double-send
    const currentUser = auth().currentUser;

    // Context menu state
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [showContextMenu, setShowContextMenu] = useState(false);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);

    // Edit state
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [editText, setEditText] = useState('');

    // Attachment picker state
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);

    // Image viewer state
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewVideo, setPreviewVideo] = useState<string | null>(null);

    // Location state
    const [gettingLocation, setGettingLocation] = useState(false);
    const [showLocationOptions, setShowLocationOptions] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    // Live Location state
    const [isSharingLive, setIsSharingLive] = useState(false);
    const [showLiveMap, setShowLiveMap] = useState(false);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const [activeSharersCount, setActiveSharersCount] = useState(0);

    // Voice note state
    const [recording, setRecording] = useState<any>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const soundRef = useRef<any>(null);

    // Typing indicator state
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Chat menu state (three-dots)
    const [showChatMenu, setShowChatMenu] = useState(false);

    // Multi-select state for bulk message deletion
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());

    // Get chat details
    const chat = chats.find((c) => c.id === chatId);
    const otherParticipantUid = chat?.participants.find((uid) => uid !== currentUser?.uid) || otherUserId;
    const otherParticipant = chat?.participantDetails?.[otherParticipantUid || ''];

    const displayName = chat?.type === 'group'
        ? chat.groupName
        : otherParticipant?.displayName || otherUserName || 'User';
    const displayPhoto = chat?.type === 'group'
        ? chat.groupIcon
        : otherParticipant?.photoURL || otherUserPhoto;

    // Mark messages as read when entering chat
    useEffect(() => {
        if (chatId) {
            markAsRead();
        }
    }, [chatId, markAsRead]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    // Typing indicator listener
    useEffect(() => {
        if (!chatId || !currentUser) return;

        const unsubscribe = firestore()
            .collection('chats')
            .doc(chatId)
            .onSnapshot((doc) => {
                const data = doc.data();
                if (data?.typing) {
                    const typingUsers = Object.entries(data.typing)
                        .filter(([uid, timestamp]: [string, any]) => {
                            if (uid === currentUser.uid) return false;
                            const ts = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
                            return Date.now() - ts.getTime() < 5000; // 5 second timeout
                        });
                    setOtherUserTyping(typingUsers.length > 0);
                }
            });

        return () => unsubscribe();
    }, [chatId, currentUser]);

    // Check for active live sharers
    useEffect(() => {
        if (!chatId) return;
        const unsubscribe = firestore()
            .collection('chats')
            .doc(chatId)
            .collection('live_shares')
            .where('isActive', '==', true)
            .where('validUntil', '>', firestore.Timestamp.now())
            .onSnapshot(snapshot => {
                setActiveSharersCount(snapshot.size);

                // Check if I am sharing
                if (currentUser) {
                    const myShare = snapshot.docs.find(doc => doc.id === currentUser.uid);
                    if (myShare && !isSharingLive) {
                        // Resume sharing if app restarted but share is valid
                        // For simplicity, we just set UI state to true, 
                        // re-enabling the watcher requires user action or more complex background restoration
                        setIsSharingLive(true);
                        startLiveLocationHeaderResume();
                    } else if (!myShare && isSharingLive) {
                        setIsSharingLive(false);
                        stopLiveSharing(false); // Stop watcher if remote says invalid
                    }
                }
            });
        return () => unsubscribe();
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
    const updateTypingStatus = useCallback((isTyping: boolean) => {
        if (!chatId || !currentUser) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (isTyping) {
            firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    [`typing.${currentUser.uid}`]: firestore.FieldValue.serverTimestamp(),
                })
                .catch(() => { });

            // Clear typing after 3 seconds
            typingTimeoutRef.current = setTimeout(() => {
                updateTypingStatus(false);
            }, 3000);
        } else {
            firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    [`typing.${currentUser.uid}`]: firestore.FieldValue.delete(),
                })
                .catch(() => { });
        }
    }, [chatId, currentUser]);

    // Handle text input
    const handleTextChange = (text: string) => {
        setInputText(text);
        if (text.length > 0 && !isTyping) {
            setIsTyping(true);
            updateTypingStatus(true);
        } else if (text.length === 0 && isTyping) {
            setIsTyping(false);
            updateTypingStatus(false);
        }
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

        try {
            await sendMessage(textToSend, replyingTo || undefined);
            setReplyingTo(null);
        } catch (error) {
            console.error('Failed to send message:', error);
            setInputText(textToSend); // Restore on error
        } finally {
            setSending(false);
            sendingRef.current = false; // Unlock
        }
    };

    // Pick and send image
    const pickVideo = async () => {
        setShowAttachmentPicker(false);
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant gallery permissions.');
                return;
            }
            // Launch picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: false,
                quality: 1,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                // 50MB limit check
                if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
                    Alert.alert('File too large', 'Please select a video under 50MB.');
                    return;
                }
                setPreviewVideo(asset.uri);
            }
        } catch (error) {
            console.error('Video picker error:', error);
            Alert.alert('Error', 'Failed to pick video.');
        }
    };

    const sendVideoMessage = async (videoUri: string) => {
        if (!currentUser || !chatId) return;
        setUploading(true);

        try {
            const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
            const storageRef = storage().ref(`chats/${chatId}/videos/${filename}`);
            await storageRef.putFile(videoUri);
            const downloadUrl = await storageRef.getDownloadURL();

            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    senderName: userData?.displayName || currentUser.displayName || 'User',
                    type: 'video',
                    mediaUrl: downloadUrl,
                    status: 'sent',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });

            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    lastMessage: {
                        text: '🎥 Video',
                        senderId: currentUser.uid,
                        senderName: userData?.displayName || currentUser.displayName || 'User',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: 'video',
                    },
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${currentUser.uid}`]: 0,
                });

        } catch (error) {
            console.error('Failed to send video:', error);
            Alert.alert('Error', 'Failed to send video.');
        } finally {
            setUploading(false);
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
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    const sendImageMessage = async (imageUri: string) => {
        if (!currentUser || !chatId) return;
        setUploading(true);

        try {
            const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const storageRef = storage().ref(`chats/${chatId}/images/${filename}`);
            await storageRef.putFile(imageUri);
            const downloadUrl = await storageRef.getDownloadURL();

            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    senderName: userData?.displayName || currentUser.displayName || 'User',
                    type: 'image',
                    mediaUrl: downloadUrl,
                    status: 'sent',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });

            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    lastMessage: {
                        text: '📷 Photo',
                        senderId: currentUser.uid,
                        senderName: userData?.displayName || currentUser.displayName || 'User',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: 'image',
                    },
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${currentUser.uid}`]: 0,
                });
        } catch (error) {
            console.error('Failed to send image:', error);
            Alert.alert('Error', 'Failed to send image.');
        } finally {
            setUploading(false);
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
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please enable location access.');
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

            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    senderName: userData?.displayName || currentUser.displayName || 'User',
                    type: 'location',
                    location: {
                        latitude: locationData.coords.latitude,
                        longitude: locationData.coords.longitude,
                        address: address,
                    },
                    status: 'sent',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });

            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    lastMessage: {
                        text: '📍 Location',
                        senderId: currentUser.uid,
                        senderName: userData?.displayName || currentUser.displayName || 'User',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: 'location',
                    },
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${currentUser.uid}`]: 0,
                });


        } catch (error) {
            console.error('Failed to send location:', error);
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
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            if (status !== 'granted') return;

                            setIsSharingLive(true);

                            // Create/Update share doc
                            const userDoc = await firestore().collection('users').doc(currentUser?.uid).get();
                            const userData = userDoc.data();

                            await firestore()
                                .collection('chats')
                                .doc(chatId)
                                .collection('live_shares')
                                .doc(currentUser?.uid)
                                .set({
                                    isActive: true,
                                    validUntil: firestore.Timestamp.fromDate(addMinutes(new Date(), durationMinutes)),
                                    timestamp: firestore.FieldValue.serverTimestamp(),
                                    displayName: userData?.displayName || currentUser?.displayName || 'User',
                                    photoURL: userData?.photoURL || userData?.image || currentUser?.photoURL || null,
                                    latitude: 0, // Placeholder
                                    longitude: 0 // Placeholder
                                }, { merge: true });

                            // Send system message
                            await firestore()
                                .collection('chats')
                                .doc(chatId)
                                .collection('messages')
                                .add({
                                    senderId: currentUser?.uid,
                                    senderName: 'System',
                                    type: 'system',
                                    text: `${userData?.displayName || 'User'} started sharing live location.`,
                                    createdAt: firestore.FieldValue.serverTimestamp(),
                                });

                            startLocationWatcher();

                        } catch (error) {
                            console.error("Live share error", error);
                            setIsSharingLive(false);
                        }
                    }
                }
            ]
        );
    };

    const startLocationWatcher = async () => {
        if (locationSubscription.current) return;

        try {
            const sub = await Location.watchPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000, // 10 seconds
                distanceInterval: 20, // 20 meters
            }, async (loc) => {
                // Update Firestore
                if (currentUser && chatId) {
                    await firestore()
                        .collection('chats')
                        .doc(chatId)
                        .collection('live_shares')
                        .doc(currentUser.uid)
                        .update({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            heading: loc.coords.heading,
                            timestamp: firestore.FieldValue.serverTimestamp(),
                        })
                        .catch(err => console.log("Loc update failed", err));
                }
            });
            locationSubscription.current = sub;
        } catch (e) {
            console.error("Watcher failed", e);
        }
    };

    const stopLiveSharing = async (updateDoc = true) => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        setIsSharingLive(false);

        if (updateDoc && currentUser && chatId) {
            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('live_shares')
                .doc(currentUser.uid)
                .update({
                    isActive: false
                }).catch(() => { });
        }
    };

    // Open location in maps
    const openLocationInMaps = (lat: number, lng: number) => {
        const url = Platform.select({
            ios: `maps:0,0?q=${lat},${lng}`,
            android: `geo:0,0?q=${lat},${lng}`,
        }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
        });
    };

    // Voice recording
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please enable microphone access.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setIsRecording(true);
            setRecordingDuration(0);

            // Start timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Error', 'Failed to start recording.');
        }
    };

    const stopRecording = async (send: boolean = true) => {
        if (!recording) return;

        try {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            setIsRecording(false);

            if (send && uri) {
                await sendVoiceMessage(uri, recordingDuration);
            }

            setRecordingDuration(0);
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    };

    const cancelRecording = async () => {
        await stopRecording(false);
    };

    const sendVoiceMessage = async (uri: string, duration: number) => {
        if (!currentUser || !chatId) return;
        setUploading(true);

        try {
            const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.m4a`;
            const storageRef = storage().ref(`chats/${chatId}/voice/${filename}`);
            await storageRef.putFile(uri);
            const downloadUrl = await storageRef.getDownloadURL();

            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .add({
                    senderId: currentUser.uid,
                    senderName: userData?.displayName || currentUser.displayName || 'User',
                    type: 'voice',
                    mediaUrl: downloadUrl,
                    voiceDuration: duration,
                    status: 'sent',
                    readBy: {},
                    deliveredTo: [],
                    deletedFor: [],
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });

            await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                    lastMessage: {
                        text: `🎤 Voice (${formatDuration(duration)})`,
                        senderId: currentUser.uid,
                        senderName: userData?.displayName || currentUser.displayName || 'User',
                        timestamp: firestore.FieldValue.serverTimestamp(),
                        type: 'voice',
                    },
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                    [`unreadCount.${currentUser.uid}`]: 0,
                });


        } catch (error) {
            console.error('Failed to send voice message:', error);
            Alert.alert('Error', 'Failed to send voice message.');
        } finally {
            setUploading(false);
        }
    };

    const playVoiceMessage = async (message: Message) => {
        if (!message.mediaUrl) return;

        try {
            // Stop current playback
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                if (playingVoiceId === message.id) {
                    setPlayingVoiceId(null);
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: message.mediaUrl },
                { shouldPlay: true }
            );

            soundRef.current = sound;
            setPlayingVoiceId(message.id);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingVoiceId(null);
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });
        } catch (error) {
            console.error('Failed to play voice message:', error);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Long press handler
    const handleLongPress = (message: Message) => {
        setSelectedMessage(message);
        setShowContextMenu(true);
    };

    // Context menu actions
    const handleReply = () => {
        if (!selectedMessage) return;
        setReplyingTo({
            messageId: selectedMessage.id,
            text: selectedMessage.text || selectedMessage.type === 'image' ? '📷 Photo' : selectedMessage.type === 'location' ? '📍 Location' : '🎤 Voice',
            senderId: selectedMessage.senderId,
        });
        setShowContextMenu(false);
        setSelectedMessage(null);
    };

    const handleEdit = () => {
        if (!selectedMessage || selectedMessage.senderId !== currentUser?.uid) return;
        setEditingMessage(selectedMessage);
        setEditText(selectedMessage.text || '');
        setShowContextMenu(false);
        setSelectedMessage(null);
    };

    const handleDelete = (forEveryone: boolean = false) => {
        if (!selectedMessage || !currentUser) return;

        const canDeleteForEveryone = selectedMessage.senderId === currentUser.uid &&
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
                            const msgRef = firestore()
                                .collection('chats')
                                .doc(chatId)
                                .collection('messages')
                                .doc(selectedMessage.id);

                            if (forEveryone && canDeleteForEveryone) {
                                await msgRef.update({
                                    deletedForEveryoneAt: firestore.FieldValue.serverTimestamp(),
                                    text: '',
                                    mediaUrl: null,
                                });
                            } else {
                                await msgRef.update({
                                    deletedFor: firestore.FieldValue.arrayUnion(currentUser.uid),
                                });
                            }
                        } catch (error) {
                            console.error('Failed to delete message:', error);
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
            await firestore()
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .doc(editingMessage.id)
                .update({
                    text: editText.trim(),
                    editedAt: firestore.FieldValue.serverTimestamp(),
                });
            setEditingMessage(null);
            setEditText('');
        } catch (error) {
            console.error('Failed to edit message:', error);
            Alert.alert('Error', 'Failed to edit message.');
        }
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
                            const messagesRef = firestore()
                                .collection('chats')
                                .doc(chatId)
                                .collection('messages');

                            const snapshot = await messagesRef.get();
                            const batch = firestore().batch();

                            snapshot.docs.forEach((doc) => {
                                batch.update(doc.ref, {
                                    deletedFor: firestore.FieldValue.arrayUnion(currentUser?.uid),
                                });
                            });

                            await batch.commit();
                            setShowChatMenu(false);
                        } catch (error) {
                            console.error('Failed to clear chat:', error);
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
                            const batch = firestore().batch();

                            selectedMessages.forEach((msgId) => {
                                const msgRef = firestore()
                                    .collection('chats')
                                    .doc(chatId)
                                    .collection('messages')
                                    .doc(msgId);

                                if (forEveryone) {
                                    batch.update(msgRef, {
                                        deletedForEveryoneAt: firestore.FieldValue.serverTimestamp(),
                                        text: '',
                                        mediaUrl: null,
                                    });
                                } else {
                                    batch.update(msgRef, {
                                        deletedFor: firestore.FieldValue.arrayUnion(currentUser?.uid),
                                    });
                                }
                            });

                            await batch.commit();
                            setSelectedMessages(new Set());
                            setIsSelectionMode(false);
                        } catch (error) {
                            console.error('Failed to delete messages:', error);
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
            return format(date, 'HH:mm');
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

    const shouldShowDayHeader = (message: Message, index: number) => {
        if (index === 0) return true;
        const prevMessage = messages[index - 1];
        if (!message.createdAt || !prevMessage?.createdAt) return false;

        const msgDate = (message.createdAt as any).toDate ? (message.createdAt as any).toDate() : new Date(message.createdAt as any);
        const prevDate = (prevMessage.createdAt as any).toDate ? (prevMessage.createdAt as any).toDate() : new Date(prevMessage.createdAt as any);

        return !isSameDay(msgDate, prevDate);
    };

    const getMessageStatus = (message: Message) => {
        if (message.senderId !== currentUser?.uid) return null;

        const readByOthers = Object.keys(message.readBy || {}).filter(uid => uid !== currentUser?.uid);
        if (readByOthers.length > 0) return 'read';
        if (message.deliveredTo?.length > 0) return 'delivered';
        if (message.status === 'sent') return 'sent';
        return 'pending';
    };

    const renderStatusIcon = (status: string | null) => {
        if (!status) return null;

        switch (status) {
            case 'pending':
                return <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />;
            case 'sent':
                return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />;
            case 'delivered':
                return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />;
            case 'read':
                return <Ionicons name="checkmark-done" size={14} color="#60A5FA" />;
            default:
                return null;
        }
    };

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const isOwn = item.senderId === currentUser?.uid;
        const showDayHeader = shouldShowDayHeader(item, index);
        const status = getMessageStatus(item);

        if (item.deletedForEveryoneAt) {
            return (
                <View style={styles.deletedMessageContainer}>
                    {showDayHeader && (
                        <View style={styles.dayHeaderContainer}>
                            <Text style={[styles.dayHeaderText, { color: colors.textSecondary }]}>
                                {formatDayHeader(item.createdAt)}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.deletedBubble, { backgroundColor: colors.card }]}>
                        <Ionicons name="ban-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
                            This message was deleted
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <View>
                {showDayHeader && (
                    <View style={styles.dayHeaderContainer}>
                        <Text style={[styles.dayHeaderText, { color: colors.textSecondary }]}>
                            {formatDayHeader(item.createdAt)}
                        </Text>
                    </View>
                )}

                <Pressable onLongPress={() => handleLongPress(item)} delayLongPress={300}>
                    <View style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
                        <View
                            style={[
                                styles.messageBubble,
                                isOwn ? styles.ownBubble : styles.otherBubble,
                                { backgroundColor: isOwn ? colors.primary : colors.card },
                                (item.type === 'image' || item.type === 'location') && styles.mediaBubble,
                            ]}
                        >
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
                                    <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
                                </TouchableOpacity>
                            )}

                            {/* Location message */}
                            {item.type === 'location' && item.location && (
                                <TouchableOpacity
                                    onPress={() => openLocationInMaps(item.location!.latitude, item.location!.longitude)}
                                    style={styles.locationContainer}
                                >
                                    <View style={styles.locationMapPreview}>
                                        <Ionicons name="location" size={40} color={colors.primary} />
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
                                        <Text style={[styles.locationTap, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.primary }]}>
                                            Tap to open in Maps
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Voice message */}
                            {item.type === 'voice' && item.mediaUrl && (
                                <TouchableOpacity
                                    onPress={() => playVoiceMessage(item)}
                                    style={styles.voiceContainer}
                                >
                                    <View style={[styles.voicePlayButton, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.primary }]}>
                                        <Ionicons
                                            name={playingVoiceId === item.id ? 'pause' : 'play'}
                                            size={20}
                                            color={isOwn ? '#fff' : '#fff'}
                                        />
                                    </View>
                                    <View style={styles.voiceWaveform}>
                                        {[...Array(12)].map((_, i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.voiceBar,
                                                    {
                                                        backgroundColor: isOwn ? 'rgba(255,255,255,0.5)' : colors.primary,
                                                        height: 8 + Math.random() * 16,
                                                    },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <Text style={[styles.voiceDuration, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
                                        {formatDuration(item.voiceDuration || 0)}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Trip Share message */}
                            {item.type === 'trip_share' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        if ((item as any).tripId) {
                                            navigation.navigate('TripDetails' as never, { tripId: (item as any).tripId } as never);
                                        }
                                    }}
                                    style={styles.tripShareContainer}
                                >
                                    {(item as any).tripImage && (
                                        <Image
                                            source={{ uri: (item as any).tripImage }}
                                            style={styles.tripShareImage}
                                            resizeMode="cover"
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

                            {/* Video message */}
                            {item.type === 'video' && item.mediaUrl && (
                                <View style={styles.videoContainer}>
                                    <Video
                                        style={styles.messageVideo}
                                        source={{ uri: item.mediaUrl }}
                                        useNativeControls
                                        resizeMode={ResizeMode.COVER}
                                        isLooping={false}
                                    />
                                </View>
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

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => {
                        if (otherParticipantUid) {
                            navigation.navigate('UserProfile', { userId: otherParticipantUid });
                        }
                    }}
                    activeOpacity={0.7}
                >
                    {displayPhoto ? (
                        <Image source={{ uri: displayPhoto }} style={styles.headerAvatar} />
                    ) : (
                        <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                            <Text style={styles.headerAvatarText}>{displayName?.charAt(0)?.toUpperCase() || 'U'}</Text>
                        </View>
                    )}
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
                        <Text style={[styles.headerStatus, { color: otherUserTyping ? colors.primary : colors.textSecondary }]}>
                            {otherUserTyping ? 'typing...' : 'Online'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.moreButton} activeOpacity={0.7} onPress={() => setShowChatMenu(true)}>
                    <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Live Location Banner */}
            {activeSharersCount > 0 && (
                <TouchableOpacity
                    style={[styles.liveBanner, { backgroundColor: colors.primary }]}
                    onPress={() => setShowLiveMap(true)}
                >
                    <Ionicons name="navigate-circle" size={20} color="#fff" />
                    <Text style={styles.liveBannerText}>
                        {activeSharersCount} {activeSharersCount === 1 ? 'person is' : 'people are'} sharing live location
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
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

            {/* Recording indicator */}
            {isRecording && (
                <View style={[styles.recordingBar, { backgroundColor: '#EF4444' }]}>
                    <View style={styles.recordingPulse} />
                    <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
                    <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecordingBtn}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Messages */}
            <KeyboardAvoidingView
                style={styles.messagesContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />

                {/* Typing indicator */}
                {otherUserTyping && (
                    <View style={[styles.typingIndicator, { backgroundColor: colors.card }]}>
                        <View style={styles.typingDots}>
                            <View style={[styles.typingDot, styles.typingDot1]} />
                            <View style={[styles.typingDot, styles.typingDot2]} />
                            <View style={[styles.typingDot, styles.typingDot3]} />
                        </View>
                    </View>
                )}

                {/* Reply preview */}
                {replyingTo && (
                    <View style={[styles.replyingBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
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
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Composer */}
                <View style={[styles.composer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={() => setShowAttachmentPicker(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                    </TouchableOpacity>

                    <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                        value={inputText}
                        onChangeText={handleTextChange}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        maxLength={1000}
                    />

                    {inputText.trim() ? (
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: colors.primary }]}
                            onPress={handleSend}
                            disabled={sending}
                            activeOpacity={0.7}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: isRecording ? '#EF4444' : colors.primary }]}
                            onPress={isRecording ? () => stopRecording(true) : startRecording}
                            onLongPress={startRecording}
                            activeOpacity={0.7}
                        >
                            <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Context Menu */}
            <Modal visible={showContextMenu} transparent animationType="fade">
                <Pressable
                    style={styles.contextMenuOverlay}
                    onPress={() => { setShowContextMenu(false); setSelectedMessage(null); }}
                >
                    <View style={[styles.contextMenu, { backgroundColor: colors.card }]}>
                        <TouchableOpacity style={styles.contextMenuItem} onPress={handleReply}>
                            <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
                            <Text style={[styles.contextMenuText, { color: colors.text }]}>Reply</Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === currentUser?.uid && selectedMessage?.type === 'text' && (
                            <TouchableOpacity style={styles.contextMenuItem} onPress={handleEdit}>
                                <Ionicons name="create-outline" size={20} color={colors.text} />
                                <Text style={[styles.contextMenuText, { color: colors.text }]}>Edit</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.contextMenuItem} onPress={() => handleDelete(false)}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={[styles.contextMenuText, { color: '#EF4444' }]}>Delete for Me</Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === currentUser?.uid && (
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => handleDelete(true)}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
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
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.card }]}>
                        <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={handleClearChat}
                        >
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={[styles.dropdownText, { color: '#EF4444' }]}>Clear chat</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Attachment Picker */}
            <Modal visible={showAttachmentPicker} transparent animationType="slide">
                <Pressable style={styles.attachmentOverlay} onPress={() => setShowAttachmentPicker(false)}>
                    <View style={[styles.attachmentPicker, { backgroundColor: colors.card }]}>
                        <Text style={[styles.attachmentTitle, { color: colors.text }]}>Send Attachment</Text>

                        <View style={styles.attachmentOptions}>
                            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(true)}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#8B5CF6' }]}>
                                    <Ionicons name="camera" size={28} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickVideo()}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#F59E0B' }]}>
                                    <Ionicons name="videocam" size={28} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Video</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.attachmentOption} onPress={() => pickImage(false)}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#EC4899' }]}>
                                    <Ionicons name="images" size={28} color="#fff" />
                                </View>
                                <Text style={[styles.attachmentLabel, { color: colors.text }]}>Gallery</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.attachmentOption} onPress={() => {
                                setShowAttachmentPicker(false);
                                setShowLocationOptions(true);
                            }}>
                                <View style={[styles.attachmentIcon, { backgroundColor: '#10B981' }]}>
                                    <Ionicons name="location" size={28} color="#fff" />
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
                    <View style={[styles.attachmentPicker, { backgroundColor: colors.card }]}>
                        <Text style={[styles.attachmentTitle, { color: colors.text }]}>Share Location</Text>

                        <TouchableOpacity style={styles.locationOption} onPress={() => {
                            setShowLocationOptions(false);
                            sendLocation();
                        }}>
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#3B82F6' }]}>
                                <Ionicons name="navigate" size={24} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Current Location</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Share your accurate position</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.locationOption} onPress={() => {
                            setShowLocationOptions(false);
                            setShowMapPicker(true);
                        }}>
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#F59E0B' }]}>
                                <Ionicons name="map" size={24} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Pick on Map</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Select a location on map</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
                            <View style={[styles.locationOptionIcon, { backgroundColor: '#10B981' }]}>
                                <Ionicons name="radio" size={24} color="#fff" />
                            </View>
                            <View style={styles.locationOptionInfo}>
                                <Text style={[styles.locationOptionTitle, { color: colors.text }]}>Live Location</Text>
                                <Text style={[styles.locationOptionSubtitle, { color: colors.textSecondary }]}>Share real-time movement</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
            />

            {/* Edit Message Modal */}
            <Modal visible={!!editingMessage} transparent animationType="fade">
                <View style={styles.editModalOverlay}>
                    <View style={[styles.editModal, { backgroundColor: colors.card }]}>
                        <Text style={[styles.editModalTitle, { color: colors.text }]}>Edit Message</Text>
                        <TextInput
                            style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                        />
                        <View style={styles.editModalButtons}>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: colors.border }]}
                                onPress={() => { setEditingMessage(null); setEditText(''); }}
                            >
                                <Text style={[styles.editButtonText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editButton, { backgroundColor: colors.primary }]}
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
                <View style={styles.imageViewerModal}>
                    <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    {viewingImage && <Image source={{ uri: viewingImage }} style={styles.fullImage} resizeMode="contain" />}
                </View>
            </Modal>

            {/* Image Preview Modal (Before Send) */}
            <Modal visible={!!previewImage} transparent animationType="slide">
                <View style={[styles.imageViewerModal, { backgroundColor: '#000' }]}>
                    <Image source={{ uri: previewImage || '' }} style={styles.fullImage} resizeMode="contain" />

                    <View style={styles.previewActions}>
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
                            <Ionicons name="send" size={16} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Video Preview Modal (Before Send) */}
            <Modal visible={!!previewVideo} transparent animationType="slide">
                <View style={[styles.imageViewerModal, { backgroundColor: '#000' }]}>
                    <Video
                        source={{ uri: previewVideo || '' }}
                        style={styles.fullImage}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        isLooping
                    />

                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={[styles.previewButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                            onPress={() => setPreviewVideo(null)}
                        >
                            <Text style={styles.previewButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.previewButton, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                if (previewVideo) {
                                    sendVideoMessage(previewVideo);
                                    setPreviewVideo(null);
                                }
                            }}
                        >
                            <Text style={[styles.previewButtonText, { fontWeight: 'bold' }]}>Send</Text>
                            <Ionicons name="send" size={16} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    backButton: { padding: SPACING.sm },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.sm },
    headerAvatar: { width: 40, height: 40, borderRadius: 20 },
    headerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerAvatarText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    headerTextContainer: { marginLeft: SPACING.md, flex: 1 },
    headerName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    headerStatus: { fontSize: FONT_SIZE.xs },
    moreButton: { padding: SPACING.sm },
    uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, gap: SPACING.sm },
    uploadingText: { color: '#fff', fontSize: FONT_SIZE.sm },
    recordingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
    recordingPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginRight: SPACING.sm },
    recordingText: { color: '#fff', fontSize: FONT_SIZE.sm, flex: 1 },
    cancelRecordingBtn: { padding: SPACING.sm },
    messagesContainer: { flex: 1 },
    messagesContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
    dayHeaderContainer: { alignItems: 'center', marginVertical: SPACING.lg },
    dayHeaderText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.lg },
    messageRow: { flexDirection: 'row', marginBottom: SPACING.xs },
    ownMessageRow: { justifyContent: 'flex-end' },
    messageBubble: { maxWidth: '80%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
    ownBubble: { borderBottomRightRadius: 4 },
    otherBubble: { borderBottomLeftRadius: 4 },
    mediaBubble: { padding: 4 },
    replyPreview: { borderLeftWidth: 2, paddingLeft: SPACING.sm, marginBottom: SPACING.xs },
    replyName: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    replyText: { fontSize: FONT_SIZE.xs },
    messageText: {
        fontSize: FONT_SIZE.md,
        lineHeight: 22,
    },
    messageImage: { width: SCREEN_WIDTH * 0.6, height: SCREEN_WIDTH * 0.6, borderRadius: BORDER_RADIUS.md },

    messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
    editedLabel: { fontSize: FONT_SIZE.xs, fontStyle: 'italic', marginRight: 4 },
    messageTime: { fontSize: 10 },
    deletedMessageContainer: { alignItems: 'center' },
    deletedBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, gap: SPACING.xs },
    deletedText: { fontSize: FONT_SIZE.sm, fontStyle: 'italic' },
    locationContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 200 },
    locationMapPreview: { width: 60, height: 60, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
    locationInfo: { flex: 1 },
    locationLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    locationAddress: { fontSize: FONT_SIZE.xs, marginTop: 2 },
    locationTap: { fontSize: FONT_SIZE.xs, marginTop: 4 },
    voiceContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },
    voicePlayButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
    voiceWaveform: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 2 },
    voiceBar: { width: 3, borderRadius: 2 },
    voiceDuration: { fontSize: FONT_SIZE.xs, marginLeft: SPACING.sm },
    typingIndicator: { marginLeft: SPACING.md, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, alignSelf: 'flex-start' },
    typingDots: { flexDirection: 'row', gap: 4 },
    typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#888' },
    typingDot1: { opacity: 0.4 },
    typingDot2: { opacity: 0.6 },
    typingDot3: { opacity: 1 },
    replyingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderTopWidth: 1 },
    replyingContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    replyingIndicator: { width: 3, height: 36, borderRadius: 2, marginRight: SPACING.sm },
    replyingText: { flex: 1 },
    replyingLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
    replyingMessage: { fontSize: FONT_SIZE.sm },
    composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1 },
    attachButton: { padding: SPACING.xs },
    input: { flex: 1, marginHorizontal: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.xl, fontSize: FONT_SIZE.md, maxHeight: 100 },
    sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    contextMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    contextMenu: { minWidth: 200, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.sm, elevation: 5 },
    contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md },
    contextMenuText: { fontSize: FONT_SIZE.md },
    attachmentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    attachmentPicker: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },
    attachmentTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xl },
    attachmentOptions: { flexDirection: 'row', justifyContent: 'space-around' },
    attachmentOption: { alignItems: 'center' },
    attachmentIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
    attachmentLabel: { fontSize: FONT_SIZE.sm },
    editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
    editModal: { width: '100%', borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl },
    editModalTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.lg },
    editInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.md, minHeight: 80, textAlignVertical: 'top' },
    editModalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.md, marginTop: SPACING.lg },
    editButton: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
    editButtonText: { color: '#fff', fontWeight: FONT_WEIGHT.semibold },
    imageViewerModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    imageViewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: SPACING.md },
    fullImage: { width: '100%', height: '80%' },

    previewActions: { position: 'absolute', bottom: 40, flexDirection: 'row', width: '100%', justifyContent: 'space-around', paddingHorizontal: 20 },
    previewButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 30 },
    previewButtonText: { color: '#fff', fontSize: 16 },
    // Dropdown menu styles
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    dropdownMenu: { position: 'absolute', top: 60, right: 16, minWidth: 150, borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.sm, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md },
    dropdownText: { fontSize: FONT_SIZE.md },
    // Selection mode bar styles
    selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1 },
    selectionBarText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    selectionBarActions: { flexDirection: 'row', gap: SPACING.md },
    selectionBarButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md },
    // Trip Share message styles
    tripShareContainer: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden', marginTop: SPACING.xs },
    tripShareImage: { width: 200, height: 120, borderRadius: BORDER_RADIUS.md },
    tripShareInfo: { paddingTop: SPACING.sm },
    tripShareLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, marginBottom: 2 },
    tripShareTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: 4 },

    tripShareTap: { fontSize: FONT_SIZE.xs },
    locationOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    locationOptionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
    locationOptionInfo: { flex: 1 },
    locationOptionTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    locationOptionSubtitle: { fontSize: FONT_SIZE.xs, marginTop: 2 },
    videoContainer: { overflow: 'hidden', borderRadius: BORDER_RADIUS.md },
    messageVideo: { width: SCREEN_WIDTH * 0.6, height: SCREEN_WIDTH * 0.6, borderRadius: BORDER_RADIUS.md },
    liveBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
    liveBannerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    myLiveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 16 },
    myLiveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    stopLiveText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' },
});

export default ChatScreen;
