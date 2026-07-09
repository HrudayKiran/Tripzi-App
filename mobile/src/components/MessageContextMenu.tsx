import React from 'react';
import {
    View,
    Text,
    Modal,
    Pressable,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import Icon from './Icon';
import type { ChatMessage } from '../types/chat';

interface MessageContextMenuProps {
    visible: boolean;
    onClose: () => void;
    selectedMessage: ChatMessage | null;
    currentUserId: string | undefined;
    isDarkMode: boolean;
    colors: any;
    shadowStyle: any;
    onReply: () => void;
    onEdit: () => void;
    onDeleteForMe: () => void;
    onDeleteForEveryone: () => void;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    visible,
    onClose,
    selectedMessage,
    currentUserId,
    isDarkMode,
    colors,
    shadowStyle,
    onReply,
    onEdit,
    onDeleteForMe,
    onDeleteForEveryone,
}) => {
    if (!visible || !selectedMessage) return null;

    const isOwn = selectedMessage.senderId === currentUserId;
    const isTextMessage = selectedMessage.type === 'text';

    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={[styles.menu, { backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF' }, shadowStyle]}>
                    {/* Reply */}
                    <TouchableOpacity style={styles.item} onPress={onReply}>
                        <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? '#252525' : '#F0F0F3' }]}>
                            <Icon name="ArrowUUpLeft" size={18} color={colors.primary} />
                        </View>
                        <Text style={[styles.text, { color: colors.text }]}>Reply</Text>
                    </TouchableOpacity>

                    {/* Edit (own text messages only) */}
                    {isOwn && isTextMessage && (
                        <TouchableOpacity style={styles.item} onPress={onEdit}>
                            <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? '#252525' : '#F0F0F3' }]}>
                                <Icon name="PencilSimple" size={18} color={colors.primary} />
                            </View>
                            <Text style={[styles.text, { color: colors.text }]}>Edit</Text>
                        </TouchableOpacity>
                    )}

                    {/* Delete for Me */}
                    <TouchableOpacity style={styles.item} onPress={onDeleteForMe}>
                        <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEE2E2' }]}>
                            <Icon name="Trash" size={18} color="#EF4444" />
                        </View>
                        <Text style={[styles.text, { color: '#EF4444' }]}>Delete for Me</Text>
                    </TouchableOpacity>

                    {/* Delete for Everyone (own messages only) */}
                    {isOwn && (
                        <TouchableOpacity style={styles.item} onPress={onDeleteForEveryone}>
                            <View style={[styles.iconWrap, { backgroundColor: isDarkMode ? '#2A1A1A' : '#FEE2E2' }]}>
                                <Icon name="Trash" size={18} color="#EF4444" />
                            </View>
                            <Text style={[styles.text, { color: '#EF4444' }]}>Delete for Everyone</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menu: {
        borderRadius: 16,
        padding: 8,
        minWidth: 220,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    text: {
        fontSize: 15,
        fontWeight: '500',
    },
});

export default MessageContextMenu;
