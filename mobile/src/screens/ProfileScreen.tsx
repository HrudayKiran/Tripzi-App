import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        setUser(doc.data());
      });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigation.navigate('Start');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

      {/* User Profile Section */}
      <Animatable.View animation="fadeInUp" style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Image
            style={styles.avatar}
            source={{ uri: user?.photoURL || 'https://via.placeholder.com/120' }}
          />
          <View style={styles.onlineIndicator} />
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.displayName || 'User'}</Text>
      </Animatable.View>

      {/* Menu Items */}
      <Animatable.View animation="fadeInUp" delay={200} style={[styles.menuContainer, { backgroundColor: colors.background }]}>
        <MenuItem
          icon="map-outline"
          iconColor="#00BFA6"
          iconBg="#E0F7F4"
          text="My Trips"
          onPress={() => navigation.navigate('My Trips')}
          textColor={colors.text}
        />
        <MenuItem
          icon="swap-horizontal-outline"
          iconColor="#3B82F6"
          iconBg="#E0F2FE"
          text="Switch Account"
          onPress={() => { }}
          textColor={colors.text}
        />
        <MenuItem
          icon="shield-checkmark-outline"
          iconColor="#10B981"
          iconBg="#D1FAE5"
          text="KYC Status"
          badge="Verified"
          onPress={() => navigation.navigate('Kyc')}
          textColor={colors.text}
        />
        <MenuItem
          icon="document-text-outline"
          iconColor="#8B5CF6"
          iconBg="#EDE9FE"
          text="Privacy Policy"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          textColor={colors.text}
        />
        <MenuItem
          icon="document-text-outline"
          iconColor="#EC4899"
          iconBg="#FCE7F3"
          text="Terms and Conditions"
          onPress={() => navigation.navigate('Terms')}
          textColor={colors.text}
        />
        <MenuItem
          icon="bulb-outline"
          iconColor="#F59E0B"
          iconBg="#FEF3C7"
          text="Suggest a New Feature"
          onPress={() => navigation.navigate('SuggestFeature')}
          textColor={colors.text}
        />
        <MenuItem
          icon="help-circle-outline"
          iconColor="#06B6D4"
          iconBg="#CFFAFE"
          text="Help & Support"
          onPress={() => navigation.navigate('HelpSupport')}
          textColor={colors.text}
        />
        <MenuItem
          icon="settings-outline"
          iconColor="#6B7280"
          iconBg="#F3F4F6"
          text="Settings"
          onPress={() => navigation.navigate('Settings')}
          textColor={colors.text}
        />
      </Animatable.View>

      {/* Go Ad-Free **Section */}
      <Animatable.View animation="fadeInUp" delay={400} style={styles.adFreeContainer}>
        <View style={styles.adFreeContent}>
          <View style={styles.adFreeIcon}>
            <Ionicons name="card-outline" size={24} color="#8A2BE2" />
          </View>
          <View style={styles.adFreeTextContainer}>
            <Text style={styles.adFreeTitle}>Go Ad-Free</Text>
            <Text style={styles.adFreeSubtitle}>Enjoy premium experience</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.upgradeButton}>
          <Text style={styles.upgradeButtonText}>Upgrade</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* Version */}
      <Text style={styles.version}>Tripzi v1.2.3</Text>

      {/* Logout Button */}
      <Animatable.View animation="fadeInUp" delay={600} style={styles.logoutContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animatable.View>

      <View style={{ height: 100 }} />
    </ScrollView>
    </SafeAreaView>
  );
};

type MenuItemProps = {
  icon: string;
  iconColor: string;
  iconBg: string;
  text: string;
  badge?: string;
  onPress?: () => void;
  textColor?: string;
};

const MenuItem = ({ icon, iconColor, iconBg, text, badge, onPress, textColor = '#1a1a1a' }: MenuItemProps) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIconContainer, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
    </View>
    <Text style={[styles.menuText, { color: textColor }]}>{text}</Text>
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : (
      <Ionicons name="chevron-forward-outline" size={20} color="#D1D5DB" />
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#F3E8FF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  adFreeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 30,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adFreeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adFreeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adFreeTextContainer: {
    flex: 1,
  },
  adFreeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  adFreeSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  upgradeButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 20,
  },
  logoutContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default ProfileScreen;
