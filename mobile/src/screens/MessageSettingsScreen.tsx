import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { supabase } from '../lib/supabase';
import { getBooleanPreference, PREFERENCE_KEYS, setBooleanPreference } from '../utils/preferences';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';

const MessageSettingsScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();

    // Save to Gallery — enabled by default
    const [saveMedia, setSaveMedia] = useState(true);

    const isDark = colors.background !== '#FFFFFF' && colors.background !== '#ffffff';
    const activeColor = isDark ? '#FFFFFF' : '#000000';

    useEffect(() => {
        const loadPreference = async () => {
            const enabled = await getBooleanPreference(PREFERENCE_KEYS.saveToGallery, true);
            setSaveMedia(enabled);
        };

        void loadPreference();
    }, []);

    const handleToggleSaveMedia = async (value: boolean) => {
        setSaveMedia(value);
        await setBooleanPreference(PREFERENCE_KEYS.saveToGallery, value);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;

        try {
            await supabase.from('profiles').update({
                save_to_gallery: value,
            }).eq('id', user.id);
        } catch {
            // Save-to-gallery sync should not block local preference changes.
        }
    };

    const AnimatedSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => (
        <TouchableOpacity onPress={() => onValueChange(!value)} activeOpacity={0.8}>
            <MotiView
                animate={{
                    scale: value ? 1.1 : 1,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 150 }}
            >
                <Icon 
                    name={value ? "ToggleRight" : "ToggleLeft"} 
                    size={36} 
                    color={value ? activeColor : colors.textSecondary} 
                />
            </MotiView>
        </TouchableOpacity>
    );

    const SettingItem = ({ icon, title, subtitle, value, onValueChange }) => (
        <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
            <View style={styles.settingInfo}>
                <Icon name={icon as any} size={22} color={colors.text} />
                <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                    )}
                </View>
            </View>
            <AnimatedSwitch
                value={value}
                onValueChange={onValueChange}
            />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Icon name="CaretLeft" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Message Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MEDIA</Text>

                <SettingItem
                    icon="Download"
                    title="Save to Gallery"
                    subtitle="Save received images and documents to your device gallery"
                    value={saveMedia}
                    onValueChange={handleToggleSaveMedia}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    backButton: { padding: SPACING.sm },
    headerTitle: {
        flex: 1,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginLeft: SPACING.sm,
    },
    content: { flex: 1, padding: SPACING.lg },
    sectionTitle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
        marginTop: SPACING.lg,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        marginLeft: SPACING.md,
        flex: 1,
    },
    settingTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
    },
    settingSubtitle: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
    },
});

export default MessageSettingsScreen;
