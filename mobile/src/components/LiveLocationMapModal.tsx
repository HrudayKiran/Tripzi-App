import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { formatDistanceToNow } from 'date-fns';
import DefaultAvatar from './DefaultAvatar';
import * as Location from 'expo-location';
import { database } from '../database';

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

// Marker with profile image that handles async image loading on Android
const UserMarker = ({ user }: { user: any }) => {
    const [tracksView, setTracksView] = useState(true);

    useEffect(() => {
        setTracksView(true);
        const timer = setTimeout(() => {
            setTracksView(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, [user.photoURL, user.id]);

    return (
        <Marker
            key={user.id}
            coordinate={{ latitude: user.latitude, longitude: user.longitude }}
            title={user.displayName}
            description={user.isActive 
                ? `Active • Updated ${user.updated_at ? formatDistanceToNow(new Date(user.updated_at)) : 'just now'} ago`
                : `Ended • ${user.updated_at ? formatDistanceToNow(new Date(user.updated_at)) : 'just now'} ago`
            }
            tracksViewChanges={tracksView}
        >
            <View style={styles.markerContainer}>
                <View style={styles.markerImageWrapper}>
                    <DefaultAvatar
                        uri={user.photoURL}
                        name={user.displayName}
                        size={40}
                        style={styles.markerImage}
                        useStandardImage={true}
                    />
                </View>
                <View style={styles.markerArrow} />
            </View>
        </Marker>
    );
};

const LiveLocationMapModal = ({ visible, onClose, chatId, currentUser, collectionName = 'chats' }: LiveLocationMapModalProps) => {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [users, setUsers] = useState<any[]>([]);
    const mapRef = useRef<MapView>(null);
    const [hasAnimated, setHasAnimated] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        if (!visible) return;
        const checkPermission = async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    setHasPermission(true);
                } else {
                    const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
                    setHasPermission(reqStatus === 'granted');
                }
            } catch (e) {
                console.warn('Error checking location permission:', e);
            }
        };
        checkPermission();
    }, [visible]);

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
                .order('updated_at', { ascending: false });

            const latestSharesMap = new Map<string, any>();
            (data || []).forEach((d: any) => {
                if (latestSharesMap.has(d.user_id)) return;
                latestSharesMap.set(d.user_id, d);
            });

            const activeUsersPromises = Array.from(latestSharesMap.values())
                .map(async (d: any) => {
                    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
                    const isActive = d.is_active && new Date(d.expires_at) > new Date();
                    
                    let name = profile?.name || 'User';
                    let photoURL = profile?.photo_url || null;

                    // Fallback 1: Current Auth User metadata
                    if (d.user_id === currentUser?.id) {
                        name = currentUser?.user_metadata?.full_name || name;
                        photoURL = currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.photoURL || photoURL;
                    }

                    // Fallback 2: Local WatermelonDB Profiles table lookup
                    if (!photoURL) {
                        try {
                            const localProf: any = await database.get('profiles').find(d.user_id);
                            if (localProf) {
                                name = localProf.name || name;
                                photoURL = localProf.photoUrl || photoURL;
                            }
                        } catch (e) {
                            // ignore local DB lookup errors
                        }
                    }

                    return {
                        id: d.user_id,
                        latitude: d.latitude,
                        longitude: d.longitude,
                        updated_at: d.updated_at,
                        displayName: name,
                        photoURL: photoURL,
                        isActive,
                    };
                });

            const resolvedUsers = await Promise.all(activeUsersPromises);
            const activeUsers = resolvedUsers.filter(d => typeof d.latitude === 'number' && typeof d.longitude === 'number' && !(d.latitude === 0 && d.longitude === 0));

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
    }, [visible, chatId, collectionName, hasAnimated, currentUser]);

    const handleMyLocation = async () => {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            mapRef.current?.animateToRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 500);
        } catch (e) {
            if (users.length > 0) {
                mapRef.current?.animateToRegion({
                    latitude: users[0].latitude,
                    longitude: users[0].longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 500);
            }
        }
    };

    const headerTop = Math.max(insets.top, 15) + 10;


    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={DEFAULT_REGION}
                    showsUserLocation={hasPermission}
                    showsMyLocationButton={Platform.OS === 'ios' && hasPermission}
                    mapPadding={{
                        top: headerTop + 20,
                        right: 15,
                        bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 15) + 20 : 15,
                        left: 15
                    }}
                >
                    {users.map(user => (
                        <UserMarker key={user.id} user={user} />
                    ))}
                </MapView>

                {/* Header — title on left, close on right */}
                <View style={[styles.header, { top: headerTop }]}>
                    <Text style={[styles.headerTitle, {
                        color: isDarkMode ? '#fff' : '#000',
                        backgroundColor: isDarkMode ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
                    }]}>
                        Live Location
                    </Text>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={[styles.closeButton, {
                            backgroundColor: isDarkMode ? 'rgba(40,40,40,0.9)' : 'rgba(255,255,255,0.95)',
                        }]}
                        onPress={onClose}
                    >
                        <Icon name="X" size={22} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>
                </View>

                {/* Custom My Location button for Android — positioned in the bottom right, styled like Google Maps native button */}
                {Platform.OS === 'android' && hasPermission && (
                    <TouchableOpacity
                        style={[styles.nativeMyLocationButton, {
                            bottom: Math.max(insets.bottom, 15) + 20,
                            backgroundColor: isDarkMode ? '#222222' : '#ffffff',
                        }]}
                        onPress={handleMyLocation}
                        activeOpacity={0.8}
                    >
                        <Icon 
                            name="Gps" 
                            size={22} 
                            color={isDarkMode ? '#ffffff' : '#5f6368'} 
                        />
                    </TouchableOpacity>
                )}

            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    map: { ...StyleSheet.absoluteFillObject },
    header: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    closeButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },

    markerContainer: {
        alignItems: 'center',
    },
    markerImageWrapper: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    markerImage: {
        borderRadius: 20,
    },
    nativeMyLocationButton: {
        position: 'absolute',
        right: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
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
