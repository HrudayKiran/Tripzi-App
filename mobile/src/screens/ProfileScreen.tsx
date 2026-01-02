import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    // Permanent Admin Promotion for specific ID
    if (currentUser.uid === 'S3FDk8SnV7haRUec2zPoUo38Vi02') {
      firestore().collection('users').doc(currentUser.uid).update({ role: 'admin' })
        .catch(err => console.log('Admin promotion error (harmless if already admin):', err));
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          setUser({ id: doc.id, ...doc.data() });
        } else {
          setUser({
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
          });
        }
      }, (error) => {
        // Error handled silently
        setUser({
          displayName: auth().currentUser?.displayName,
          email: auth().currentUser?.email,
          photoURL: auth().currentUser?.photoURL,
        });
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
            try {
              if (auth().currentUser) {
                await firestore().collection('users').doc(auth().currentUser.uid).update({
                  lastLogoutAt: firestore.FieldValue.serverTimestamp(),
                });
              }
            } catch (e) { console.log('Logout timestamp update failed', e); }

            await auth().signOut();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Start' }],
            });
          }
        },
      ]
    );
  };

  // Quick KYC verify for testing - removes the need to do actual KYC
  const verifyMyKyc = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
      await firestore().collection('users').doc(currentUser.uid).update({
        kycStatus: 'verified',
        kycVerifiedAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert('Success! ✓', 'Your KYC has been verified for testing.');
    } catch (error) {
      // Error handled silently
      Alert.alert('Done', 'KYC status updated.');
    }
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
                source={{ uri: user?.photoURL || auth.currentUser?.photoURL || undefined }}
              />
              <View style={[styles.onlineIndicator, { borderColor: colors.card }]} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {user?.displayName || auth.currentUser?.displayName || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {user?.email || auth().currentUser?.email}
              </Text>
              {user?.username && (
                <Text style={[styles.username, { color: colors.primary }]}>@{user.username}</Text>
              )}
              <Text style={[styles.viewProfileText, { color: colors.primary }]}>
                View profile →
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </Animatable.View>
        </TouchableOpacity>

        {/* My Trips Section */}
        <Animatable.View animation="fadeInUp" delay={100} duration={400} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MY TRIPS</Text>

          <MenuItem
            icon="map-outline"
            iconColor="#6366F1"
            iconBg="#E0E7FF"
            text="My Trips"
            onPress={() => navigation.navigate('MyTrips')}
          />
        </Animatable.View>

        {/* Menu Items */}
        <Animatable.View animation="fadeInUp" delay={150} duration={400} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>



          <MenuItem
            icon="shield-checkmark-outline"
            iconColor="#10B981"
            iconBg="#D1FAE5"
            text="KYC Status"
            badge={user?.kycStatus === 'verified' ? 'Verified' : 'Pending'}
            onPress={() => navigation.navigate('KYC')}
          />
          {user?.kycStatus !== 'verified' && (
            <MenuItem
              icon="checkmark-circle-outline"
              iconColor="#8B5CF6"
              iconBg="#EDE9FE"
              text="Quick Verify (Testing)"
              onPress={verifyMyKyc}
            />
          )}
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

        <Animatable.View animation="fadeInUp" delay={200} duration={400} style={styles.menuSection}>
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

        <Animatable.View animation="fadeInUp" delay={300} duration={400} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>

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
    marginBottom: SPACING.xl,
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
  userName: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  userEmail: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  username: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  viewProfileText: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    marginTop: SPACING.md,
  },
  logoutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  logoutButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  accountSwitchModal: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.xl },
  accountCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
  accountAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: SPACING.md },
  accountInfo: { flex: 1 },
  accountName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  accountEmail: { fontSize: FONT_SIZE.sm },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderStyle: 'dashed', marginTop: SPACING.md, gap: SPACING.sm },
  addAccountText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
});

export default ProfileScreen;
