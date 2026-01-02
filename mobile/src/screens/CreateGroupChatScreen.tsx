
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const CreateGroupChatScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot((querySnapshot) => {
        const users = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== auth().currentUser?.uid);
        setUsers(users);
      });

    return () => unsubscribe();
  }, []);

  const handleSelectUser = (user) => {
    if (selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroupChat = async () => {
    const currentUser = auth().currentUser;
    if (!groupName || selectedUsers.length === 0) return;

    const participants = [currentUser.uid, ...selectedUsers.map((u) => u.id)];

    const chat = await firestore().collection('chats').add({
      groupName,
      participants,
      isGroupChat: true,
      createdAt: firestore.FieldValue.serverTimestamp(),
      lastMessage: `Group created by ${currentUser.displayName}`,
      lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
    });

    navigation.replace('Message', { chatId: chat.id });
  };

  const filteredUsers = users.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderUser = ({ item }) => (
    <TouchableOpacity style={styles.userContainer} onPress={() => handleSelectUser(item)}>
      <Image style={styles.userImage} source={{ uri: item.photoURL }} />
      <Text style={styles.userName}>{item.displayName}</Text>
      <Ionicons
        name={selectedUsers.find(u => u.id === item.id) ? 'checkmark-circle' : 'ellipse-outline'}
        size={28}
        color={selectedUsers.find(u => u.id === item.id) ? '#8A2BE2' : '#ccc'}
      />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text style={styles.title}>New Group</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Group Name"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      {selectedUsers.length > 0 && (
        <View style={styles.selectedUsersContainer}>
          <FlatList
            data={selectedUsers}
            horizontal
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Animatable.View animation="bounceIn">
                <Image style={styles.selectedUserImage} source={{ uri: item.photoURL }} />
              </Animatable.View>
            )}
          />
        </View>
      )}

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for friends..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
      />

      <Animatable.View animation="slideInUp">
        <TouchableOpacity style={styles.createButton} onPress={handleCreateGroupChat} disabled={!groupName || selectedUsers.length === 0}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
      </Animatable.View>
    </KeyboardAvoidingView>
  );
};

const IconButton = ({ icon, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <Ionicons name={icon} size={28} style={styles.headerIcon} />
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 40,
    backgroundColor: '#fff',
  },
  headerIcon: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  inputContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    backgroundColor: '#fff'
  },
  groupNameInput: {
    fontSize: 18,
    paddingBottom: 10,
  },
  selectedUsersContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  selectedUserImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginHorizontal: 5,
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#f0f2f5'
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
  },
  userImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  userName: {
    flex: 1,
    fontSize: 16,
  },
  createButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#8A2BE2',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
});

export default CreateGroupChatScreen;
