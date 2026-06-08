import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import Icon from '../../src/components/Icon';
import AppLogo from '../../src/components/AppLogo';
import { NeumorphicIconButton } from '../../src/components/NeumorphicIconButtons';
import NotificationsModal from '../../src/components/NotificationsModal';
import DefaultAvatar from '../../src/components/DefaultAvatar';
import { MotiView, MotiText } from 'moti';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// High-quality Royal Enfield motorcycle trip in the mountains representing Ladakh
const LADAKH_IMAGE = require('../../assets/ladakh_bike_trip.png');

// High-fidelity mock avatars of travel buddies
const MOCK_AVATAR_AARAV = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&q=80';
const MOCK_AVATAR_ROHAN = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80';
const MOCK_AVATAR_PRIYA = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80';
const MOCK_AVATAR_ARJUN = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&q=80';

export default function HomeRoute() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const handlePressOption = async (route: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Ignore haptics fail
    }
    router.push(route as any);
  };

  const handleDummyPress = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
      // Ignore haptics fail
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Brand Header */}
      <MotiView
        from={{ opacity: 0, translateY: -15 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={[
          styles.headerRow,
          {
            backgroundColor: colors.background,
          }
        ]}
      >
        <View style={styles.headerLeft}>
          <AppLogo size={36} showDot={false} />
          <Text style={[styles.brandText, { color: colors.text }]}>
            NxtVibes
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.notificationWrapper}>
            <NeumorphicIconButton
              iconName="Bell"
              iconWeight="bold"
              size={44}
              iconSize={22}
              onPress={() => setShowNotifications(true)}
            />
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </MotiView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Section */}
        <MotiView
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.welcomeSection}
        >
          <Text style={[styles.title, { color: colors.text }]}>Plan Your Journey ✈️</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Connect with friends, start group chats, and map out your next adventure
          </Text>
        </MotiView>

        {/* Mock Active Trip Card (Ladakh Bike Trip) */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 100 }}
        >
          <TouchableOpacity
            style={[styles.tripCard, { shadowColor: isDarkMode ? '#000000' : '#8a9bba' }]}
            onPress={handleDummyPress}
            activeOpacity={0.9}
          >
            <Image
              source={LADAKH_IMAGE}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.tripCardContent}>
              <View style={styles.tripCardHeader}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>ONGOING TRIP</Text>
                </View>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateText}>15 - 22 Jun</Text>
                </View>
              </View>

              <View style={styles.tripCardFooter}>
                <View style={styles.tripCardLeft}>
                  <Text style={styles.tripTitle}>Biking to Ladakh 🏔️🏍️</Text>
                  <Text style={styles.tripSubtitle}>Manali - Leh Highway</Text>

                  {/* Custom Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: '38%' }]} />
                    </View>
                    <Text style={styles.progressText}>Day 3 of 8 (Keylong stopover)</Text>
                  </View>
                </View>

                {/* Overlapping Collaborators */}
                <View style={styles.collaboratorsContainer}>
                  <View style={styles.avatarStack}>
                    <View style={[styles.stackAvatarWrapper, { zIndex: 3 }]}>
                      <DefaultAvatar uri={MOCK_AVATAR_AARAV} name="Aarav" size={26} />
                    </View>
                    <View style={[styles.stackAvatarWrapper, { zIndex: 2, marginLeft: -10 }]}>
                      <DefaultAvatar uri={MOCK_AVATAR_ROHAN} name="Rohan" size={26} />
                    </View>
                    <View style={[styles.stackAvatarWrapper, { zIndex: 1, marginLeft: -10 }]}>
                      <DefaultAvatar uri={MOCK_AVATAR_PRIYA} name="Priya" size={26} />
                    </View>
                  </View>
                  <Text style={styles.collaboratorCount}>+3 going</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </MotiView>

        {/* Section Title: Planning */}
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 200 }}
          style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
        >
          Trip Planning Tools
        </MotiText>

        {/* Core Actions Grid (Manual & AI Planning Options) */}
        <View style={styles.gridContainer}>
          {/* Manual Planning Option */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 250 }}
            style={styles.gridItem}
          >
            <TouchableOpacity
              style={[
                styles.gridCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={() => handlePressOption('/trip/create')}
              activeOpacity={0.8}
            >
              <View style={[styles.gridIconContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#e0e7ff' }]}>
                <Icon name="PencilSimple" size={26} color="#6366f1" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>Manual Trip</Text>
              <Text style={[styles.gridDesc, { color: colors.textSecondary }]}>
                Build your own itinerary custom day-by-day
              </Text>
              <View style={[styles.gridArrow, { backgroundColor: colors.background }]}>
                <Icon name="CaretRight" size={14} color={colors.text} />
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* AI Planning Option */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 300 }}
            style={styles.gridItem}
          >
            <TouchableOpacity
              style={[
                styles.gridCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={handleDummyPress}
              activeOpacity={0.8}
            >
              <View style={styles.betaBadge}>
                <Text style={styles.betaText}>AI BETA</Text>
              </View>
              <View style={[styles.gridIconContainer, { backgroundColor: isDarkMode ? '#2e1065' : '#f3e8ff' }]}>
                <Icon name="Sparkle" size={26} color="#a855f7" />
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]}>AI Planner</Text>
              <Text style={[styles.gridDesc, { color: colors.textSecondary }]}>
                Draft full itinerary recommended by AI
              </Text>
              <View style={[styles.gridArrow, { backgroundColor: colors.background }]}>
                <Icon name="CaretRight" size={14} color={colors.text} />
              </View>
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Section Title: Recent Chats */}
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 400, delay: 350 }}
          style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
        >
          Recent Trip Chats
        </MotiText>

        {/* Mock Recent Chats list */}
        <View style={styles.chatsContainer}>
          {/* Chat 1: Group Chat (Ladakh Riders Group) */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 400 }}
          >
            <TouchableOpacity
              style={[
                styles.chatItemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={handleDummyPress}
              activeOpacity={0.8}
            >
              <View style={styles.groupAvatarContainer}>
                <View style={[styles.groupAvatarItem, { zIndex: 2 }]}>
                  <DefaultAvatar uri={MOCK_AVATAR_AARAV} name="Aarav" size={28} />
                </View>
                <View style={[styles.groupAvatarItem, { zIndex: 1, marginLeft: -12, marginTop: 12 }]}>
                  <DefaultAvatar uri={MOCK_AVATAR_ROHAN} name="Rohan" size={28} />
                </View>
              </View>

              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                    Ladakh Riders Group 🏔️
                  </Text>
                  <Text style={[styles.chatTime, { color: colors.textSecondary }]}>10m ago</Text>
                </View>
                <View style={styles.chatFooter}>
                  <Text style={[styles.chatMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                    Aarav: Aarav shared a live location...
                  </Text>
                  <View style={styles.unreadDot} />
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* Chat 2: Direct Chat (Arjun) */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 450 }}
          >
            <TouchableOpacity
              style={[
                styles.chatItemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={handleDummyPress}
              activeOpacity={0.8}
            >
              <DefaultAvatar uri={MOCK_AVATAR_ARJUN} name="Arjun" size={42} />

              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                    Arjun
                  </Text>
                  <Text style={[styles.chatTime, { color: colors.textSecondary }]}>2h ago</Text>
                </View>
                <View style={styles.chatFooter}>
                  <Text style={[styles.chatMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                    Arjun: Let's check the itinerary!
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Mock AI Suggestion Banner */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 500 }}
          style={{ marginTop: 24 }}
        >
          <View
            style={[
              styles.aiSuggestionCard,
              {
                backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.08)' : 'rgba(168, 85, 247, 0.05)',
                borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.12)',
              },
            ]}
          >
            <View style={styles.aiIconContainer}>
              <Icon name="Sparkle" size={20} color="#a855f7" weight="fill" />
            </View>
            <View style={styles.aiSuggestionTextContainer}>
              <Text style={styles.aiSuggestionTitle}>AI TRIP COMPANION</Text>
              <Text style={[styles.aiSuggestionText, { color: colors.text }]}>
                Sunset at Goa beaches is perfect today! 🌅🏖️
              </Text>
            </View>
          </View>
        </MotiView>
      </ScrollView>

      {/* Interactive Local Notifications Modal */}
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationsChange={(count) => setUnreadCount(count)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationWrapper: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110, // Generous padding to clear the floating tab bar
  },
  welcomeSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  tripCard: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  tripCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tripCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  tripTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  tripSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 12,
  },
  progressContainer: {
    gap: 5,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    width: '90%',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
  },
  collaboratorsContainer: {
    alignItems: 'center',
    gap: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatarWrapper: {
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#000',
    overflow: 'hidden',
  },
  collaboratorCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 14,
  },
  gridItem: {
    flex: 1,
  },
  gridCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    height: 144,
    justifyContent: 'space-between',
    position: 'relative',
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  betaBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  betaText: {
    color: '#a855f7',
    fontSize: 8,
    fontWeight: '800',
  },
  gridIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  gridDesc: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    flex: 1,
  },
  gridArrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatsContainer: {
    gap: 10,
  },
  chatItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  groupAvatarContainer: {
    width: 42,
    height: 42,
    position: 'relative',
    marginRight: 12,
  },
  groupAvatarItem: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#000',
    overflow: 'hidden',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
  chatTime: {
    fontSize: 10,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    fontSize: 11,
    flex: 1,
    paddingRight: 10,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  aiSuggestionCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  aiIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSuggestionTextContainer: {
    flex: 1,
  },
  aiSuggestionTitle: {
    color: '#a855f7',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  aiSuggestionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
