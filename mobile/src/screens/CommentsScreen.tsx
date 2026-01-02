
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { IconButton } from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const CommentsScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
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
            const userDoc = await firestore().collection('users').doc(comment.userId).get();
            if (userDoc.exists) {
              comment.user = userDoc.data();
            }
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
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment: ', error);
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentContainer}>
      <Image style={styles.userImage} source={{ uri: item.user?.photoURL }} />
      <View style={styles.commentTextContainer}>
        <Text style={styles.userName}>{item.user?.displayName}</Text>
        <Text>{item.text}</Text>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#8A2BE2" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={28}
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.title}>Comments</Text>
      </View>
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.commentsList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleAddComment}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  commentsList: {
    padding: 15,
  },
  commentContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  commentTextContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    padding: 10,
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default CommentsScreen;
