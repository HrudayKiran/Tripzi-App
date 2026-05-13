import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../styles';

const { width } = Dimensions.get('window');

const SkeletonItem = ({ width, height, borderRadius = 4, style = {} }: any) => {
  const { colors } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: 0.7 }}
      transition={{
        type: 'timing',
        duration: 1000,
        loop: true,
      }}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.background !== '#FFFFFF' ? '#2A2A2A' : '#E0E0E0',
        },
        style,
      ]}
    />
  );
};

export const TripCardSkeleton = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonItem width={38} height={38} borderRadius={19} />
        <View style={styles.headerText}>
          <SkeletonItem width={120} height={14} borderRadius={4} />
          <View style={{ height: 4 }} />
          <SkeletonItem width={60} height={10} borderRadius={3} />
        </View>
        <SkeletonItem width={60} height={30} borderRadius={15} style={styles.headerButton} />
      </View>

      {/* Image */}
      <SkeletonItem width={width} height={width * (4 / 5)} borderRadius={0} />

      {/* Content */}
      <View style={styles.content}>
        <SkeletonItem width={200} height={18} borderRadius={4} style={styles.mb8} />
        <View style={styles.row}>
          <SkeletonItem width={16} height={16} borderRadius={8} />
          <View style={{ width: 4 }} />
          <SkeletonItem width={150} height={14} borderRadius={4} />
        </View>
        <View style={{ height: 12 }} />
        <SkeletonItem width={width - 40} height={14} borderRadius={4} style={styles.mb4} />
        <SkeletonItem width={width - 80} height={14} borderRadius={4} />
      </View>

      {/* Details Row */}
      <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.detailItem}>
            <SkeletonItem width={24} height={24} borderRadius={12} />
            <View style={{ height: 4 }} />
            <SkeletonItem width={40} height={10} borderRadius={3} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  headerText: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  headerButton: {
    marginLeft: 'auto',
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mb4: {
    marginBottom: 4,
  },
  mb8: {
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
  },
  detailItem: {
    alignItems: 'center',
  },
});

export default TripCardSkeleton;
