import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

const AdminDashboardScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('KYC Requests');
    const [stats, setStats] = useState({ users: 0, pendingKYC: 0, feedback: 0 });
    const [users, setUsers] = useState<any[]>([]);
    const [kycRequests, setKycRequests] = useState<any[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
        fetchUsers();
    }, []);

    const fetchStats = async () => {
        try {
            const usersSnapshot = await firestore().collection('users').get();
            const kycSnapshot = await firestore().collection('users').where('kyc.status', '==', 'pending').get();
            const feedbackSnapshot = await firestore().collection('suggestions').get();

            setStats({
                users: usersSnapshot.size,
                pendingKYC: kycSnapshot.size,
                feedback: feedbackSnapshot.size,
            });

            setKycRequests(kycSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setFeedbacks(feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch {
            // Stats fetch failed silently
        }
    };

    const fetchUsers = async () => {
        try {
            const snapshot = await firestore().collection('users').get();
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList);
        } catch {
            // Users fetch failed silently
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setDeleting(userId);
        try {
            // 1. Delete user's trips
            const tripsSnapshot = await firestore().collection('trips').where('userId', '==', userId).get();
            const batch = firestore().batch();

            tripsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 2. Delete user from users collection
            batch.delete(firestore().collection('users').doc(userId));

            // Commit batch
            await batch.commit();

            // 3. Delete user's chats (optional: complex due to participants array)
            // Ideally should remove user from participants arrays or delete 1-on-1 chats

            // Refresh data
            await Promise.all([fetchStats(), fetchUsers()]);
            alert('User deleted successfully');
        } catch (error) {
            console.error(error);
            alert('Error deleting user');
        } finally {
            setDeleting(null);
        }
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
            <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="people" size={28} color="#8B5CF6" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.users}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Users</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="document-text" size={28} color="#EF4444" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.pendingKYC}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending KYC</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="chatbubble" size={28} color="#3B82F6" />
                    </View>
                    <Text style={[styles.statNumber, { color: colors.text }]}>{stats.feedback}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Feedback</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {['KYC Requests', 'Feedback', 'Users'].map((tab) => (
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
                                <Image
                                    source={{ uri: user.photoURL || undefined }}
                                    style={styles.userAvatar}
                                />
                                <View style={styles.userInfo}>
                                    <Text style={[styles.userName, { color: colors.text }]}>{user.displayName || 'User'}</Text>
                                    <Text style={[styles.userDetail, { color: colors.textSecondary }]}>
                                        {user.email}
                                    </Text>
                                </View>
                                {user.kyc?.status === 'verified' && (
                                    <View style={styles.verifiedBadge}>
                                        <Text style={styles.verifiedText}>verified</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[styles.deleteButton, { backgroundColor: '#FEE2E2' }]}
                                    onPress={() => handleDeleteUser(user.id)}
                                    disabled={deleting === user.id}
                                >
                                    <Ionicons name="trash" size={20} color="#EF4444" />
                                </TouchableOpacity>
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
                                        <Text style={[styles.userDetail, { color: colors.textSecondary }]}>Aadhaar: {req.kyc?.aadhaar}</Text>
                                    </View>
                                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#D1FAE5' }]}>
                                        <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Verify</Text>
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
                                    <Text style={[styles.feedbackText, { color: colors.text }]}>{item.text || item.message}</Text>
                                    <Text style={[styles.feedbackDate, { color: colors.textSecondary }]}>
                                        {item.createdAt?.toDate().toLocaleDateString()}
                                    </Text>
                                </View>
                            ))
                        )}
                    </>
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
        backgroundColor: '#8A2BE2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    backButton: {
        padding: 4,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 12,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    statIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#8A2BE2',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        fontWeight: '700',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    userDetail: {
        fontSize: 13,
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
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
    },
    deleteButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    feedbackCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    feedbackText: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    feedbackDate: {
        fontSize: 12,
    },
});

export default AdminDashboardScreen;
