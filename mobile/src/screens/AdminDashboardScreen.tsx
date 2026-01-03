import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';

const AdminDashboardScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('KYC Requests');
    const [stats, setStats] = useState({ users: 0, pendingKYC: 0, notSubmittedKYC: 0, feedback: 0 });
    const [users, setUsers] = useState<any[]>([]);
    const [kycRequests, setKycRequests] = useState<any[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        // Security Check: Only allow 'admin' role
        const checkAdminAccess = async () => {
            const currentUser = auth().currentUser;
            if (!currentUser) {
                navigation.replace('App');
                return;
            }

            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            if (userData?.role !== 'admin') {
                // Not an admin - kick them out
                Alert.alert('Access Denied', 'You do not have permission to view this page.');
                navigation.goBack(); // Better than replace 'App', just go back
                return;
            }

            fetchData();
        };

        checkAdminAccess();
    }, []);

    const fetchData = async () => {
        await Promise.all([fetchStats(), fetchUsers(), fetchFeedback()]);
    };

    const fetchStats = async () => {
        try {
            const usersSnapshot = await firestore().collection('users').get();
            const totalUsers = usersSnapshot.size;

            let pending = 0;
            let notSubmitted = 0;

            usersSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.kyc?.status === 'pending') pending++;
                else if (!data.kyc || !data.kyc.status || data.kyc.status === 'none') notSubmitted++;
            });

            const suggestionsSnapshot = await firestore().collection('suggestions').get();
            const bugsSnapshot = await firestore().collection('bugs').get();
            const totalFeedback = suggestionsSnapshot.size + bugsSnapshot.size;

            setStats({
                users: totalUsers,
                pendingKYC: pending,
                notSubmittedKYC: notSubmitted,
                feedback: totalFeedback,
            });

            // Set KYC Requests list directly here or in fetchUsers, doing it here for clarity with stats
            const pendingRequests = usersSnapshot.docs
                .filter(doc => doc.data().kyc?.status === 'pending')
                .map(doc => ({ id: doc.id, ...doc.data() }));
            setKycRequests(pendingRequests);

        } catch (e) {
            // Error fetching stats

        }
    };

    const fetchUsers = async () => {
        try {
            const snapshot = await firestore().collection('users').get();
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList);
        } catch { }
    };

    const fetchFeedback = async () => {
        try {
            const suggestions = await firestore().collection('suggestions').orderBy('createdAt', 'desc').get();
            const bugs = await firestore().collection('bugs').orderBy('createdAt', 'desc').get();

            const allFeedback = [
                ...suggestions.docs.map(doc => ({ id: doc.id, type: 'suggestion', ...doc.data() })),
                ...bugs.docs.map(doc => ({ id: doc.id, type: 'bug', ...doc.data() }))
            ].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            setFeedbacks(allFeedback);
        } catch (e) { }
    };

    const handleVerifyKyc = async (userId: string) => {
        try {
            await firestore().collection('users').doc(userId).update({
                'kyc.status': 'verified',
                'kyc.verifiedAt': firestore.FieldValue.serverTimestamp(),
                kycStatus: 'verified' // Syncing legacy field if exists
            });
            alert('KYC Verified Successfully ✅');
            fetchData();
        } catch (error) {
            alert('Error verifying KYC');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setDeleting(userId);
        try {
            // 1. Delete user's trips
            const tripsSnapshot = await firestore().collection('trips').where('userId', '==', userId).get();
            const batch = firestore().batch();
            tripsSnapshot.docs.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit(); // Commit trips deletion first

            // 2. Delete user from users collection explicitly
            await firestore().collection('users').doc(userId).delete();

            // Refresh data
            await fetchData();
            alert('User deleted successfully');
        } catch (error) {
            console.error(error);
            alert('Error deleting user');
        } finally {
            setDeleting(null);
        }
    };

    const migrateUsers = async () => {
        Alert.alert(
            'Migrate Users?',
            'This will update ALL users to the new standardized format (userId, userName, remove isOnline/lastSeen). Proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Migrate',
                    onPress: async () => {
                        try {
                            const snapshot = await firestore().collection('users').get();
                            const batch = firestore().batch();
                            let count = 0;

                            for (const doc of snapshot.docs) {
                                const data = doc.data();
                                const ref = firestore().collection('users').doc(doc.id);
                                const updates: any = {};

                                // 1. Add missing default fields
                                if (!data.bio) updates.bio = 'Traveller';
                                if (!data.followers) updates.followers = [];
                                if (!data.following) updates.following = [];
                                if (!data.rating) updates.rating = 0;
                                if (!data.role) updates.role = 'user';
                                if (data.pushNotifications === undefined) updates.pushNotifications = true;
                                if (data.emailVerified === undefined) updates.emailVerified = false;
                                if (data.phoneVerified === undefined) updates.phoneVerified = false;

                                // New fields: userId and userName
                                if (!data.userId) updates.userId = doc.id;
                                if (!data.userName) updates.userName = data.displayName || 'User';

                                // 2. Set KYC verified for existing users if missing or pending
                                if (!data.kycStatus || data.kycStatus === 'pending' || data.kycStatus === 'unverified') {
                                    updates.kycStatus = 'verified';
                                    updates.kycVerifiedAt = firestore.FieldValue.serverTimestamp();
                                }

                                // 3. Remove deprecated fields
                                if (data.lastSeen !== undefined) updates.lastSeen = firestore.FieldValue.delete();
                                if (data.isOnline !== undefined) updates.isOnline = firestore.FieldValue.delete();

                                if (Object.keys(updates).length > 0) {
                                    batch.update(ref, updates);
                                    count++;
                                }
                            }

                            await batch.commit();
                            Alert.alert('Success', `Migrated ${count} users successfully.`);
                            fetchData();
                        } catch (e) {
                            Alert.alert('Error', 'Migration failed: ' + e.message);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Ionicons name="shield" size={24} color="#fff" style={styles.headerIcon} />
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Stats Cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="people" size={24} color="#8B5CF6" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.users}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Users</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="time" size={24} color="#F59E0B" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.pendingKYC}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending KYC</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.notSubmittedKYC}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Not Submitted</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="chatbubbles" size={24} color="#3B82F6" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.feedback}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Feedback</Text>
                </View>
            </ScrollView>

            {/* Tabs */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {['KYC Requests', 'Feedback', 'Users', 'System'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText, { color: activeTab === tab ? colors.text : colors.textSecondary }]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <ScrollView style={[styles.content, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
                {activeTab === 'Users' && (
                    <>
                        {users.map((user) => (
                            <View key={user.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.userHeader}>
                                    <Image
                                        source={{ uri: user.photoURL || undefined }}
                                        style={styles.userAvatar as any}
                                    />
                                    <View style={styles.userInfo}>
                                        <Text style={[styles.userName, { color: colors.text }]}>{user.displayName || 'User'}</Text>
                                        <Text style={[styles.userDetail, { color: colors.textSecondary }]}>{user.email}</Text>
                                    </View>
                                </View>

                                <View style={styles.userStatusRow}>
                                    <View style={[styles.statusBadge, { backgroundColor: user.kyc?.status === 'verified' ? '#D1FAE5' : '#F3F4F6' }]}>
                                        <Text style={[styles.statusText, { color: user.kyc?.status === 'verified' ? '#10B981' : '#6B7280' }]}>
                                            {user.kyc?.status === 'verified' ? 'KYC Verified' : 'KYC Pending/None'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: '#FEE2E2' }]}
                                        onPress={() => handleDeleteUser(user.id)}
                                        disabled={deleting === user.id}
                                    >
                                        <Ionicons name="trash" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {activeTab === 'KYC Requests' && (
                    <>
                        {kycRequests.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending KYC requests</Text>
                            </View>
                        ) : (
                            kycRequests.map((req) => (
                                <View key={req.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={styles.userInfo}>
                                        <Text style={[styles.userName, { color: colors.text }]}>{req.displayName}</Text>
                                        <Text style={[styles.userDetail, { color: colors.textSecondary }]}>Email: {req.email}</Text>
                                        <Text style={[styles.userDetail, { color: colors.textSecondary, marginTop: 4 }]}>Aadhaar: {req.kyc?.aadhaar}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: '#D1FAE5', marginTop: 10 }]}
                                        onPress={() => handleVerifyKyc(req.id)}
                                    >
                                        <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Approve & Verify</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </>
                )}

                {activeTab === 'Feedback' && (
                    <>
                        {feedbacks.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No feedback yet</Text>
                            </View>
                        ) : (
                            feedbacks.map((item) => (
                                <View key={item.id} style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={[styles.feedbackBadge, { backgroundColor: item.type === 'bug' ? '#FEE2E2' : '#FEF3C7' }]}>
                                        <Ionicons name={item.type === 'bug' ? 'bug' : 'bulb'} size={12} color={item.type === 'bug' ? '#EF4444' : '#F59E0B'} />
                                        <Text style={[styles.feedbackType, { color: item.type === 'bug' ? '#EF4444' : '#F59E0B' }]}>
                                            {item.type === 'bug' ? 'Bug Report' : 'Suggestion'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.feedbackTitle, { color: colors.text }]}>{item.title}</Text>
                                    <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>{item.description || item.text}</Text>
                                    <Text style={[styles.feedbackDate, { color: colors.textSecondary, marginTop: 8 }]}>
                                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </>
                )}

                {activeTab === 'System' && (
                    <View style={styles.systemTab}>
                        <View style={[styles.statCard, { width: '100%', alignItems: 'flex-start', backgroundColor: colors.card }]}>
                            <Text style={[styles.statTitle, { color: colors.text }]}>Database Stats</Text>
                            <View style={styles.statRow}>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Users:</Text>
                                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.users}</Text>
                            </View>
                            <View style={styles.statRow}>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending KYC:</Text>
                                <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pendingKYC}</Text>
                            </View>
                        </View>

                        <View style={styles.actionSection}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Maintenance</Text>

                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                                onPress={migrateUsers}
                            >
                                <Ionicons name="construct-outline" size={20} color="#fff" />
                                <Text style={styles.actionButtonText}>Migrate Users Schema</Text>
                            </TouchableOpacity>
                            <Text style={[styles.actionHint, { color: colors.textSecondary }]}>
                                Updates all users to standardized fields (userId, userName, etc) and removes deprecated ones.
                            </Text>
                        </View>
                    </View>
                )}
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
        paddingBottom: 20,
        backgroundColor: '#8A2BE2', // Original color, adjust if colors.background is preferred
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 4,
    },
    headerContent: { // This style is no longer used directly in the new header structure
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: { // This style is no longer used directly in the new header structure
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff', // Original color, adjust if colors.text is preferred
    },
    statsContainer: { // This section is removed from the main render, stats are now in System tab
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 12,
        paddingRight: 40,
    },
    statCard: {
        width: '100%', // Adjusted for System tab layout
        alignItems: 'flex-start', // Adjusted for System tab layout
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16, // Added for spacing in System tab
    },
    statIconBox: { // This style is no longer used directly in the new stats structure
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statNumber: { // This style is no longer used directly in the new stats structure
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 16, // Adjusted for System tab layout
        fontWeight: '500',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 2, // Added for active tab indicator
        borderBottomColor: 'transparent', // Default transparent
    },
    activeTab: { // This style is now handled inline in the render method
        borderBottomWidth: 2,
        borderBottomColor: '#8A2BE2',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#8A2BE2',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    userCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    userDetail: {
        fontSize: 13,
    },
    userStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    verifiedBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    verifiedText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButton: {
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
    },
    feedbackCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    feedbackBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
        gap: 4,
    },
    feedbackType: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    feedbackTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 14,
        lineHeight: 20,
    },
    feedbackDate: {
        fontSize: 12,
        textAlign: 'right',
    },
    // System Tab Styles
    systemTab: {
        flex: 1,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 8,
    },
    statTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionSection: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    actionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    actionHint: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
});

export default AdminDashboardScreen;
