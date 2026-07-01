import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import Icon from './Icon';
import { useTheme } from '../contexts/ThemeContext';

interface CustomMediaPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirmSelection: (uris: string[]) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_SIZE = SCREEN_WIDTH / 3;

export const CustomMediaPickerModal: React.FC<CustomMediaPickerModalProps> = ({
    visible,
    onClose,
    onConfirmSelection,
}) => {
    const { colors, isDarkMode } = useTheme();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
    const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<MediaLibrary.Album | null>(null); // null means "Recents"
    const [selectedAssets, setSelectedAssets] = useState<MediaLibrary.Asset[]>([]);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);

    useEffect(() => {
        if (!visible) {
            setAssets([]);
            setSelectedAssets([]);
            setSelectedAlbum(null);
            setEndCursor(undefined);
            setHasNextPage(true);
            setShowAlbumDropdown(false);
            return;
        }
        checkPermissions();
    }, [visible]);

    const checkPermissions = async () => {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status === 'granted') {
            setHasPermission(true);
            loadAlbums();
            loadAssets(true, null);
        } else {
            const request = await MediaLibrary.requestPermissionsAsync();
            if (request.status === 'granted') {
                setHasPermission(true);
                loadAlbums();
                loadAssets(true, null);
            } else {
                setHasPermission(false);
                Alert.alert(
                    'Permission Denied',
                    'NxtVibes needs access to your gallery to pick images. Please grant permission in Settings.'
                );
                onClose();
            }
        }
    };

    const loadAlbums = async () => {
        try {
            const fetchedAlbums = await MediaLibrary.getAlbumsAsync({ includePhotosCount: true } as any);
            // Filter out empty albums
            const validAlbums = fetchedAlbums.filter((album) => album.assetCount > 0);
            setAlbums(validAlbums);
        } catch (e) {
            // Silently handle
        }
    };

    const loadAssets = async (reset = false, album: MediaLibrary.Album | null = null) => {
        if (loading) return;
        setLoading(true);

        try {
            const currentCursor = reset ? undefined : endCursor;
            const options: MediaLibrary.AssetsOptions = {
                first: 48,
                mediaType: 'photo',
                sortBy: ['creationTime'],
                after: currentCursor,
            };

            if (album) {
                options.album = album.id;
            }

            const result = await MediaLibrary.getAssetsAsync(options);
            setAssets((prev) => (reset ? result.assets : [...prev, ...result.assets]));
            setEndCursor(result.endCursor);
            setHasNextPage(result.hasNextPage);
        } catch (e) {
            Alert.alert('Error', 'Failed to load images.');
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        if (hasNextPage && !loading) {
            loadAssets(false, selectedAlbum);
        }
    };

    const handleSelectAlbum = (album: MediaLibrary.Album | null) => {
        setSelectedAlbum(album);
        setShowAlbumDropdown(false);
        setEndCursor(undefined);
        setHasNextPage(true);
        loadAssets(true, album);
    };

    const handleSelectAsset = (asset: MediaLibrary.Asset) => {
        const isSelected = selectedAssets.some((item) => item.id === asset.id);
        if (isSelected) {
            setSelectedAssets((prev) => prev.filter((item) => item.id !== asset.id));
        } else {
            setSelectedAssets((prev) => [...prev, asset]);
        }
    };

    const handleConfirm = () => {
        if (selectedAssets.length === 0) return;
        const uris = selectedAssets.map((asset) => asset.uri);
        onConfirmSelection(uris);
        onClose();
    };

    const getSelectionIndex = (assetId: string) => {
        return selectedAssets.findIndex((item) => item.id === assetId);
    };

    const renderAsset = ({ item }: { item: MediaLibrary.Asset }) => {
        const selectIndex = getSelectionIndex(item.id);
        const isSelected = selectIndex !== -1;

        return (
            <TouchableOpacity
                style={styles.assetWrapper}
                onPress={() => handleSelectAsset(item)}
                activeOpacity={0.8}
            >
                <Image source={{ uri: item.uri }} style={styles.assetImage} />
                {isSelected && (
                    <View style={[styles.selectionOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                        <View style={[styles.badgeContainer, { backgroundColor: colors.primary }]}>
                            <Text style={styles.badgeText}>{selectIndex + 1}</Text>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (hasPermission === false) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={[styles.container, { backgroundColor: isDarkMode ? '#111' : '#fff' }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: isDarkMode ? '#222' : '#eee' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Icon name="X" size={24} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.albumSelector}
                        onPress={() => setShowAlbumDropdown(!showAlbumDropdown)}
                    >
                        <Text style={[styles.albumTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                            {selectedAlbum ? selectedAlbum.title : 'Recents'}
                        </Text>
                        <Icon name={showAlbumDropdown ? 'CaretUp' : 'CaretDown'} size={14} color={isDarkMode ? '#fff' : '#000'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={selectedAssets.length === 0}
                        style={[
                            styles.doneBtn,
                            selectedAssets.length > 0 ? { opacity: 1 } : { opacity: 0.4 },
                        ]}
                    >
                        <Text style={[styles.doneBtnText, { color: colors.primary }]}>
                            Done ({selectedAssets.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Album Dropdown Selector */}
                {showAlbumDropdown && (
                    <View style={[styles.dropdown, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF', borderBottomColor: isDarkMode ? '#222' : '#eee' }]}>
                        <FlatList
                            data={[null, ...albums]}
                            keyExtractor={(item) => (item ? item.id : 'recents')}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.dropdownItem}
                                    onPress={() => handleSelectAlbum(item)}
                                >
                                    <Text style={[styles.dropdownItemText, { color: isDarkMode ? '#fff' : '#000' }]}>
                                        {item ? item.title : 'Recents'}
                                    </Text>
                                    <Text style={styles.dropdownCount}>
                                        {item ? `${item.assetCount} photos` : 'All photos'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            style={{ maxHeight: SCREEN_WIDTH * 0.9 }}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                )}

                {/* Photos Grid */}
                <FlatList
                    data={assets}
                    renderItem={renderAsset}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loading ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        ) : null
                    }
                />
            </View>
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
        paddingTop: 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    closeBtn: {
        padding: 6,
    },
    albumSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    albumTitle: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    doneBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    doneBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    dropdown: {
        position: 'absolute',
        top: 96,
        left: 0,
        right: 0,
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        borderBottomWidth: 1,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.1)',
    },
    dropdownItemText: {
        fontSize: 16,
        fontWeight: '600',
    },
    dropdownCount: {
        fontSize: 13,
        color: '#8e8e93',
    },
    assetWrapper: {
        width: COLUMN_SIZE - 2,
        height: COLUMN_SIZE - 2,
        margin: 1,
        position: 'relative',
    },
    assetImage: {
        width: '100%',
        height: '100%',
    },
    selectionOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 2,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    footerLoader: {
        paddingVertical: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default CustomMediaPickerModal;
