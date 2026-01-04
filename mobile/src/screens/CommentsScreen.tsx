import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import DefaultAvatar from '../components/DefaultAvatar';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const CommentsScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const { colors } = useTheme();
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const currentUser = auth().currentUser;

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('trips')
      .doc(tripId)
      .collection('comments')
      .orderBy('createdAt', 'desc')
      .onSnapshot(async (querySnapshot) => {
        const promises = querySnapshot.docs.map(async (doc) => {
          const comment = { id: doc.id, ...doc.data() };
          if (comment.userId) {
            try {
              const userDoc = await firestore().collection('users').doc(comment.userId).get();
              if (userDoc.exists) {
                comment.user = userDoc.data();
              }
            } catch { }
          }
          return comment;
        });
        const resolvedComments = await Promise.all(promises);
        setComments(resolvedComments);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [tripId]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) return;

    setPosting(true);
    try {
      await firestore()
        .collection('trips')
        .doc(tripId)
        .collection('comments')
        .add({
          text: commentText,
          userId: currentUser.uid,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      // Also update the comment count on the trip document
      await firestore().collection('trips').doc(tripId).update({
        commentsCount: firestore.FieldValue.increment(1),
      });

      setCommentText('');
    } catch (error) {
      console.error('Error adding comment: ', error);
    } finally {
      setPosting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const renderComment = ({ item }: { item: any }) => (
    <View style={[styles.commentContainer, { backgroundColor: colors.card }]}>
      <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}>
        <DefaultAvatar uri={item.user?.photoURL} size={40} />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.user?.displayName || 'User'}</Text>
          <Text style={[styles.commentDate, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Comments ({comments.length})</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Comments List */}
        {comments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Comments Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Be the first to share your thoughts!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <DefaultAvatar uri={currentUser?.photoURL} size={36} />
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary, opacity: posting || !commentText.trim() ? 0.5 : 1 }]}
            onPress={handleAddComment}
            disabled={posting || !commentText.trim()}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
  },
  commentsList: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  commentContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.md,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontWeight: FONT_WEIGHT.semibold,
    fontSize: FONT_SIZE.sm,
  },
  commentDate: {
    fontSize: FONT_SIZE.xs,
  },
  commentText: {
    fontSize: FONT_SIZE.md,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CommentsScreen;
