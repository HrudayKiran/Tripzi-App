import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, KeyboardAvoidingView, Image, TouchableOpacity, Modal, ScrollView, Alert, Linking, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

// Common emojis
const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '✨', '🙏', '💪', '🚀', '✈️', '🏔️', '🌊', '🌅', '🎯', '💯', '👏'];

const MessageScreen = ({ route, navigation }) => {
    const { chatId, recipientId, recipientName, recipientImage } = route.params;
    const { colors } = useTheme();
    const [messages, setMessages] = useState([]);
    const [chat, setChat] = useState(null);
    const [activeChatId, setActiveChatId] = useState(chatId);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [inputText, setInputText] = useState('');
    const [recipientOnline, setRecipientOnline] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<any>(null);
    const [showMessageOptions, setShowMessageOptions] = useState(false);
    const [editingMessage, setEditingMessage] = useState<any>(null);
    const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'location' } | null>(null);
    const [mediaCaption, setMediaCaption] = useState('');
    const [isSendingMedia, setIsSendingMedia] = useState(false);
    const [showLocationPreview, setShowLocationPreview] = useState(false);
    const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const currentUser = auth().currentUser;

    useEffect(() => {
        initializeChat();
    }, []);

    // Set current user as online and listen for recipient online status
    useEffect(() => {
        if (!currentUser) return;

        // Update current user's online status
        const userRef = firestore().collection('users').doc(currentUser.uid);
        userRef.update({
            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp()
        });

        // Listen to recipient's online status
        let unsubscribeRecipient = () => { };
        const otherUserId = recipientId || chat?.participants?.find(p => p !== currentUser.uid);
        if (otherUserId) {
            unsubscribeRecipient = firestore()
                .collection('users')
                .doc(otherUserId)
                .onSnapshot(doc => {
                    if (doc.exists) {
                        setRecipientOnline(doc.data()?.isOnline || false);
                    }
                });
        }

        // Set offline when leaving
        return () => {
            userRef.update({
                isOnline: false,
                lastSeen: firestore.FieldValue.serverTimestamp()
            });
            unsubscribeRecipient();
        };
    }, [currentUser?.uid, recipientId, chat]);

    const initializeChat = async () => {
        if (chatId) {
            // Existing chat
            setActiveChatId(chatId);
            subscribeToChat(chatId);
        } else if (recipientId) {
            // Starting new chat - check if exists
            try {
                const existingChat = await firestore()
                    .collection('chats')
                    .where('participants', 'array-contains', currentUser.uid)
                    .get();

                let foundChatId = null;
                existingChat.docs.forEach(doc => {
                    const participants = doc.data().participants;
                    if (participants.includes(recipientId) && !doc.data().isGroupChat) {
                        foundChatId = doc.id;
                    }
                });

                if (foundChatId) {
                    setActiveChatId(foundChatId);
                    subscribeToChat(foundChatId);
                } else {
                    // Create new chat
                    const newChat = await firestore().collection('chats').add({
                        participants: [currentUser.uid, recipientId],
                        isGroupChat: false,
                        createdAt: firestore.FieldValue.serverTimestamp(),
                        lastMessage: '',
                        lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
                    });
                    setActiveChatId(newChat.id);
                    setChat({
                        id: newChat.id,
                        otherUser: { displayName: recipientName, photoURL: recipientImage }
                    });
                    subscribeToChat(newChat.id);
                }
            } catch {
                // Chat init error - silently handled
            }
        }
    };

    const subscribeToChat = (id) => {
        const chatRef = firestore().collection('chats').doc(id);

        const unsubscribeChat = chatRef.onSnapshot(async (doc) => {
            if (!doc.exists) return;
            const chatData = { id: doc.id, ...doc.data() };
            if (!chatData.isGroupChat) {
                const otherUserId = chatData.participants?.find(p => p !== currentUser.uid);
                if (otherUserId) {
                    try {
                        const userDoc = await firestore().collection('users').doc(otherUserId).get();
                        if (userDoc.exists) {
                            chatData.otherUser = userDoc.data();
                        }
                    } catch {
                        // User fetch failed silently
                    }
                }
            }
            setChat(chatData);
        });

        const messagesRef = chatRef.collection('messages');
        const unsubscribeMessages = messagesRef.orderBy('createdAt', 'desc').onSnapshot(querySnapshot => {
            const msgs = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    _id: doc.id,
                    text: data.text,
                    image: data.image,
                    location: data.location,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    user: data.user,
                    // Read receipt status: 'sent', 'delivered', 'read'
                    status: data.status || 'sent',
                    edited: data.edited || false,
                };
            });
            setMessages(msgs);

            // Mark messages as read when we receive them
            if (currentUser) {
                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.user?._id !== currentUser.uid && data.status !== 'read') {
                        doc.ref.update({ status: 'read' });
                    }
                });
            }
        });

        return () => {
            unsubscribeChat();
            unsubscribeMessages();
        };
    };

    const onSend = useCallback((newMessages = []) => {
        if (!activeChatId) return;

        const { text, user } = newMessages[0];

        // Check if we're editing an existing message
        if (editingMessage) {
            editMessage(editingMessage._id, text);
            return;
        }

        // Send new message with status
        firestore().collection('chats').doc(activeChatId).collection('messages').add({
            text,
            user,
            status: 'sent',
            createdAt: firestore.FieldValue.serverTimestamp(),
        });
        firestore().collection('chats').doc(activeChatId).update({
            lastMessage: text,
            lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
        });
    }, [activeChatId, editingMessage]);

    // Edit message
    const editMessage = async (messageId: string, newText: string) => {
        if (!activeChatId) return;
        await firestore()
            .collection('chats')
            .doc(activeChatId)
            .collection('messages')
            .doc(messageId)
            .update({
                text: newText,
                edited: true
            });
        setEditingMessage(null);
        setInputText('');
    };

    // Delete message
    const deleteMessage = async (messageId: string) => {
        if (!activeChatId) return;
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await firestore()
                            .collection('chats')
                            .doc(activeChatId)
                            .collection('messages')
                            .doc(messageId)
                            .delete();
                        setShowMessageOptions(false);
                    },
                },
            ]
        );
    };

    // Handle long press on message
    const onLongPress = (context: any, message: any) => {
        if (message.user._id === currentUser?.uid) {
            setSelectedMessage(message);
            setShowMessageOptions(true);
        }
    };

    // Upload image to Firebase Storage and send message
    const sendImageMessage = async (imageUri: string, caption: string = '') => {
        if (!activeChatId || !currentUser) return;

        setIsSendingMedia(true);
        try {
            // Generate unique filename
            const filename = `chats/${activeChatId}/${Date.now()}_${currentUser.uid}.jpg`;
            const reference = storage().ref(filename);

            // Upload to Storage
            await reference.putFile(imageUri);
            const downloadUrl = await reference.getDownloadURL();

            // Save message with Storage URL
            await firestore().collection('chats').doc(activeChatId).collection('messages').add({
                text: caption,
                image: downloadUrl,
                user: {
                    _id: currentUser.uid,
                    name: currentUser.displayName || 'User',
                    avatar: currentUser.photoURL,
                },
                status: 'sent',
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            await firestore().collection('chats').doc(activeChatId).update({
                lastMessage: caption || '📷 Photo',
                lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to send image. Please try again.');
        } finally {
            setIsSendingMedia(false);
            setPendingMedia(null);
            setMediaCaption('');
        }
    };

    // Pick image from gallery - show preview first
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setPendingMedia({ uri: result.assets[0].uri, type: 'image' });
        }
    };

    // Take photo with camera - show preview first
    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setPendingMedia({ uri: result.assets[0].uri, type: 'image' });
        }
    };

    // Add emoji to input
    const addEmoji = (emoji: string) => {
        setInputText(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Share current location - with preview
    const shareLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to share your location.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = location.coords;
            setPendingLocation({ latitude, longitude });
            setShowLocationPreview(true);
        } catch (error) {
            Alert.alert('Error', 'Could not get your location. Please try again.');
        }
    };

    // Confirm and send location
    const confirmSendLocation = async () => {
        if (!activeChatId || !currentUser || !pendingLocation) return;

        setIsSendingMedia(true);
        try {
            await firestore().collection('chats').doc(activeChatId).collection('messages').add({
                text: '📍 Location',
                location: pendingLocation,
                user: {
                    _id: currentUser.uid,
                    name: currentUser.displayName || 'User',
                    avatar: currentUser.photoURL,
                },
                status: 'sent',
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
            await firestore().collection('chats').doc(activeChatId).update({
                lastMessage: '📍 Location shared',
                lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share location.');
        } finally {
            setIsSendingMedia(false);
            setShowLocationPreview(false);
            setPendingLocation(null);
        }
    };

    const renderBubble = (props) => (
        <Bubble
            {...props}
            wrapperStyle={{
                right: { backgroundColor: colors.primary, marginVertical: 2 },
                left: { backgroundColor: colors.card, marginVertical: 2 },
            }}
            textStyle={{
                right: { color: '#fff' },
                left: { color: colors.text },
            }}
            onLongPress={() => {
                const message = props.currentMessage;
                if (message.user._id === currentUser?.uid) {
                    setSelectedMessage(message);
                    setShowMessageOptions(true);
                }
            }}
        />
    );

    // Custom image message renderer to fix the MessageImage error
    const renderMessageImage = (props: any) => (
        <TouchableOpacity activeOpacity={0.9}>
            <Image
                source={{ uri: props.currentMessage.image }}
                style={styles.messageImage}
                resizeMode="cover"
            />
        </TouchableOpacity>
    );

    // Custom location message renderer with map preview
    const renderCustomView = (props: any) => {
        const { currentMessage } = props;
        if (currentMessage?.location) {
            const { latitude, longitude } = currentMessage.location;
            const openMaps = () => {
                const url = Platform.select({
                    ios: `maps:0,0?q=${latitude},${longitude}`,
                    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
                });
                if (url) Linking.openURL(url);
            };

            return (
                <TouchableOpacity onPress={openMaps} style={styles.locationContainer}>
                    <MapView
                        style={styles.locationMap}
                        initialRegion={{
                            latitude,
                            longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                    >
                        <Marker coordinate={{ latitude, longitude }} />
                    </MapView>
                    <View style={styles.locationInfo}>
                        <Ionicons name="location" size={16} color={colors.primary} />
                        <Text style={[styles.locationText, { color: colors.text }]}>Tap to open in Maps</Text>
                    </View>
                </TouchableOpacity>
            );
        }
        return null;
    };

    const displayName = chat?.isGroupChat ? chat.groupName : (chat?.otherUser?.displayName || recipientName || 'User');
    const displayImage = chat?.isGroupChat ? undefined : (chat?.otherUser?.photoURL || recipientImage || undefined);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.avatarContainer}>
                    <Image style={styles.headerImage} source={{ uri: displayImage }} />
                    {recipientOnline && <View style={styles.onlineIndicator} />}
                </View>
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerName, { color: colors.text }]}>{displayName}</Text>
                    <Text style={[styles.headerStatus, { color: recipientOnline ? '#10B981' : colors.textSecondary }]}>
                        {recipientOnline ? 'Online' : 'Offline'}
                    </Text>
                </View>
                <TouchableOpacity style={styles.headerAction}>
                    <Ionicons name="call-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerAction}>
                    <Ionicons name="videocam-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Chat */}
            <GiftedChat
                messages={messages}
                onSend={msgs => onSend(msgs)}
                user={{
                    _id: currentUser?.uid || 'anonymous',
                    name: currentUser?.displayName || 'User',
                    avatar: currentUser?.photoURL
                }}
                renderBubble={renderBubble}
                renderMessageImage={renderMessageImage}
                renderCustomView={renderCustomView}
                renderInputToolbar={(props) => (
                    <InputToolbar
                        {...props}
                        containerStyle={[styles.inputToolbar, { backgroundColor: colors.card, borderTopColor: colors.border }]}
                        primaryStyle={{ alignItems: 'center' }}
                    />
                )}
                textInputProps={{
                    style: {
                        flex: 1,
                        marginHorizontal: SPACING.sm,
                        paddingHorizontal: SPACING.md,
                        paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xs,
                        paddingBottom: Platform.OS === 'ios' ? SPACING.sm : SPACING.xs,
                        backgroundColor: colors.background,
                        borderRadius: 20,
                        color: colors.text,
                        fontSize: 16,
                        minHeight: 40,
                        maxHeight: 100,
                    },
                    placeholder: 'Type a message...',
                    placeholderTextColor: colors.textSecondary,
                    multiline: true,
                }}
                renderSend={(props) => (
                    <Send {...props} containerStyle={styles.sendContainer}>
                        <View style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="send" size={20} color="#fff" />
                        </View>
                    </Send>
                )}
                renderActions={() => (
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowEmojiPicker(true)}>
                            <Ionicons name="happy-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
                            <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
                            <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={shareLocation}>
                            <Ionicons name="location-outline" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}
                minInputToolbarHeight={60}
            />
            {Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}

            {/* Emoji Picker Modal */}
            <Modal visible={showEmojiPicker} transparent animationType="slide">
                <TouchableOpacity
                    style={styles.emojiModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEmojiPicker(false)}
                >
                    <View style={[styles.emojiContainer, { backgroundColor: colors.card }]}>
                        <View style={styles.emojiHeader}>
                            <Text style={[styles.emojiTitle, { color: colors.text }]}>Emojis</Text>
                            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.emojiGrid}>
                            {EMOJIS.map((emoji, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.emojiBtn}
                                    onPress={() => addEmoji(emoji)}
                                >
                                    <Text style={styles.emojiText}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Message Options Modal */}
            <Modal visible={showMessageOptions} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.messageOptionsOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMessageOptions(false)}
                >
                    <View style={[styles.messageOptionsContainer, { backgroundColor: colors.card }]}>
                        <Text style={[styles.messageOptionsTitle, { color: colors.text }]}>Message Options</Text>
                        <TouchableOpacity
                            style={styles.messageOption}
                            onPress={() => {
                                setEditingMessage(selectedMessage);
                                setInputText(selectedMessage?.text || '');
                                setShowMessageOptions(false);
                            }}
                        >
                            <Ionicons name="pencil-outline" size={22} color={colors.primary} />
                            <Text style={[styles.messageOptionText, { color: colors.text }]}>Edit Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageOption}
                            onPress={() => deleteMessage(selectedMessage?._id)}
                        >
                            <Ionicons name="trash-outline" size={22} color="#EF4444" />
                            <Text style={[styles.messageOptionText, { color: '#EF4444' }]}>Delete Message</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.messageOption, { borderTopWidth: 1, borderTopColor: colors.border }]}
                            onPress={() => setShowMessageOptions(false)}
                        >
                            <Text style={[styles.messageOptionText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Media Preview Modal */}
            <Modal visible={!!pendingMedia} transparent animationType="slide">
                <View style={styles.previewModalContainer}>
                    <View style={[styles.previewModalContent, { backgroundColor: colors.card }]}>
                        {/* Header */}
                        <View style={styles.previewHeader}>
                            <TouchableOpacity
                                onPress={() => {
                                    setPendingMedia(null);
                                    setMediaCaption('');
                                }}
                            >
                                <Ionicons name="close" size={28} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.previewTitle, { color: colors.text }]}>Send Photo</Text>
                            <View style={{ width: 28 }} />
                        </View>

                        {/* Image Preview */}
                        {pendingMedia && (
                            <Image
                                source={{ uri: pendingMedia.uri }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        )}

                        {/* Caption Input + Send */}
                        <View style={[styles.previewFooter, { backgroundColor: colors.background }]}>
                            <View style={[styles.captionInput, { backgroundColor: colors.inputBackground }]}>
                                <Ionicons name="text-outline" size={20} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.captionTextInput, { color: colors.text }]}
                                    placeholder="Add a caption..."
                                    placeholderTextColor={colors.textSecondary}
                                    value={mediaCaption}
                                    onChangeText={setMediaCaption}
                                    multiline
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.sendMediaButton}
                                onPress={() => pendingMedia && sendImageMessage(pendingMedia.uri, mediaCaption)}
                                disabled={isSendingMedia}
                            >
                                <LinearGradient
                                    colors={['#8B5CF6', '#EC4899']}
                                    style={styles.sendMediaButtonGradient}
                                >
                                    {isSendingMedia ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Ionicons name="send" size={22} color="#fff" />
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Location Preview Modal */}
            <Modal visible={showLocationPreview} transparent animationType="slide">
                <View style={styles.previewModalContainer}>
                    <View style={[styles.previewModalContent, { backgroundColor: colors.card }]}>
                        {/* Header */}
                        <View style={styles.previewHeader}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowLocationPreview(false);
                                    setPendingLocation(null);
                                }}
                            >
                                <Ionicons name="close" size={28} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.previewTitle, { color: colors.text }]}>Share Location</Text>
                            <View style={{ width: 28 }} />
                        </View>

                        {/* Map Preview */}
                        {pendingLocation && (
                            <MapView
                                style={styles.previewMap}
                                initialRegion={{
                                    latitude: pendingLocation.latitude,
                                    longitude: pendingLocation.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                            >
                                <Marker coordinate={pendingLocation}>
                                    <View style={styles.locationMarker}>
                                        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.locationMarkerInner}>
                                            <Ionicons name="location" size={20} color="#fff" />
                                        </LinearGradient>
                                    </View>
                                </Marker>
                            </MapView>
                        )}

                        {/* Send Button */}
                        <View style={[styles.previewFooter, { backgroundColor: colors.background }]}>
                            <Text style={[styles.locationInfo, { color: colors.textSecondary }]}>
                                Sharing your current location
                            </Text>
                            <TouchableOpacity
                                style={styles.sendMediaButton}
                                onPress={confirmSendLocation}
                                disabled={isSendingMedia}
                            >
                                <LinearGradient
                                    colors={['#8B5CF6', '#EC4899']}
                                    style={styles.sendMediaButtonGradient}
                                >
                                    {isSendingMedia ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Ionicons name="send" size={22} color="#fff" />
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    backButton: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    headerInfo: { flex: 1 },
    headerName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    headerStatus: { fontSize: FONT_SIZE.xs },
    headerAction: { padding: SPACING.sm },
    inputToolbar: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
    },
    sendContainer: { justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.sm },
    actionBtn: { padding: SPACING.xs, marginRight: 2 },
    // Emoji picker styles
    emojiModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    emojiContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, maxHeight: 300 },
    emojiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    emojiTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    emojiBtn: { padding: SPACING.sm },
    emojiText: { fontSize: 28 },
    // Image message style
    messageImage: { width: 200, height: 200, borderRadius: BORDER_RADIUS.md, margin: SPACING.xs },
    // Online indicator
    avatarContainer: { position: 'relative', marginRight: SPACING.md },
    onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' },
    // Message options modal
    messageOptionsOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    messageOptionsContainer: { borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, width: '80%', maxWidth: 300 },
    messageOptionsTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.md },
    messageOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.md },
    messageOptionText: { fontSize: FONT_SIZE.md, flex: 1 },
    // Location message styles
    locationContainer: { margin: SPACING.xs, borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
    locationMap: { width: 200, height: 150 },
    locationInfo: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.xs },
    locationText: { fontSize: FONT_SIZE.xs },
    // Preview modal styles
    previewModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'space-between' },
    previewModalContent: { flex: 1 },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl },
    previewTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    previewImage: { flex: 1, width: '100%' },
    previewMap: { flex: 1, width: '100%' },
    previewFooter: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
    captionInput: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 25, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm },
    captionTextInput: { flex: 1, fontSize: FONT_SIZE.md, maxHeight: 100 },
    sendMediaButton: { width: 50, height: 50 },
    sendMediaButtonGradient: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    locationMarker: { width: 40, height: 40 },
    locationMarkerInner: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});

export default MessageScreen;
