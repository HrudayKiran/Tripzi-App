import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';
import CropModal from './CropModal';
import CustomMediaPickerModal from './CustomMediaPickerModal';

interface ImagePreviewModalProps {
    visible: boolean;
    initialImages: string[];
    onClose: () => void;
    onSend: (images: string[]) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    visible,
    initialImages,
    onClose,
    onSend,
}) => {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [images, setImages] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [pickerModalVisible, setPickerModalVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            setImages(initialImages);
            setActiveIndex(0);
        }
    }, [visible, initialImages]);

    const activeImage = images[activeIndex] || null;

    const handleDeleteActive = (index: number) => {
        if (images.length <= 1) {
            // If deleting the last image, close the preview
            onClose();
            return;
        }
        const updated = images.filter((_, idx) => idx !== index);
        setImages(updated);
        setActiveIndex(Math.min(activeIndex, updated.length - 1));
    };

    const handleCropCompleted = (croppedUri: string) => {
        const updated = [...images];
        updated[activeIndex] = croppedUri;
        setImages(updated);
        setCropModalVisible(false);
    };

    const handleAddMoreImages = (newUris: string[]) => {
        setImages((prev) => [...prev, ...newUris]);
    };

    const handleSend = () => {
        if (images.length === 0) return;
        onSend(images);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top > 0 ? 0 : 10 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <Icon name="X" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {activeIndex + 1} of {images.length}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setCropModalVisible(true)}
                        style={styles.headerBtn}
                        disabled={!activeImage}
                    >
                        <Icon name="Crop" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Main Active Image View */}
                <View style={styles.mainPreviewContainer}>
                    {activeImage ? (
                        <Image source={{ uri: activeImage }} style={styles.mainImage} resizeMode="contain" />
                    ) : (
                        <Text style={styles.errorText}>No image selected</Text>
                    )}
                </View>

                {/* Footer Thumbnail list + actions */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
                    {/* Horizontal strip */}
                    <View style={styles.stripContainer}>
                        <FlatList
                            horizontal
                            data={images}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.thumbnailList}
                            renderItem={({ item, index }) => {
                                const isActive = index === activeIndex;
                                return (
                                    <View style={styles.thumbnailWrapper}>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => setActiveIndex(index)}
                                            style={[
                                                styles.thumbnailTouch,
                                                isActive && { borderColor: colors.primary, borderWidth: 2.5 },
                                            ]}
                                        >
                                            <Image source={{ uri: item }} style={styles.thumbnailImage} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteBadge}
                                            onPress={() => handleDeleteActive(index)}
                                        >
                                            <View style={styles.deleteBadgeInner}>
                                                <Icon name="X" size={10} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                            ListFooterComponent={
                                <TouchableOpacity
                                    style={[styles.addButton, { borderColor: 'rgba(255,255,255,0.3)' }]}
                                    onPress={() => setPickerModalVisible(true)}
                                >
                                    <Icon name="Plus" size={24} color="#fff" />
                                </TouchableOpacity>
                            }
                        />
                    </View>

                    {/* Actions Row */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleSend}>
                            <Text style={styles.sendText}>Send</Text>
                            <Icon name="PaperPlaneRight" size={16} color="#fff" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Crop Modal */}
                {activeImage && (
                    <CropModal
                        visible={cropModalVisible}
                        imageUri={activeImage}
                        onClose={() => setCropModalVisible(false)}
                        onCropCompleted={handleCropCompleted}
                    />
                )}

                {/* Nested Custom Media Picker for adding more */}
                <CustomMediaPickerModal
                    visible={pickerModalVisible}
                    onClose={() => setPickerModalVisible(false)}
                    onConfirmSelection={handleAddMoreImages}
                />
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    headerBtn: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    mainPreviewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    errorText: {
        color: '#fff',
        fontSize: 16,
    },
    footer: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingTop: 15,
    },
    stripContainer: {
        height: 85,
        marginBottom: 15,
    },
    thumbnailList: {
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 12,
    },
    thumbnailWrapper: {
        position: 'relative',
        width: 60,
        height: 60,
    },
    thumbnailTouch: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    deleteBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        zIndex: 10,
        padding: 4,
    },
    deleteBadgeInner: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fff',
    },
    addButton: {
        width: 60,
        height: 60,
        borderRadius: 8,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 16,
        gap: 12,
    },
    btn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 25,
    },
    cancelBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    cancelText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    sendText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});

export default ImagePreviewModal;
