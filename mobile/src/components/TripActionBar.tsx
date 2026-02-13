/**
 * TripActionBar - Reusable action bar for trips
 * Contains: Join button only (v1.0.0)
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

interface TripActionBarProps {
    tripId: string;
    tripOwnerId: string;
    hasJoined: boolean;
    spotsLeft: number;
    onJoinToggle: () => void;
    showJoinButton?: boolean;
    compact?: boolean;
}

const TripActionBar: React.FC<TripActionBarProps> = memo(({
    tripId,
    tripOwnerId,
    hasJoined,
    spotsLeft,
    onJoinToggle,
    showJoinButton = true,
    compact = false,
}) => {
    const { colors } = useTheme();
    const currentUser = auth().currentUser;
    const isOwnTrip = currentUser?.uid === tripOwnerId;

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            {/* Join Button */}
            {showJoinButton && !isOwnTrip && (
                <TouchableOpacity
                    style={[
                        styles.joinButton,
                        {
                            backgroundColor: hasJoined ? 'transparent' : colors.primary,
                            borderColor: colors.primary,
                        },
                        spotsLeft <= 0 && !hasJoined && styles.joinButtonDisabled,
                    ]}
                    onPress={onJoinToggle}
                    disabled={spotsLeft <= 0 && !hasJoined}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={hasJoined ? 'checkmark-circle' : 'add-circle-outline'}
                        size={16}
                        color={hasJoined ? colors.primary : '#fff'}
                    />
                    <Text
                        style={[
                            styles.joinButtonText,
                            { color: hasJoined ? colors.primary : '#fff' },
                        ]}
                    >
                        {hasJoined ? 'Joined' : spotsLeft <= 0 ? 'Full' : 'Join'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    containerCompact: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        gap: SPACING.xs,
    },
    joinButtonDisabled: {
        opacity: 0.5,
    },
    joinButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default TripActionBar;
