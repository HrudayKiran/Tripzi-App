import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Text } from 'react-native';

interface CustomToggleProps {
    value: boolean;
    onValueChange: () => void;
    disabled?: boolean;
    onLabel?: string;
    offLabel?: string;
    size?: 'small' | 'medium' | 'large';
}

const CustomToggle = ({
    value,
    onValueChange,
    disabled = false,
    onLabel = 'Trip Joined',
    offLabel = 'Join Trip',
    size = 'medium',
}: CustomToggleProps) => {
    const translateX = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(translateX, {
            toValue: value ? 1 : 0,
            useNativeDriver: true,
            friction: 8,
            tension: 100,
        }).start();
    }, [value]);

    const dimensions = {
        small: { width: 40, height: 22, thumbSize: 18, thumbOffset: 2 },
        medium: { width: 46, height: 26, thumbSize: 22, thumbOffset: 2 },
        large: { width: 52, height: 28, thumbSize: 24, thumbOffset: 2 },
    };

    const dim = dimensions[size];
    const thumbTravel = dim.width - dim.thumbSize - dim.thumbOffset * 2;

    const thumbTranslate = translateX.interpolate({
        inputRange: [0, 1],
        outputRange: [dim.thumbOffset, dim.thumbOffset + thumbTravel],
    });

    const backgroundColor = translateX.interpolate({
        inputRange: [0, 1],
        outputRange: ['#E5E7EB', '#10B981'],
    });

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: value ? '#10B981' : '#6B7280' }]}>
                {value ? onLabel : offLabel}
            </Text>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onValueChange}
                disabled={disabled}
                style={{ opacity: disabled ? 0.5 : 1 }}
            >
                <Animated.View
                    style={[
                        styles.track,
                        {
                            width: dim.width,
                            height: dim.height,
                            borderRadius: dim.height / 2,
                            backgroundColor,
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.thumb,
                            {
                                width: dim.thumbSize,
                                height: dim.thumbSize,
                                borderRadius: dim.thumbSize / 2,
                                transform: [{ translateX: thumbTranslate }],
                            },
                        ]}
                    />
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    track: {
        justifyContent: 'center',
    },
    thumb: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});

export default CustomToggle;
