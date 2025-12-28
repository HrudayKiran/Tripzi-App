import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        setUser(doc.data());
      });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut(auth);
            navigation.navigate('Start');
          }
        },
      ]
    );
  };

  const MenuItem = ({ icon, iconColor, iconBg, text, badge = null, onPress, isDestructive = false }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.menuItemText, { color: isDestructive ? colors.error : colors.text }]}>
        {text}
      </Text>
      {badge && (
        <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: colors.card }]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* User Profile Card - Tappable to view full profile */}
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: auth.currentUser?.uid })}
          activeOpacity={0.8}
        >
          <Animatable.View animation="fadeInUp" duration={400} style={[styles.profileCard, { backgroundColor: colors.card }]}>
            <View style={styles.avatarContainer}>
              <Image
                style={styles.avatar}
                source={{ uri: user?.photoURL || auth.currentUser?.photoURL || 'https://via.placeholder.com/120' }}
              />
              <View style={[styles.onlineIndicator, { borderColor: colors.card }]} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {user?.displayName || auth.currentUser?.displayName || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {auth.currentUser?.email}
              </Text>
              <Text style={[styles.viewProfileText, { color: colors.primary }]}>
                Tap to view profile →
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </Animatable.View>
        </TouchableOpacity>

        {/* Stats */}
        <Animatable.View animation="fadeInUp" delay={100} duration={400} style={styles.statsContainer}>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>12</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{user?.followers?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{user?.following?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
          </View>
        </Animatable.View>

        {/* Menu Items */}
        <Animatable.View animation="fadeInUp" delay={200} duration={400} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>

          <MenuItem
            icon="map-outline"
            iconColor="#00BFA6"
            iconBg="#E0F7F4"
            text="My Trips"
            onPress={() => navigation.navigate('My Trips')}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            iconColor="#10B981"
            iconBg="#D1FAE5"
            text="KYC Status"
            badge={user?.kycStatus === 'verified' ? 'Verified' : 'Pending'}
            onPress={() => navigation.navigate('KYC')}
          />
          <MenuItem
            icon="document-text-outline"
            iconColor="#8B5CF6"
            iconBg="#EDE9FE"
            text="Terms of Service"
            onPress={() => navigation.navigate('Terms')}
          />
          <MenuItem
            icon="lock-closed-outline"
            iconColor="#3B82F6"
            iconBg="#DBEAFE"
            text="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={300} duration={400} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUPPORT</Text>

          <MenuItem
            icon="bulb-outline"
            iconColor="#F59E0B"
            iconBg="#FEF3C7"
            text="Suggest a Feature"
            onPress={() => navigation.navigate('SuggestFeature')}
          />
          <MenuItem
            icon="help-circle-outline"
            iconColor="#06B6D4"
            iconBg="#CFFAFE"
            text="Help & Support"
            onPress={() => navigation.navigate('HelpSupport')}
          />
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={400} duration={400} style={styles.menuSection}>
          <MenuItem
            icon="log-out-outline"
            iconColor="#EF4444"
            iconBg="#FEE2E2"
            text="Log Out"
            onPress={handleLogout}
            isDestructive
          />
        </Animatable.View>

        <View style={{ height: SPACING.xxxl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  settingsButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    borderRadius: TOUCH_TARGET.min / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
  },
  profileInfo: { flex: 1, marginLeft: SPACING.lg },
  userName: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  userEmail: { fontSize: FONT_SIZE.sm },
  viewProfileText: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  statNumber: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  statLabel: { fontSize: FONT_SIZE.xs },
  menuSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuItemText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.sm,
  },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: '#10B981' },
});

export default ProfileScreen;
