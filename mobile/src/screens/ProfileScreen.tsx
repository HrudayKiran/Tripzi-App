
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Switch, ScrollView, Animated } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const scrollY = new Animated.Value(0);

  useEffect(() => {
    const currentUser = auth().currentUser;
    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        setUser(doc.data());
      });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth().signOut();
    navigation.navigate('Start');
  };

  const toggleDarkMode = () => setIsDarkMode(previousState => !previousState);

  const headerHeight = scrollY.interpolate({
      inputRange: [0, 200],
      outputRange: [250, 80],
      extrapolate: 'clamp'
  });

  const profileImageSize = scrollY.interpolate({
      inputRange: [0, 150],
      outputRange: [120, 50],
      extrapolate: 'clamp'
  });

  return (
    <View style={styles.container}>
        <Animated.View style={[styles.header, { height: headerHeight }]}>
            <Image style={styles.headerBg} source={{uri: 'https://picsum.photos/400/300'}} />
        </Animated.View>

        <ScrollView 
            style={styles.scrollContainer}
            onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
        >
            <Animatable.View style={styles.profileContainer} animation="fadeInUp" delay={200}>
                <Animated.Image style={[styles.profileImage, {width: profileImageSize, height: profileImageSize}]} source={{ uri: user?.photoURL }} />
                <Text style={styles.profileName}>{user?.displayName}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <Text style={styles.kycStatus}>KYC: {user?.kyc?.status || 'Not Verified'}</Text>
            </Animatable.View>
            
            <Animatable.View style={styles.menu} animation="fadeInUp" delay={400}>
                <MenuItem icon="shield-checkmark-outline" text="KYC Verification" onPress={() => navigation.navigate('Kyc')} />
                <MenuItem icon="moon-outline" text="Dark Mode" onValueChange={toggleDarkMode} value={isDarkMode} isSwitch />
                <MenuItem icon="document-text-outline" text="Terms & Conditions" onPress={() => navigation.navigate('Terms')} />
                <MenuItem icon="lock-closed-outline" text="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
                <MenuItem icon="help-circle-outline" text="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
                <MenuItem icon="bulb-outline" text="Suggest a Feature" onPress={() => navigation.navigate('SuggestFeature')} />
                <MenuItem icon="log-out-outline" text="Logout" onPress={handleLogout} color="#ff6b6b" />
            </Animatable.View>
        </ScrollView>
    </View>
  );
};

type MenuItemProps = {
  icon: any;
  text: any;
  onPress?: () => any;
  color?: string;
  isSwitch?: boolean;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
};

const MenuItem = ({ icon, text, onPress, color = '#333', isSwitch = false, value, onValueChange }: MenuItemProps) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Ionicons name={icon} size={24} color={color} style={styles.menuIcon} />
    <Text style={[styles.menuText, {color}]}>{text}</Text>
    {isSwitch && <Switch value={value} onValueChange={onValueChange} thumbColor={'#8A2BE2'} trackColor={{false: '#ccc', true: '#e0b0ff'}} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    backgroundColor: '#8A2BE2',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerBg: {
      width: '100%',
      height: '100%',
      opacity: 0.5,
  },
  scrollContainer: {
      flex: 1,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 100, 
    marginBottom: 30,
  },
  profileImage: {
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 10,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
  },
  kycStatus: {
      marginTop: 5,
      fontSize: 14,
      color: '#8A2BE2',
      fontWeight: 'bold',
  },
  menu: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 10,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    marginRight: 20,
  },
  menuText: {
    fontSize: 16,
    flex: 1,
  },
});

export default ProfileScreen;
