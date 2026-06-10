import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import Icon from '../../src/components/Icon';
import { View, TouchableOpacity, StyleSheet, Modal, Text } from 'react-native';
import { useState } from 'react';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { getBooleanPreferenceSync, PREFERENCE_KEYS } from '../../src/utils/preferences';

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  const triggerTabHaptics = () => {
    try {
      const hapticsEnabled = getBooleanPreferenceSync(PREFERENCE_KEYS.hapticsEnabled, true);
      const navHaptics = getBooleanPreferenceSync(PREFERENCE_KEYS.hapticsNav, true);
      
      if (hapticsEnabled && navHaptics) {
        Haptics.selectionAsync().catch(() => {});
      }
    } catch (e) {
      console.error('Failed to trigger haptics:', e);
    }
  };

  // Determine if we are in dark mode based on background color
  const isDark = colors.background !== '#FFFFFF' && colors.background !== '#ffffff';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false, // Hide labels for a premium look
          tabBarStyle: {
            position: 'absolute', // Make it absolute to float OVER content
            bottom: 20,
            left: 16,
            right: 16,
            backgroundColor: 'transparent',
            height: 64,
            borderRadius: 32, // Rounded edges at both ends
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            marginHorizontal: 16,
            elevation: 5,
            paddingTop: 0, // Remove padding to let itemStyle center them
            paddingBottom: 0,
          },
          tabBarItemStyle: {
            flexDirection: 'row',
            justifyContent: 'center', // Center icons horizontally
            alignItems: 'center', // Center icons vertically
          },
          tabBarBackground: () => (
            <View style={{
              flex: 1,
              borderRadius: 32, // Match the tabBarStyle border radius
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              backgroundColor: colors.card, // Solid background instead of glass
            }} />
          ),
          // Set colors as requested: black in light theme, white in dark theme
          tabBarActiveTintColor: isDark ? '#FFFFFF' : '#000000',
          tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="House" size={size + 2} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              triggerTabHaptics();
            },
          }}
        />
        <Tabs.Screen
          name="ai-planner"
          options={{
            title: 'AI Planner',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="Sparkle" size={size + 2} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              triggerTabHaptics();
            },
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="ChatTeardropText" size={size + 2} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              triggerTabHaptics();
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }: { color: string; size: number }) => <Icon name="User" size={size + 2} color={color} />,
          }}
          listeners={{
            tabPress: () => {
              triggerTabHaptics();
            },
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  createModalContent: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  createModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  createOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createOptionText: {
    flex: 1,
  },
  createOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  createOptionDesc: {
    fontSize: 12,
  },
});
