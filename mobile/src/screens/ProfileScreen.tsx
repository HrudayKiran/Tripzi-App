import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, STATUS, NEUTRAL } from '../styles';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import DefaultAvatar from '../components/DefaultAvatar';
import { resetDatabase, database } from '../database';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { unregisterPushToken, cancelAllScheduledNotifications } from '../services/notificationService';
import { clearBadgeCount } from '../services/notificationChannels';


const ProfileScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState(null);


  // Load profile from WatermelonDB first (instant), then subscribe to Supabase realtime
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      // Kept as let so the cleanup can remove it even if init() hasn't
      // finished yet (e.g. user navigates away before getSession resolves).
      let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

      const init = async () => {
        // getSession() is cache-backed — no network round-trip.
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        if (!authUser || !isMounted) return;

        // Configure Google Signin
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (webClientId) {
          GoogleSignin.configure({
            webClientId,
            offlineAccess: true,
            scopes: ['profile', 'email'],
          });
        }

        // 1. Try WatermelonDB first (instant)
        try {
          const localProfile = await database.get('profiles').find(authUser.id);
          if (isMounted && localProfile) {
            const lp = localProfile as any;
            setUser({
              id: authUser.id,
              displayName: lp._raw.name || 'User',
              photoURL: lp._raw.photo_url,
              email: authUser.email,
              username: lp._raw.username,
            });
          }
        } catch {
          // Not in local DB — fall through to Supabase
        }

        // 2. Fetch from Supabase (fresh data, updates local state)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (isMounted && profile) {
          setUser({
            id: profile.id,
            ...profile,
            displayName: profile.name || 'User',
            photoURL: profile.photo_url,
            email: profile.email,
            username: profile.username,
          });
        } else if (isMounted) {
          setUser(prev => prev || {
            displayName: authUser.user_metadata?.full_name || 'User',
            email: authUser.email,
            photoURL: authUser.user_metadata?.avatar_url,
          });
        }

        // 3. Subscribe to realtime updates scoped to THIS user's profile row.
        //    Without the filter, any user's profile change would overwrite the
        //    logged-in user's profile card with a stranger's data.
        if (!isMounted) return;
        const channelId = `profile-changes-${Math.random().toString(36).substring(2, 9)}`;
        realtimeChannel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${authUser.id}`,
            },
            (payload) => {
              if (payload.new && isMounted) {
                const p = payload.new as any;
                setUser({
                  id: p.id,
                  ...p,
                  displayName: p.name || 'User',
                  photoURL: p.photo_url,
                });
              }
            }
          )
          .subscribe();
      };

      init();

      return () => {
        isMounted = false;
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      };
    }, [])
  );

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
            // Reset profile status fields while still authenticated
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                await supabase.from('profiles').update({
                  push_notifications_enabled: false,
                  notification_permission_status: 'not_determined',
                  presence: 'offline',
                  last_seen_at: new Date().toISOString(),
                }).eq('id', session.user.id);
              }
            } catch (e) {
              // Don't block logout if this fails
            }

            // Unregister push token BEFORE signing out (needs auth header)
            try {
              await unregisterPushToken();
            } catch (e) {
              // Don't block logout if this fails
            }

            // Cancel all scheduled local notifications & clear badge
            try {
              await cancelAllScheduledNotifications();
              await clearBadgeCount();
            } catch (e) {
              // Don't block logout if this fails
            }

            try {
              await GoogleSignin.signOut();
            } catch (error: any) {
              // Ignore if already signed out
            }

            try {
              await supabase.auth.signOut();
            } catch (e: any) {
              // Ignore sign out errors
            }

            // Clear local database on logout and await it to prevent data leaking
            try {
              await resetDatabase();
            } catch (e) {}

            // Route to start screen after logout
            router.replace('/(auth)/start');
          }
        }
      ]
    );
  };


  const MenuItem = ({
    icon,
    iconColor,
    iconBg,
    text,
    badge = null,
    onPress,
    isDestructive = false,
    disabled = false,
    centered = false,
    showChevron = true,
    hideIcon = false,
    largeText = false,
  }) => {
    const isDark = colors.background !== '#FFFFFF' && colors.background !== '#ffffff';
    const activeIconColor = isDark ? '#FFFFFF' : '#000000';
    const activeIconBg = isDark ? '#333333' : '#F3F4F6';

    return (
      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: colors.card }, centered && styles.menuItemCentered, disabled && { opacity: 0.8 }]}
        onPress={disabled ? undefined : onPress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        {!hideIcon && (
          <View style={[styles.menuIconBox, { backgroundColor: activeIconBg }]}>
            <Icon name={icon} size={22} color={activeIconColor} />
          </View>
        )}
        <Text style={[styles.menuItemText, centered && styles.menuItemTextCentered, largeText && styles.menuItemTextLarge, { color: colors.text }]}>
          {text}
        </Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
        </View>
      )}
      {showChevron && !disabled && <Icon name="CaretRight" size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={{ height: SPACING.lg }} />

        {/* User Profile Card - Tappable to view full profile */}
        <TouchableOpacity
          onPress={() => {
            // user state is already loaded from WatermelonDB/Supabase — no network call needed
            if (user && (user as any).id) router.push({ pathname: '/profile/[id]', params: { id: (user as any).id } });
          }}
          activeOpacity={0.8}
        >
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.profileCard, { backgroundColor: colors.card }, { flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }]}
          >
            <View style={[styles.avatarContainer, { marginRight: 0 }]}>
              <View style={[styles.avatarBorder, { backgroundColor: colors.background }]}>
                <DefaultAvatar
                  uri={user && 'photoURL' in user ? user.photoURL : null}
                  name={user?.displayName}
                  size={80}
                  style={styles.avatar}
                />
              </View>
            </View>

            <Text style={[styles.viewProfileText, { color: colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000', marginTop: SPACING.sm }]}>
              View profile
            </Text>
          </MotiView>
        </TouchableOpacity>



        {/* General Section */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
          style={styles.menuSection}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>

          <MenuItem
            icon="PencilSimple"
            iconColor="#F59E0B"
            iconBg="#FEF3C7"
            text="Edit Profile"
            onPress={() => router.push('/profile/edit')}
          />
          <MenuItem
            icon="Gear"
            iconColor="#6B7280"
            iconBg="#F3F4F6"
            text="Settings"
            onPress={() => router.push('/profile/settings')}
          />
          <MenuItem
            icon="FileText"
            iconColor="#9d74f7"
            iconBg="#EDE9FE"
            text="Terms of Service"
            onPress={() => router.push('/profile/terms')}
          />
          <MenuItem
            icon="Lock"
            iconColor="#3B82F6"
            iconBg="#DBEAFE"
            text="Privacy Policy"
            onPress={() => router.push('/profile/privacy')}
          />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={styles.menuSection}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUPPORT</Text>

          <MenuItem
            icon="Lightbulb"
            iconColor="#F59E0B"
            iconBg="#FEF3C7"
            text="Suggest a Feature"
            onPress={() => router.push('/profile/suggest-feature')}
          />
          <MenuItem
            icon="Question"
            iconColor="#06B6D4"
            iconBg="#CFFAFE"
            text="Help & Support"
            onPress={() => router.push('/profile/help')}
          />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 300 }}
          style={styles.menuSection}
        >
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>

          <MenuItem
            icon="SignOut"
            iconColor="#EF4444"
            iconBg="#FEE2E2"
            text="Log Out"
            onPress={handleLogout}
            isDestructive
            centered
            showChevron={false}
            largeText
          />
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>NxtVibes v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </MotiView>

        <View style={{ height: SPACING.sm * 2 }} />
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
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },

  avatarBorder: {
    padding: 4,
    borderRadius: 50,
    elevation: 4,
    shadowColor: NEUTRAL.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },

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
  menuItemCentered: {
    justifyContent: 'center',
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
  menuItemTextCentered: { flex: 0, textAlign: 'center' },
  menuItemTextLarge: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.sm,
  },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: STATUS.success },

  versionText: { textAlign: 'center', marginTop: SPACING.md, fontSize: FONT_SIZE.xs },
});

export default ProfileScreen;
