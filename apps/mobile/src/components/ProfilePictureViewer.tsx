import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,

    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Icon from '../components/Icon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { deleteProfileImageFromR2 } from '../utils/imageUpload';
import { supabase } from '../lib/supabase';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';

const { width, height } = Dimensions.get('window');

interface ProfilePictureViewerProps {
    visible: boolean;
    imageUrl: string | null;
    imageObjectKey?: string | null;
    userName?: string;
    isOwnProfile?: boolean;
    onClose: () => void;
    onDeleted?: () => void;
}

const ProfilePictureViewer = ({
    visible,
    imageUrl,
    imageObjectKey = null,
    userName = 'User',
    isOwnProfile = false,
    onClose,
    onDeleted,
}: ProfilePictureViewerProps) => {
    const { colors } = useTheme();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = () => {
        Alert.alert(
            'Delete Profile Picture',
            'Are you sure you want to remove your profile picture?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: confirmDelete,
                },
            ]
        );
    };

    const confirmDelete = async () => {
        if (!imageUrl) return;

        setIsDeleting(true);
        try {
            if (imageObjectKey) {
                await deleteProfileImageFromR2(imageObjectKey);
            }

            // Update Supabase profile to remove URL
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
                await supabase.from('profiles').update({
                    photo_url: null,
                    photo_object_key: null,
                }).eq('id', user.id);
            }

            onDeleted?.();
            onClose();
            Alert.alert('Success', 'Profile picture removed.');
            return;

        } catch (error) {
            Alert.alert('Error', 'Failed to delete image. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <SafeAreaView edges={['top']} style={styles.header}>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon name="X" size={28} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>{userName}</Text>

                    {isOwnProfile && imageUrl ? (
                        <TouchableOpacity
                            style={styles.headerBtn}
                            onPress={handleDelete}
                            disabled={isDeleting}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {isDeleting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Icon name="Trash" size={24} color="#EF4444" />
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerBtn} />
                    )}
                </SafeAreaView>

                {/* Image */}
                <View style={styles.imageContainer}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.fullImage}
                            contentFit="contain"
                            transition={200}
                        />
                    ) : (
                        <LinearGradient
                            colors={['#9d74f7', '#EC4899', '#F59E0B']}
                            style={styles.placeholder}
                        >

                            <Text style={[styles.noImageText, { color: colors.textSecondary }]}>
                                No profile picture
                            </Text>
                        </LinearGradient>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    headerBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        flex: 1,
        textAlign: 'center',
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: width,
        height: height * 0.7,
    },
    placeholder: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noImageText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
    },
});

export default ProfilePictureViewer;
