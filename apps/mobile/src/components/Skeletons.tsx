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

export const ChatItemSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.chatItemSkeleton, { backgroundColor: colors.card }]}>
      <AvatarSkeleton size={52} style={{ marginRight: SPACING.md }} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs }}>
          <TextSkeleton width={120} height={16} />
          <TextSkeleton width={40} height={12} />
        </View>
        <TextSkeleton width={200} height={14} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const ChatsListSkeleton = () => {
  return (
    <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
      <ChatItemSkeleton />
      <ChatItemSkeleton />
      <ChatItemSkeleton />
      <ChatItemSkeleton />
      <ChatItemSkeleton />
      <ChatItemSkeleton />
    </View>
  );
};

export const UserSearchSkeleton = () => {
  const { colors } = useTheme();
  const isDark = colors.background !== '#FFFFFF';
  return (
    <View style={[styles.searchResultSkeleton, { backgroundColor: colors.card }]}>
      <AvatarSkeleton size={48} style={{ marginRight: SPACING.md }} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <TextSkeleton width={140} height={16} style={{ marginBottom: 6 }} />
        <TextSkeleton width={80} height={12} />
      </View>
      <Shimmer
        style={{ width: 20, height: 20, borderRadius: 10 }}
        shimmerColors={getShimmerColors(isDark)}
      />
    </View>
  );
};

export const UserSearchListSkeleton = () => {
  return (
    <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
      <UserSearchSkeleton />
      <UserSearchSkeleton />
      <UserSearchSkeleton />
      <UserSearchSkeleton />
      <UserSearchSkeleton />
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
  chatItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  searchResultSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
});
