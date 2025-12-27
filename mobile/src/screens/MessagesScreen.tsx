
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const MessagesScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(async (querySnapshot) => {
        const promises = querySnapshot.docs.map(async (doc) => {
          const chat = { id: doc.id, ...doc.data() };
          if (!chat.isGroupChat) {
            const otherUserId = chat.participants.find(p => p !== currentUser.uid);
            if (otherUserId) {
                const userDoc = await firestore().collection('users').doc(otherUserId).get();
                chat.otherUser = userDoc.data();
            }
          }
          return chat;
        });
        const resolvedChats = await Promise.all(promises);
        setChats(resolvedChats);
      });

    return () => unsubscribe();
  }, []);

  const filteredChats = chats.filter(chat => {
      const chatName = chat.isGroupChat ? chat.groupName : chat.otherUser?.displayName;
      return chatName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderChat = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 100}>
        <TouchableOpacity
        style={styles.chatContainer}
        onPress={() => navigation.navigate('Message', { chatId: item.id })}
        >
        <Image
            style={styles.chatImage}
            source={{ uri: item.isGroupChat ? 'https://picsum.photos/seed/group/50' : item.otherUser?.photoURL || 'https://picsum.photos/seed/person/50' }}
        />
        <View style={styles.chatInfo}>
            <Text style={styles.chatName}>
            {item.isGroupChat ? item.groupName : item.otherUser?.displayName}
            </Text>
            <Text style={styles.lastMessage}>{item.lastMessage}</Text>
        </View>
        <Text style={styles.chatTime}>{new Date(item.lastMessageTimestamp?.toDate()).toLocaleTimeString()}</Text>
        </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Messages</Text>
            <TouchableOpacity style={styles.createGroupButton} onPress={() => navigation.navigate('CreateGroupChat')}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
            <TextInput 
                style={styles.searchInput}
                placeholder="Search chats..."
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
        </View>
        <FlatList
            data={filteredChats}
            renderItem={renderChat}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
        />
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#8A2BE2',
        paddingTop: 50,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    createGroupButton: {
        padding: 5,
    },
    searchContainer: {
        padding: 10,
        backgroundColor: '#8A2BE2',
    },
    searchInput: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 10,
        fontSize: 16,
    },
    listContainer: {
        padding: 10,
    },
    chatContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 10,
    },
    chatImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    chatInfo: {
        flex: 1,
    },
    chatName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    lastMessage: {
        color: '#666',
    },
    chatTime: {
        fontSize: 12,
        color: '#999',
    },
});

export default MessagesScreen;
