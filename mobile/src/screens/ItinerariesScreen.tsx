import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';

const ItinerariesScreen = () => {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'Shared' | 'Posted' | 'Saved'>('Shared');

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                <Icon 
                    name={activeTab === 'Shared' ? 'Users' : activeTab === 'Posted' ? 'PaperPlaneTilt' : 'BookmarkSimple'} 
                    size={48} 
                    color={isDarkMode ? '#FFFFFF' : '#000000'} 
                />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No {activeTab} Itineraries
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {activeTab === 'Shared' 
                    ? "Itineraries shared with you by other travelers will appear here."
                    : activeTab === 'Posted'
                    ? "Your published trip itineraries will appear here for others to see."
                    : "Itineraries you've saved for inspiration will appear here."}
            </Text>
            <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
                onPress={() => router.push('/(tabs)/create')}
            >
                <Text style={[styles.actionButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Create New Trip</Text>
            </TouchableOpacity>
        </View>
    );

    const themeActiveBg = isDarkMode ? '#FFFFFF' : '#000000';
    const themeActiveText = isDarkMode ? '#000000' : '#FFFFFF';

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <NeumorphicBackButton onPress={() => router.back()} />
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Itineraries</Text>
                    <View style={{ width: 45 }} />
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBarContainer}>
                    <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('Shared')}
                            style={[
                                styles.tab, 
                                activeTab === 'Shared' && [styles.activeTab, { backgroundColor: themeActiveBg }]
                            ]}
                        >
                            <Text style={[
                                styles.tabText, 
                                { color: activeTab === 'Shared' ? themeActiveText : colors.textSecondary }
                            ]}>
                                Shared
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('Posted')}
                            style={[
                                styles.tab, 
                                activeTab === 'Posted' && [styles.activeTab, { backgroundColor: themeActiveBg }]
                            ]}
                        >
                            <Text style={[
                                styles.tabText, 
                                { color: activeTab === 'Posted' ? themeActiveText : colors.textSecondary }
                            ]}>
                                Posted
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setActiveTab('Saved')}
                            style={[
                                styles.tab, 
                                activeTab === 'Saved' && [styles.activeTab, { backgroundColor: themeActiveBg }]
                            ]}
                        >
                            <Text style={[
                                styles.tabText, 
                                { color: activeTab === 'Saved' ? themeActiveText : colors.textSecondary }
                            ]}>
                                Saved
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <ScrollView 
                    contentContainerStyle={styles.contentScroll}
                    showsVerticalScrollIndicator={false}
                >
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 400 }}
                    >
                        {renderEmptyState()}
                    </MotiView>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
    },
    tabBarContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    tabBar: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tabText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    contentScroll: {
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 60,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: 10,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
    },
    actionButton: {
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 30,
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
    }
});

export default ItinerariesScreen;
