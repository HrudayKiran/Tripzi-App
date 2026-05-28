import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import Icon from '../../src/components/Icon';
import AppLogo from '../../src/components/AppLogo';
import { NeumorphicIconButton } from '../../src/components/NeumorphicIconButtons';
import NotificationsModal from '../../src/components/NotificationsModal';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

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
            borderBottomColor: colors.border,
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

      <View style={styles.container}>
        {/* Welcome Section */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 100 }}
          style={styles.welcomeSection}
        >
          <Text style={[styles.appName, { color: colors.text }]}>
            Plan Your Journey ✈️
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Create manual itineraries or generate them instantly with AI
          </Text>
        </MotiView>

        {/* Content Area */}
        <View style={styles.optionsContainer}>
          {/* Manual Planning Option */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 150 }}
          >
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={() => handlePressOption('/trip/create')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#e0e7ff' }]}>
                <Icon name="PencilSimple" size={30} color="#6366f1" />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Manual Trip Planning
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Craft your own custom itinerary day-by-day and add stops manually
                </Text>
              </View>
              <View style={[styles.arrowBtn, { backgroundColor: colors.background }]}>
                <Icon name="CaretRight" size={18} color={colors.text} />
              </View>
            </TouchableOpacity>
          </MotiView>

          {/* AI Planning Option */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 250 }}
          >
            <TouchableOpacity
              style={[
                styles.optionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: isDarkMode ? '#000000' : '#8a9bba',
                },
              ]}
              onPress={() => handlePressOption('/trip/ai-planner')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#2e1065' : '#f3e8ff' }]}>
                <Icon name="Sparkle" size={30} color="#a855f7" />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  AI Trip Planning
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Let AI instantly draft a stunning itinerary and recommend places
                </Text>
              </View>
              <View style={[styles.arrowBtn, { backgroundColor: colors.background }]}>
                <Icon name="CaretRight" size={18} color={colors.text} />
              </View>
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Decorative Quote */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ type: 'timing', duration: 800, delay: 350 }}
          style={styles.footer}
        >
          <Text style={[styles.quoteText, { color: colors.textSecondary }]}>
            “Travel is the only thing you buy that makes you richer.”
          </Text>
        </MotiView>
      </View>

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
    paddingVertical: 14,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 18,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
    paddingRight: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
