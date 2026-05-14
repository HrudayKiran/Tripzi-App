import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../styles';
import { TextSkeleton, AvatarSkeleton, ImageSkeleton } from './Skeletons';

const { width } = Dimensions.get('window');

export const TripCardSkeleton = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={styles.header}>
        <AvatarSkeleton size={38} />
        <View style={styles.headerText}>
          <TextSkeleton width={120} height={14} />
          <View style={{ height: 4 }} />
          <TextSkeleton width={60} height={10} />
        </View>
        <TextSkeleton width={60} height={30} borderRadius={15} style={styles.headerButton} />
      </View>

      {/* Image */}
      <ImageSkeleton width={width} height={width * (4 / 5)} />

      {/* Content */}
      <View style={styles.content}>
        <TextSkeleton width={200} height={18} style={styles.mb8} />
        <View style={styles.row}>
          <AvatarSkeleton size={16} />
          <View style={{ width: 4 }} />
          <TextSkeleton width={150} height={14} />
        </View>
        <View style={{ height: 12 }} />
        <TextSkeleton width={width - 40} height={14} style={styles.mb4} />
        <TextSkeleton width={width - 80} height={14} />
      </View>

      {/* Details Row */}
      <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.detailItem}>
            <AvatarSkeleton size={24} />
            <View style={{ height: 4 }} />
            <TextSkeleton width={40} height={10} />
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
