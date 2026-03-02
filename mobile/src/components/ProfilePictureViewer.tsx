import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { deleteFromStorage } from '../utils/imageUpload';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';

const { width, height } = Dimensions.get('window');

interface ProfilePictureViewerProps {
    visible: boolean;
    imageUrl: string | null;
    userName?: string;
    isOwnProfile?: boolean;
    onClose: () => void;
    onDeleted?: () => void;
}

const ProfilePictureViewer = ({
    visible,
    imageUrl,
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
            // 1. Delete from Firebase Storage (if it's a storage URL)
            if (imageUrl.includes('firebasestorage')) {
                try {
                    await deleteFromStorage(imageUrl);
                } catch (e) {

                }
            }

            // 2. Always update Firestore to remove URL
            const userId = auth().currentUser?.uid;
            if (userId) {
                await firestore().collection('users').doc(userId).update({
                    photoURL: null,
                });

                // Keep Firebase Auth profile in sync so no stale fallback avatar remains.
                try {
                    await auth().currentUser?.updateProfile({ photoURL: null });
                } catch (e) {

                }
            }

            onDeleted?.();
            onClose();
            Alert.alert('Success', 'Profile picture removed.');
            return; // Exit early as we manually handled success

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
                        <Ionicons name="close" size={28} color="#fff" />
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
                                <Ionicons name="trash-outline" size={24} color="#EF4444" />
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
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[styles.placeholder, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="person" size={120} color={colors.primary} />
                            <Text style={[styles.noImageText, { color: colors.textSecondary }]}>
                                No profile picture
                            </Text>
                        </View>
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
