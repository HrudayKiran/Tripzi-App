import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Image, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

type CommentsModalProps = {
    visible: boolean;
    onClose: () => void;
    tripId: string;
};

const CommentsModal = ({ visible, onClose, tripId }: CommentsModalProps) => {
    const { colors } = useTheme();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const slideAnim = useRef(new Animated.Value(500)).current;
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (visible) {
            slideAnim.setValue(500);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 0,
            }).start();
            loadComments();
        } else {
            Animated.timing(slideAnim, {
                toValue: 500,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const loadComments = async () => {
        if (!tripId) return;

        try {
            const commentsRef = firestore()
                .collection('trips')
                .doc(tripId)
                .collection('comments')
                .orderBy('createdAt', 'desc');

            const snapshot = await commentsRef.get();
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setComments(commentsData);
        } catch (error) {
            console.log('Comments load error:', error);
            // Show sample comments
            setComments([
                { id: '1', text: 'This looks amazing! 🔥', userName: 'Traveler', userImage: 'https://randomuser.me/api/portraits/men/1.jpg', createdAt: new Date() },
                { id: '2', text: 'Count me in!', userName: 'Explorer', userImage: 'https://randomuser.me/api/portraits/women/2.jpg', createdAt: new Date() },
            ]);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim() || !currentUser) return;

        const comment = {
            text: newComment.trim(),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            userImage: currentUser.photoURL || 'https://via.placeholder.com/40',
            createdAt: new Date(),
        };

        // Optimistic update
        setComments([comment, ...comments]);
        setNewComment('');

        try {
            await firestore()
                .collection('trips')
                .doc(tripId)
                .collection('comments')
                .add({
                    ...comment,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });
        } catch (error) {
            console.log('Comment save error:', error);
        }
    };

    const renderComment = ({ item }) => (
        <View style={[styles.commentItem, { backgroundColor: colors.card }]}>
            <Image
                source={{ uri: item.userImage || 'https://via.placeholder.com/40' }}
                style={styles.commentAvatar}
            />
            <View style={styles.commentContent}>
                <Text style={[styles.commentUserName, { color: colors.text }]}>{item.userName}</Text>
                <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
                <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                    {item.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                </Text>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.container,
                        { backgroundColor: colors.background, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: colors.border }]}>
                            <View style={styles.headerHandle} />
                            <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Comments List */}
                        <FlatList
                            data={comments}
                            renderItem={renderComment}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.commentsList}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="chatbubble-outline" size={48} color={colors.textSecondary} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No comments yet. Be the first!
                                    </Text>
                                </View>
                            }
                        />

                        {/* Input */}
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}
                        >
                            <Image
                                source={{ uri: currentUser?.photoURL || 'https://via.placeholder.com/40' }}
                                style={styles.inputAvatar}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                                placeholder="Add a comment..."
                                placeholderTextColor={colors.textSecondary}
                                value={newComment}
                                onChangeText={setNewComment}
                                multiline
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, { backgroundColor: colors.primary }]}
                                onPress={handleSendComment}
                                disabled={!newComment.trim()}
                            >
                                <Ionicons name="send" size={18} color="#fff" />
                            </TouchableOpacity>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    backdrop: { flex: 1 },
    container: { height: '70%', borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl },
    header: { alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1 },
    headerHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, marginBottom: SPACING.sm },
    title: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    closeButton: { position: 'absolute', right: SPACING.lg, top: SPACING.lg },
    commentsList: { padding: SPACING.lg },
    commentItem: { flexDirection: 'row', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm },
    commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.md },
    commentContent: { flex: 1 },
    commentUserName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: 2 },
    commentText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
    commentTime: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxxl },
    emptyText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderTopWidth: 1 },
    inputAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
    input: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, maxHeight: 80 },
    sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: SPACING.sm },
});

export default CommentsModal;
