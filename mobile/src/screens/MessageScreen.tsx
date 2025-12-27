
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, KeyboardAvoidingView, Image, TouchableOpacity } from 'react-native';
import { GiftedChat, Bubble, Send, InputToolbar } from 'react-native-gifted-chat';
import { IconButton } from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import MapView, { Marker } from 'react-native-maps';

const MessageScreen = ({ route, navigation }) => {
  const { chatId } = route.params;
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const currentUser = auth().currentUser;

  useEffect(() => {
    const chatRef = firestore().collection('chats').doc(chatId);

    const unsubscribeChat = chatRef.onSnapshot(async (doc) => {
        const chatData = { id: doc.id, ...doc.data() };
        if (!chatData.isGroupChat) {
            const otherUserId = chatData.participants.find(p => p !== currentUser.uid);
            if (otherUserId) {
                const userDoc = await firestore().collection('users').doc(otherUserId).get();
                chatData.otherUser = userDoc.data();
            }
        }
        setChat(chatData);
    });

    const messagesRef = chatRef.collection('messages');
    const unsubscribeMessages = messagesRef.orderBy('createdAt', 'desc').onSnapshot(querySnapshot => {
      const messages = querySnapshot.docs.map(doc => {
        const firebaseData = doc.data();
        return {
          _id: doc.id,
          text: firebaseData.text,
          createdAt: firebaseData.createdAt ? firebaseData.createdAt.toDate() : new Date(),
          user: firebaseData.user,
          isEdited: firebaseData.isEdited || false,
          location: firebaseData.location || null,
        };
      });
      setMessages(messages);
    });

    return () => {
        unsubscribeChat();
        unsubscribeMessages();
    };
  }, [chatId, currentUser.uid]);

  const onSend = useCallback((messages = []) => {
    const { _id, createdAt, text, user, location } = messages[0];
    firestore().collection('chats').doc(chatId).collection('messages').add({
        _id,
        createdAt,
        text,
        user,
        location,
    });
    firestore().collection('chats').doc(chatId).update({
        lastMessage: text || 'Location Shared',
        lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
    });
  }, [chatId]);

  const renderBubble = (props) => {
    if (props.currentMessage.location) {
      return (
          <TouchableOpacity style={styles.mapBubble} onPress={() => navigation.navigate('Map', { location: props.currentMessage.location })}>
              <MapView
                  style={styles.map}
                  region={{
                      latitude: props.currentMessage.location.latitude,
                      longitude: props.currentMessage.location.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
              >
                  <Marker coordinate={props.currentMessage.location} />
              </MapView>
          </TouchableOpacity>
      );
    }

    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: { backgroundColor: '#8A2BE2' },
          left: { backgroundColor: '#f0f0f0' },
        }}
        textStyle={{
            right: { color: '#fff' },
            left: { color: '#333' },
        }}
      />
    );
  };

  const handleLocationSelect = (location) => {
    onSend([{
        _id: Math.random().toString(),
        createdAt: new Date(),
        user: { _id: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL },
        location
    }]);
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <IconButton icon="arrow-left" size={28} color="#333" onPress={() => navigation.goBack()} />
            <Image style={styles.headerImage} source={{ uri: chat?.isGroupChat ? 'https://picsum.photos/seed/group/50' : chat?.otherUser?.photoURL }} />
            <Text style={styles.headerName}>{chat?.isGroupChat ? chat.groupName : chat?.otherUser?.displayName}</Text>
        </View>
        <GiftedChat
            messages={messages}
            onSend={messages => onSend(messages)}
            user={{ _id: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL }}
            renderBubble={renderBubble}
            renderInputToolbar={(props) => <InputToolbar {...props} containerStyle={styles.inputToolbar} />}
            renderActions={(props) => (
                <IconButton
                    icon="map-marker-plus"
                    size={28}
                    color="#8A2BE2"
                    onPress={() => navigation.navigate('Map', { onSelectLocation: handleLocationSelect })}
                />
            )}
            renderSend={(props) => (
                <Send {...props} containerStyle={styles.sendContainer}>
                    <IconButton icon="send" size={28} color="#8A2BE2" />
                </Send>
            )}
        />
        {Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}
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
        paddingTop: 40,
        paddingBottom: 10,
        paddingHorizontal: 10,
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginHorizontal: 10,
    },
    headerName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    inputToolbar: {
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#f8f8f8',
        paddingVertical: 5,
    },
    sendContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        marginRight: 10,
    },
    mapBubble: {
        width: 250,
        height: 200,
        borderRadius: 15,
        overflow: 'hidden',
        margin: 5,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    }
});

export default MessageScreen;
