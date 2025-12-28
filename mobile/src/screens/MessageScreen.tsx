import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, KeyboardAvoidingView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const MessageScreen = ({ route, navigation }) => {
    const { chatId, recipientId, recipientName, recipientImage } = route.params;
    const { colors } = useTheme();
    const [messages, setMessages] = useState([]);
    const [chat, setChat] = useState(null);
    const [activeChatId, setActiveChatId] = useState(chatId);
    const currentUser = auth.currentUser;

    useEffect(() => {
        initializeChat();
    }, []);

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
            } catch (error) {
                console.log('Chat init error:', error);
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
                    } catch (e) {
                        console.log('User fetch error:', e);
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
                    createdAt: data.createdAt?.toDate() || new Date(),
                    user: data.user,
                };
            });
            setMessages(msgs);
        });

        return () => {
            unsubscribeChat();
            unsubscribeMessages();
        };
    };

    const onSend = useCallback((newMessages = []) => {
        if (!activeChatId) return;

        const { text, user } = newMessages[0];
        firestore().collection('chats').doc(activeChatId).collection('messages').add({
            text,
            user,
            createdAt: firestore.FieldValue.serverTimestamp(),
        });
        firestore().collection('chats').doc(activeChatId).update({
            lastMessage: text,
            lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
        });
    }, [activeChatId]);

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
        />
    );

    const displayName = chat?.isGroupChat ? chat.groupName : (chat?.otherUser?.displayName || recipientName || 'User');
    const displayImage = chat?.isGroupChat ? 'https://via.placeholder.com/50' : (chat?.otherUser?.photoURL || recipientImage || 'https://via.placeholder.com/50');

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
                <Image style={styles.headerImage} source={{ uri: displayImage }} />
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerName, { color: colors.text }]}>{displayName}</Text>
                    <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>Online</Text>
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
                renderInputToolbar={(props) => (
                    <InputToolbar
                        {...props}
                        containerStyle={[styles.inputToolbar, { backgroundColor: colors.card, borderTopColor: colors.border }]}
                        primaryStyle={{ alignItems: 'center' }}
                    />
                )}
                renderSend={(props) => (
                    <Send {...props} containerStyle={styles.sendContainer}>
                        <View style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="send" size={20} color="#fff" />
                        </View>
                    </Send>
                )}
                minInputToolbarHeight={60}
            />
            {Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}
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
        marginRight: SPACING.md,
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
    textInput: { paddingHorizontal: SPACING.md },
});

export default MessageScreen;
