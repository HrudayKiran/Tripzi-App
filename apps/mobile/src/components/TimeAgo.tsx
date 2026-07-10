import React, { useState, useEffect, memo } from 'react';
import { Text, TextStyle } from 'react-native';

interface TimeAgoProps {
    timestamp: Date | { toDate: () => Date } | { seconds: number } | null | undefined;
    style?: TextStyle;
    updateInterval?: number; // in milliseconds, default 60000 (1 minute)
}

/**
 * Format a date as a relative time string.
 */
function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

    // For older dates, show actual date
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
}

/**
 * Convert various timestamp formats to Date.
 */
function toDate(timestamp: TimeAgoProps['timestamp']): Date | null {
    if (!timestamp) return null;

    if (timestamp instanceof Date) {
        return timestamp;
    }

    if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }

    if (typeof timestamp === 'object' && 'seconds' in timestamp) {
        return new Date(timestamp.seconds * 1000);
    }

    return null;
}

/**
 * A component that displays relative time (e.g., "2m ago") and updates automatically.
 * Supports Firestore Timestamps, Date objects, and { seconds: number } objects.
 */
function TimeAgoComponent({ timestamp, style, updateInterval = 60000 }: TimeAgoProps) {
    const [timeAgo, setTimeAgo] = useState('');

    useEffect(() => {
        const date = toDate(timestamp);
        if (!date) {
            setTimeAgo('');
            return;
        }

        // Initial update
        setTimeAgo(formatTimeAgo(date));

        // Update periodically
        const interval = setInterval(() => {
            setTimeAgo(formatTimeAgo(date));
        }, updateInterval);

        return () => clearInterval(interval);
    }, [timestamp, updateInterval]);

    if (!timeAgo) return null;

    return <Text style={style}>{timeAgo}</Text>;
}

// Memoize to prevent unnecessary re-renders
export const TimeAgo = memo(TimeAgoComponent);

export default TimeAgo;
