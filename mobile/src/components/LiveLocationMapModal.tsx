import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { formatDistanceToNow } from 'date-fns';

interface LiveLocationMapModalProps {
    visible: boolean;
    onClose: () => void;
    chatId: string;
    currentUser: any;
}

const { width, height } = Dimensions.get('window');

const LiveLocationMapModal = ({ visible, onClose, chatId, currentUser }: LiveLocationMapModalProps) => {
    const { colors } = useTheme();
    const [users, setUsers] = useState<any[]>([]);
    const [region, setRegion] = useState<any>(null);

    useEffect(() => {
        if (!visible || !chatId) return;

        const unsubscribe = firestore()
            .collection('chats')
            .doc(chatId)
            .collection('live_shares')
            .where('isActive', '==', true)
            .where('validUntil', '>', firestore.Timestamp.now())
            .onSnapshot(async (snapshot) => {
                const activeUsers: any[] = [];

                snapshot.forEach(doc => {
                    activeUsers.push({ id: doc.id, ...doc.data() });
                });

                // Fetch user details for markers if needed, or rely on stored profile info
                // For now assuming profile info is stored in live_share doc for performance
                // If not, we'd need to fetch user profiles. 
                // Let's assume the sharer stores { displayName, photoURL } in the doc.

                setUsers(activeUsers);

                // Focus map on first user or current user if available
                if (activeUsers.length > 0 && !region) {
                    setRegion({
                        latitude: activeUsers[0].latitude,
                        longitude: activeUsers[0].longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    });
                }
            });

        return () => unsubscribe();
    }, [visible, chatId]);

    const focusOnUser = (user: any) => {
        setRegion({
            latitude: user.latitude,
            longitude: user.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        });
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    region={region}
                    onRegionChangeComplete={setRegion}
                    showsUserLocation
                    showsMyLocationButton
                >
                    {users.map(user => (
                        <Marker
                            key={user.id}
                            coordinate={{ latitude: user.latitude, longitude: user.longitude }}
                            title={user.displayName}
                            description={`Updated ${user.timestamp ? formatDistanceToNow(user.timestamp.toDate()) : 'just now'} ago`}
                        >
                            <View style={styles.markerContainer}>
                                <Image
                                    source={{ uri: user.photoURL || 'https://via.placeholder.com/40' }}
                                    style={[styles.markerImage, { borderColor: user.id === currentUser?.uid ? colors.primary : '#fff' }]}
                                />
                                <View style={styles.markerArrow} />
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Live Locations</Text>
                </View>

                {/* User List Overlay */}
                <View style={[styles.userList, { backgroundColor: colors.card }]}>
                    <Text style={[styles.userListTitle, { color: colors.textSecondary }]}>Active Sharers ({users.length})</Text>
                    {users.length === 0 ? (
                        <Text style={{ padding: SPACING.md, color: colors.textSecondary }}>No one is sharing live location.</Text>
                    ) : (
                        users.map(user => (
                            <TouchableOpacity
                                key={user.id}
                                style={styles.userRow}
                                onPress={() => focusOnUser(user)}
                            >
                                <Image source={{ uri: user.photoURL }} style={styles.listAvatar} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.userName, { color: colors.text }]}>
                                        {user.id === currentUser?.uid ? 'You' : user.displayName}
                                    </Text>
                                    <Text style={[styles.updatedText, { color: colors.textSecondary }]}>
                                        Last active: {user.timestamp ? formatDistanceToNow(user.timestamp.toDate()) : 'now'} ago
                                    </Text>
                                </View>
                                <Ionicons name="navigate-circle-outline" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { ...StyleSheet.absoluteFillObject },
    header: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    closeButton: {
        backgroundColor: '#fff',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: '#000',
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    markerContainer: { alignItems: 'center' },
    markerImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
    },
    markerArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#fff',
        transform: [{ rotate: '180deg' }],
        marginTop: -2,
    },
    userList: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        elevation: 10,
        maxHeight: 200,
    },
    userListTitle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    listAvatar: { width: 32, height: 32, borderRadius: 16 },
    userName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
    updatedText: { fontSize: 10 },
});

export default LiveLocationMapModal;
