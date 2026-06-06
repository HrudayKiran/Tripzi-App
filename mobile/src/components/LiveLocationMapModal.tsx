import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { formatDistanceToNow } from 'date-fns';
import DefaultAvatar from './DefaultAvatar';

interface LiveLocationMapModalProps {
    visible: boolean;
    onClose: () => void;
    chatId: string;
    currentUser: any;
    collectionName?: 'chats' | 'group_chats' | 'direct_chats';
}

const DEFAULT_REGION = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 10,
    longitudeDelta: 10,
};

const LiveLocationMapModal = ({ visible, onClose, chatId, currentUser, collectionName = 'chats' }: LiveLocationMapModalProps) => {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [users, setUsers] = useState<any[]>([]);
    const mapRef = React.useRef<MapView>(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    useEffect(() => {
        if (!visible) {
            setHasAnimated(false);
            return;
        }
        if (!chatId) return;

        const loadShares = async () => {
            const { data } = await supabase
                .from('live_shares')
                .select(`
                    id, chat_id, chat_type, user_id, latitude, longitude, is_active, expires_at, updated_at, heading,
                    profiles:user_id (
                        name,
                        photo_url
                    )
                `)
                .eq('chat_id', chatId)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());

            const activeUsers = (data || [])
                .map((d: any) => ({
                    id: d.user_id,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    updated_at: d.updated_at,
                    displayName: d.profiles?.name || 'User',
                    photoURL: d.profiles?.photo_url || null,
                }))
                .filter(d => typeof d.latitude === 'number' && typeof d.longitude === 'number' && !(d.latitude === 0 && d.longitude === 0));

            setUsers(activeUsers);
            if (activeUsers.length > 0 && !hasAnimated) {
                mapRef.current?.animateToRegion({
                    latitude: activeUsers[0].latitude,
                    longitude: activeUsers[0].longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
                setHasAnimated(true);
            }
        };

        loadShares();
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const channelName = `live-loc-${chatId}-${randomSuffix}`;
        const channel = supabase.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_shares', filter: `chat_id=eq.${chatId}` }, () => { loadShares(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [visible, chatId, collectionName, hasAnimated]);

    const headerTop = Math.max(insets.top, 15) + 10;
    const mapPadding = {
        top: headerTop + 60,
        right: 15,
        bottom: Math.max(insets.bottom, 15) + 15,
        left: 15,
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation
                    showsMyLocationButton
                    mapPadding={mapPadding}
                >
                    {users.map(user => (
                        <Marker
                            key={user.id}
                            coordinate={{ latitude: user.latitude, longitude: user.longitude }}
                            title={user.displayName}
                            description={`Updated ${user.updated_at ? formatDistanceToNow(new Date(user.updated_at)) : 'just now'} ago`}
                        >
                            <View style={styles.markerContainer}>
                                <DefaultAvatar
                                    uri={user.photoURL}
                                    name={user.displayName}
                                    size={40}
                                    style={{
                                        ...styles.markerImage,
                                        borderColor: user.id === currentUser?.id ? colors.primary : '#fff',
                                        borderWidth: 2
                                    }}
                                />
                                <View style={styles.markerArrow} />
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {/* Header */}
                <View style={[styles.header, { top: headerTop }]}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Icon name="X" size={24} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000', backgroundColor: isDarkMode ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)' }]}>
                        Live Locations
                    </Text>
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
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        zIndex: 10,
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
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    markerContainer: { alignItems: 'center' },
    markerImage: {
        borderRadius: 20,
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
});

export default LiveLocationMapModal;

