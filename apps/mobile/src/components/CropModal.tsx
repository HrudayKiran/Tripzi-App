import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImageManipulator from 'expo-image-manipulator';
import Icon from './Icon';

interface CropModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
    onCropCompleted: (croppedUri: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_BOX_SIZE = 280;

export const CropModal: React.FC<CropModalProps> = ({
    visible,
    imageUri,
    onClose,
    onCropCompleted,
}) => {
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [currentUri, setCurrentUri] = useState<string | null>(null);

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    useEffect(() => {
        if (visible && imageUri) {
            setCurrentUri(imageUri);
            setProcessing(true);
            ImageManipulator.manipulateAsync(imageUri, [])
                .then((res) => {
                    setImageSize({ width: res.width, height: res.height });
                })
                .catch(() => {
                    Alert.alert('Error', 'Failed to load image size.');
                    onClose();
                })
                .finally(() => {
                    setProcessing(false);
                });
        } else {
            setImageSize(null);
            setCurrentUri(null);
        }
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    }, [visible, imageUri]);

    // Calculate base dimensions scaled to cover the crop box (fill aspect ratio)
    let baseW = CROP_BOX_SIZE;
    let baseH = CROP_BOX_SIZE;
    if (imageSize) {
        const ratio = imageSize.width / imageSize.height;
        if (imageSize.width > imageSize.height) {
            baseH = CROP_BOX_SIZE;
            baseW = CROP_BOX_SIZE * ratio;
        } else {
            baseW = CROP_BOX_SIZE;
            baseH = CROP_BOX_SIZE / ratio;
        }
    }

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 5));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            // Bound check translations after scale change
            const maxTx = (baseW * scale.value - CROP_BOX_SIZE) / 2;
            const maxTy = (baseH * scale.value - CROP_BOX_SIZE) / 2;
            translateX.value = withTiming(Math.min(Math.max(translateX.value, -maxTx), maxTx));
            translateY.value = withTiming(Math.min(Math.max(translateY.value, -maxTy), maxTy));
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            const maxTx = (baseW * scale.value - CROP_BOX_SIZE) / 2;
            const maxTy = (baseH * scale.value - CROP_BOX_SIZE) / 2;
            translateX.value = Math.min(Math.max(savedTranslateX.value + event.translationX, -maxTx), maxTx);
            translateY.value = Math.min(Math.max(savedTranslateY.value + event.translationY, -maxTy), maxTy);
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value },
            ] as any,
        };
    });

    const handleRotate = async () => {
        if (!currentUri || !imageSize) return;
        setProcessing(true);
        try {
            const result = await ImageManipulator.manipulateAsync(
                currentUri,
                [{ rotate: 90 }],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            setCurrentUri(result.uri);
            setImageSize({ width: result.height, height: result.width }); // Swapped for 90deg rotation
            scale.value = 1;
            savedScale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
        } catch (e) {
            Alert.alert('Error', 'Failed to rotate image.');
        } finally {
            setProcessing(false);
        }
    };

    const handleCrop = async () => {
        if (!currentUri || !imageSize) return;
        setProcessing(true);

        const currentScale = scale.value;
        const currentTx = translateX.value;
        const currentTy = translateY.value;

        // Calculate offset relative to the scaled image
        const offsetLeft = (baseW * currentScale - CROP_BOX_SIZE) / 2 - currentTx;
        const offsetTop = (baseH * currentScale - CROP_BOX_SIZE) / 2 - currentTy;

        // Map relative offset to original image coordinates
        const originX = (offsetLeft / (baseW * currentScale)) * imageSize.width;
        const originY = (offsetTop / (baseH * currentScale)) * imageSize.height;
        const width = (CROP_BOX_SIZE / (baseW * currentScale)) * imageSize.width;
        const height = (CROP_BOX_SIZE / (baseH * currentScale)) * imageSize.height;

        try {
            const result = await ImageManipulator.manipulateAsync(
                currentUri,
                [{ crop: { originX, originY, width, height } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            onCropCompleted(result.uri);
        } catch (e) {
            Alert.alert('Error', 'Failed to crop image.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <GestureHandlerRootView style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <Icon name="X" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Edit Photo</Text>
                    <TouchableOpacity onPress={handleRotate} style={styles.headerBtn} disabled={processing}>
                        <Icon name="ArrowClockwise" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.cropContainer}>
                    {currentUri && imageSize ? (
                        <View style={styles.cropViewport}>
                            <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
                                <Reanimated.Image
                                    source={{ uri: currentUri }}
                                    style={[
                                        styles.cropImage,
                                        { width: baseW, height: baseH },
                                        animatedStyle,
                                    ] as any}
                                    resizeMode="cover"
                                />
                            </GestureDetector>
                            {/* Crop bounds border mask overlay */}
                            <View style={styles.cropFrameBorder} pointerEvents="none" />
                        </View>
                    ) : (
                        <ActivityIndicator size="large" color="#fff" />
                    )}
                </View>

                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructions}>Drag or pinch to adjust image within frame</Text>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={onClose} style={[styles.btn, styles.cancelBtn]} disabled={processing}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCrop} style={[styles.btn, styles.doneBtn]} disabled={processing || !imageSize}>
                        {processing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.doneText}>Done</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    headerBtn: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cropContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cropViewport: {
        width: CROP_BOX_SIZE,
        height: CROP_BOX_SIZE,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    cropImage: {
        position: 'absolute',
    },
    cropFrameBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 1,
        backgroundColor: 'transparent',
    },
    instructionsContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    instructions: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    btn: {
        paddingVertical: 13,
        paddingHorizontal: 36,
        borderRadius: 25,
        minWidth: 120,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    doneBtn: {
        backgroundColor: '#9d74f7', // Matching colors.primary
    },
    cancelText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    doneText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default CropModal;
