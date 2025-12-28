import React from 'react';
import { TouchableOpacity, StyleSheet, Animated, ViewStyle } from 'react-native';
import { TOUCH_TARGET, ANIMATION } from '../styles/constants';

type AnimatedButtonProps = {
    onPress: () => void;
    style?: ViewStyle;
    children: React.ReactNode;
    disabled?: boolean;
    activeOpacity?: number;
};

const AnimatedButton = ({ onPress, style, children, disabled = false, activeOpacity = 0.9 }: AnimatedButtonProps) => {
    const scaleAnim = new Animated.Value(1);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={activeOpacity}
            disabled={disabled}
            style={styles.touchable}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    touchable: {
        minHeight: TOUCH_TARGET.min,
    },
});

export default AnimatedButton;
