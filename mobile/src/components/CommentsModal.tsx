import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, Image, KeyboardAvoidingView, Platform, Animated, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import DefaultAvatar from './DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

type Comment = {
    id: string;
    text: string;
    userId: string;
    userName: string;
    userImage: string;
    createdAt?: any;
};

type CommentsModalProps = {
    visible: boolean;
    onClose: () => void;
    tripId: string;
};

const CommentsModal = ({ visible, onClose, tripId }: CommentsModalProps) => {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [editingComment, setEditingComment] = useState<Comment | null>(null);
    const [editText, setEditText] = useState('');
    const slideAnim = useRef(new Animated.Value(500)).current;
    const currentUser = auth().currentUser;

    useEffect(() => {
        if (visible) {
            slideAnim.setValue(500);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 500,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // Real-time comments listener
    useEffect(() => {
        if (!visible || !tripId) return;

        const commentsRef = firestore()
            .collection('trips')
            .doc(tripId)
            .collection('comments')
            .orderBy('createdAt', 'desc');

        const unsubscribe = commentsRef.onSnapshot(
            (snapshot) => {
                const commentsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Comment[];
                setComments(commentsData);
            },
            (error) => {
                console.log('Comments listener error:', error);
                setComments([]);
            }
        );

        return () => unsubscribe();
    }, [visible, tripId]);

    const handleSendComment = async () => {
        if (!newComment.trim() || !currentUser) return;

        const tempId = `temp_${Date.now()}`;
        const comment: Comment = {
            id: tempId,
            text: newComment.trim(),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            userImage: currentUser.photoURL || null,
            createdAt: new Date(),
        };

        // Optimistic update with temp ID
        setComments(prev => [comment, ...prev]);
        setNewComment('');

        try {
            const docRef = await firestore()
                .collection('trips')
                .doc(tripId)
                .collection('comments')
                .add({
                    text: comment.text,
                    userId: comment.userId,
                    userName: comment.userName,
                    userImage: comment.userImage,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                });
            // Real-time listener will update the list automatically
            Keyboard.dismiss();
        } catch {
            // Comment save failed silently
        }
    };

    const handleEditComment = (comment: Comment) => {
        setEditingComment(comment);
        setEditText(comment.text);
    };

    const handleSaveEdit = async () => {
        if (!editingComment || !editText.trim()) return;

        const updatedText = editText.trim();

        // Optimistic update
        setComments(prev => prev.map(c =>
            c.id === editingComment.id ? { ...c, text: updatedText } : c
        ));
        setEditingComment(null);
        setEditText('');

        try {
            await firestore()
                .collection('trips')
                .doc(tripId)
                .collection('comments')
                .doc(editingComment.id)
                .update({ text: updatedText });
        } catch {
            // Comment update failed silently
        }
    };

    const handleDeleteComment = (comment: Comment) => {
        Alert.alert(
            'Delete Comment',
            'Are you sure you want to delete this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Optimistic delete
                        setComments(prev => prev.filter(c => c.id !== comment.id));

                        try {
                            await firestore()
                                .collection('trips')
                                .doc(tripId)
                                .collection('comments')
                                .doc(comment.id)
                                .delete();
                        } catch {
                            // Re-add if failed
                            setComments(prev => [comment, ...prev]);
                        }
                    },
                },
            ]
        );
    };

    const handleUserPress = (userId: string) => {
        onClose();
        navigation.navigate('UserProfile' as never, { userId } as never);
    };

    const renderComment = ({ item }: { item: Comment }) => {
        const isOwner = item.userId === currentUser?.uid;
        const isEditing = editingComment?.id === item.id;

        return (
            <View style={[styles.commentItem, { backgroundColor: colors.card }]}>
                <TouchableOpacity onPress={() => handleUserPress(item.userId)}>
                    <DefaultAvatar
                        uri={item.userImage}
                        size={40}
                        style={styles.commentAvatar}
                    />
                </TouchableOpacity>
                <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                        <TouchableOpacity onPress={() => handleUserPress(item.userId)}>
                            <Text style={[styles.commentUserName, { color: colors.text }]}>{item.userName}</Text>
                        </TouchableOpacity>
                        {isOwner && !isEditing && (
                            <View style={styles.commentActions}>
                                <TouchableOpacity onPress={() => handleEditComment(item)} style={styles.actionBtn}>
                                    <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteComment(item)} style={styles.actionBtn}>
                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {isEditing ? (
                        <View style={styles.editContainer}>
                            <TextInput
                                style={[styles.editInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                                value={editText}
                                onChangeText={setEditText}
                                multiline
                                autoFocus
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity onPress={() => setEditingComment(null)} style={styles.editBtn}>
                                    <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveEdit} style={[styles.editBtn, { backgroundColor: colors.primary }]}>
                                    <Text style={{ color: '#fff' }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
                            <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
                                {item.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Just now'}
                            </Text>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
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
                                keyExtractor={(item, index) => item.id || `comment_${index}`}
                                contentContainerStyle={styles.commentsList}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
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
                            <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                                <DefaultAvatar
                                    uri={currentUser?.photoURL}
                                    size={36}
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
                                    style={[styles.sendButton, { backgroundColor: newComment.trim() ? colors.primary : colors.border }]}
                                    onPress={handleSendComment}
                                    disabled={!newComment.trim()}
                                >
                                    <Ionicons name="send" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
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
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    commentUserName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, marginBottom: 2 },
    commentActions: { flexDirection: 'row', gap: SPACING.sm },
    actionBtn: { padding: SPACING.xs },
    commentText: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
    commentTime: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
    emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxxl },
    emptyText: { fontSize: FONT_SIZE.sm, marginTop: SPACING.md },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderTopWidth: 1 },
    inputAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.sm },
    input: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, maxHeight: 80 },
    sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: SPACING.sm },
    editContainer: { marginTop: SPACING.xs },
    editInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, fontSize: FONT_SIZE.sm },
    editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
    editBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
});

export default CommentsModal;
