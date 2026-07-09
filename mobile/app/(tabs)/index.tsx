import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import Icon from '../../src/components/Icon';
import AppLogo from '../../src/components/AppLogo';
import { NeumorphicIconButton } from '../../src/components/NeumorphicIconButtons';
import NotificationsModal from '../../src/components/NotificationsModal';
import { useNotificationStore } from '../../src/store/notificationStore';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';



export default function HomeRoute() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const handlePressOption = async (route: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Ignore haptics fail
    }
    router.push(route as any);
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

        {/* Core Actions Grid (Manual Option Only) */}
        <View style={styles.gridContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
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
              <View style={styles.gridCardLeft}>
                <View style={[styles.gridIconContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#e0e7ff' }]}>
                  <Icon name="PencilSimple" size={26} color="#6366f1" />
                </View>
                <View style={styles.gridTextContainer}>
                  <Text style={[styles.gridTitle, { color: colors.text }]}>Manual Trip Planner</Text>
                  <Text style={[styles.gridDesc, { color: colors.textSecondary }]}>
                    Build your custom itinerary day-by-day with travel style, budget, and buddies
                  </Text>
                </View>
              </View>
              <View style={[styles.gridArrow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
                <Icon name="CaretRight" size={16} color={colors.text} />
              </View>
            </TouchableOpacity>
          </MotiView>
        </View>

      </ScrollView>

      {/* Interactive Local Notifications Modal */}
      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
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
    paddingBottom: 110,
  },
  welcomeSection: {
    marginBottom: 24,
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
  gridContainer: {
    flexDirection: 'row',
  },
  gridItem: {
    flex: 1,
  },
  gridCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  gridCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    paddingRight: 12,
  },
  gridIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTextContainer: {
    flex: 1,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  gridArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
