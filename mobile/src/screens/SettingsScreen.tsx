import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const SettingsScreen = ({ navigation }) => {
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [pushEnabled, setPushEnabled] = useState(true);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Push Notifications */}
                <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="notifications" size={24} color="#8B5CF6" />
                    </View>
                    <View style={styles.settingInfo}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                            Receive notifications about new trips and messages
                        </Text>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
                        thumbColor={pushEnabled ? '#8A2BE2' : '#f4f3f4'}
                    />
                </View>

                {/* Native Push Info */}
                <View style={[styles.infoCard, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    <Ionicons name="phone-portrait-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Full push notification support is available in the iOS and Android app versions.
                    </Text>
                </View>

                {/* Dark Mode */}
                <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name={isDarkMode ? "moon" : "sunny"} size={24} color="#F59E0B" />
                    </View>
                    <View style={styles.settingInfo}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                            Toggle between light and dark theme
                        </Text>
                    </View>
                    <Switch
                        value={isDarkMode}
                        onValueChange={toggleTheme}
                        trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
                        thumbColor={isDarkMode ? '#8A2BE2' : '#f4f3f4'}
                    />
                </View>

                {/* Admin Dashboard */}
                <TouchableOpacity
                    style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => navigation.navigate('AdminDashboard')}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="shield" size={24} color="#8B5CF6" />
                    </View>
                    <View style={styles.settingInfo}>
                        <Text style={[styles.settingTitle, { color: colors.text }]}>Admin Dashboard</Text>
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                            Manage users, KYC requests, and feedback
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </ScrollView>
        </View>
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
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingInfo: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
});

export default SettingsScreen;
