import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, BORDER_RADIUS } from '../styles';
import { useTheme } from '../contexts/ThemeContext';

const Shimmer = createShimmerPlaceholder(LinearGradient);

const getShimmerColors = (isDark: boolean) => {
  return isDark
    ? ['#2A2A2A', '#3A3A3A', '#2A2A2A']
    : ['#EBEBEB', '#F5F5F5', '#EBEBEB'];
};

export const TextSkeleton = ({ width = 100, height = 15, borderRadius = 4, style = {} }: any) => {
  const { colors } = useTheme();
  const isDark = colors.background !== '#FFFFFF';
  return (
    <Shimmer
      style={[{ width, height, borderRadius, marginBottom: 4 }, style]}
      shimmerColors={getShimmerColors(isDark)}
    />
  );
};

export const AvatarSkeleton = ({ size = 40, style = {} }: any) => {
  const { colors } = useTheme();
  const isDark = colors.background !== '#FFFFFF';
  return (
    <Shimmer
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      shimmerColors={getShimmerColors(isDark)}
    />
  );
};

export const ImageSkeleton = ({ width = '100%', height = 200, borderRadius = 0, style = {} }: any) => {
  const { colors } = useTheme();
  const isDark = colors.background !== '#FFFFFF';
  return (
    <Shimmer
      style={[{ width, height, borderRadius }, style]}
      shimmerColors={getShimmerColors(isDark)}
    />
  );
};

export const ChatSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.chatContainer}>
      <View style={[styles.bubble, styles.leftBubble, { backgroundColor: colors.card }]}>
        <TextSkeleton width={150} height={15} />
      </View>
      <View style={[styles.bubble, styles.rightBubble, { backgroundColor: colors.card }]}>
        <TextSkeleton width={100} height={15} />
      </View>
      <View style={[styles.bubble, styles.leftBubble, { backgroundColor: colors.card }]}>
        <TextSkeleton width={200} height={15} />
        <TextSkeleton width={150} height={15} style={{ marginTop: 5 }} />
      </View>
      <View style={[styles.bubble, styles.rightBubble, { backgroundColor: colors.card }]}>
        <TextSkeleton width={120} height={15} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chatContainer: {
    padding: SPACING.md,
    flex: 1,
  },
  bubble: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    maxWidth: '80%',
  },
  leftBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  rightBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
});
