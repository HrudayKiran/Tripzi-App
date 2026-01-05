import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Alert,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Modal,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import NotificationService from '../utils/notificationService';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const { width } = Dimensions.get('window');

// Tab configuration
const TABS = [
    { id: 'overview', label: 'Overview', icon: 'grid-outline' },
    { id: 'kyc', label: 'KYC', icon: 'shield-checkmark-outline' },
    { id: 'users', label: 'Users', icon: 'people-outline' },
    { id: 'reports', label: 'Reports', icon: 'flag-outline' },
    { id: 'feedback', label: 'Feedback', icon: 'chatbubbles-outline' },
    { id: 'trips', label: 'Trips', icon: 'airplane-outline' },
    { id: 'system', label: 'System', icon: 'settings-outline' },
];

const AdminDashboardScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalUsers: 0,
        pendingKYC: 0,
        verifiedKYC: 0,
        rejectedKYC: 0,
        totalTrips: 0,
        activeTrips: 0,
        totalFeedback: 0,
        bugs: 0,
        suggestions: 0,
    });
    const [users, setUsers] = useState<any[]>([]);
    const [kycRequests, setKycRequests] = useState<any[]>([]);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [viewingKyc, setViewingKyc] = useState<any | null>(null);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            navigation.replace('App');
            return;
        }

        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            Alert.alert('Access Denied', 'You do not have permission to view this page.');
            navigation.goBack();
            return;
        }

        fetchAllData();
    };

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchUsers(), fetchFeedback(), fetchTrips(), fetchReports()]);
        setLoading(false);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchAllData();
        setRefreshing(false);
    }, []);

    const fetchStats = async () => {
        try {
            const usersSnapshot = await firestore().collection('users').get();
            const tripsSnapshot = await firestore().collection('trips').get();
            const suggestionsSnapshot = await firestore().collection('suggestions').get();
            const bugsSnapshot = await firestore().collection('bugs').get();

            let pending = 0, verified = 0, rejected = 0;
            const pendingRequests: any[] = [];

            usersSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const kycStatus = data.kyc?.status || data.kycStatus;
                if (kycStatus === 'pending') {
                    pending++;
                    pendingRequests.push({ id: doc.id, ...data });
                } else if (kycStatus === 'verified') {
                    verified++;
                } else if (kycStatus === 'rejected') {
                    rejected++;
                }
            });

            const now = new Date();
            const activeTrips = tripsSnapshot.docs.filter(doc => {
                const data = doc.data();
                const endDate = data.endDate?.toDate?.() || new Date(data.endDate);
                return endDate >= now;
            }).length;

            setKycRequests(pendingRequests);
            setStats({
                totalUsers: usersSnapshot.size,
                pendingKYC: pending,
                verifiedKYC: verified,
                rejectedKYC: rejected,
                totalTrips: tripsSnapshot.size,
                activeTrips,
                totalFeedback: suggestionsSnapshot.size + bugsSnapshot.size,
                bugs: bugsSnapshot.size,
                suggestions: suggestionsSnapshot.size,
            });
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    };

    const fetchUsers = async () => {
        try {
            const snapshot = await firestore().collection('users').orderBy('createdAt', 'desc').get();
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        } catch { }
    };

    const fetchTrips = async () => {
        try {
            const snapshot = await firestore().collection('trips').orderBy('createdAt', 'desc').limit(50).get();
            setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch { }
    };

    const fetchReports = async () => {
        try {
            const snapshot = await firestore().collection('reports').orderBy('createdAt', 'desc').get();
            setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch { }
    };

    const handleResolveReport = async (reportId: string, resolution: string) => {
        setProcessingId(reportId);
        try {
            await firestore().collection('reports').doc(reportId).update({
                status: 'resolved',
                resolution,
                resolvedAt: firestore.FieldValue.serverTimestamp(),
            });
            Alert.alert('Success', `Report resolved: ${resolution}`);
            await fetchReports();
        } catch (error) {
            Alert.alert('Error', 'Failed to resolve report');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDismissReport = async (reportId: string) => {
        setProcessingId(reportId);
        try {
            await firestore().collection('reports').doc(reportId).update({
                status: 'dismissed',
                resolvedAt: firestore.FieldValue.serverTimestamp(),
            });
            Alert.alert('Dismissed', 'Report dismissed');
            await fetchReports();
        } catch (error) {
            Alert.alert('Error', 'Failed to dismiss report');
        } finally {
            setProcessingId(null);
        }
    };

    const handleVerifyKyc = async (userId: string) => {
        setProcessingId(userId);
        try {
            await firestore().collection('users').doc(userId).update({
                'kyc.status': 'verified',
                'kyc.verifiedAt': firestore.FieldValue.serverTimestamp(),
                kycStatus: 'verified'
            });
            await NotificationService.onKycVerified(userId);
            Alert.alert('Success ✅', 'KYC Verified Successfully');
            await fetchAllData();
        } catch (error) {
            Alert.alert('Error', 'Failed to verify KYC');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectKyc = async (userId: string) => {
        if (!rejectReason.trim()) {
            Alert.alert('Required', 'Please provide a rejection reason');
            return;
        }
        setProcessingId(userId);
        try {
            await firestore().collection('users').doc(userId).update({
                'kyc.status': 'rejected',
                'kyc.rejectedAt': firestore.FieldValue.serverTimestamp(),
                'kyc.rejectionReason': rejectReason.trim(),
                kycStatus: 'rejected'
            });
            await NotificationService.onKycRejected(userId, rejectReason.trim());
            Alert.alert('Done', 'KYC Rejected');
            setShowRejectModal(false);
            setRejectReason('');
            setSelectedUser(null);
            await fetchAllData();
        } catch (error) {
            Alert.alert('Error', 'Failed to reject KYC');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        Alert.alert(
            'Delete User',
            'This will permanently delete the user and all their trips. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingId(userId);
                        try {
                            const tripsSnapshot = await firestore().collection('trips').where('userId', '==', userId).get();
                            const batch = firestore().batch();
                            tripsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                            await firestore().collection('users').doc(userId).delete();
                            Alert.alert('Deleted', 'User deleted successfully');
                            await fetchAllData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete user');
                        } finally {
                            setProcessingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteTrip = async (tripId: string) => {
        Alert.alert('Delete Trip', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setProcessingId(tripId);
                    try {
                        await firestore().collection('trips').doc(tripId).delete();
                        setTrips(prev => prev.filter(t => t.id !== tripId));
                    } catch { }
                    setProcessingId(null);
                }
            }
        ]);
    };

    const filteredUsers = users.filter(u =>
    (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Stat Card Component
    const StatCard = ({ icon, iconColor, iconBg, value, label, onPress = null }) => (
        <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.card }]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>
                <Ionicons name={icon} size={24} color={iconColor} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );

    // Overview Tab
    const renderOverview = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <StatCard icon="people" iconColor="#8B5CF6" iconBg="#EDE9FE" value={stats.totalUsers} label="Total Users" onPress={() => setActiveTab('users')} />
                <StatCard icon="time" iconColor="#F59E0B" iconBg="#FEF3C7" value={stats.pendingKYC} label="Pending KYC" onPress={() => setActiveTab('kyc')} />
                <StatCard icon="shield-checkmark" iconColor="#10B981" iconBg="#D1FAE5" value={stats.verifiedKYC} label="Verified" />
                <StatCard icon="airplane" iconColor="#3B82F6" iconBg="#DBEAFE" value={stats.totalTrips} label="Total Trips" onPress={() => setActiveTab('trips')} />
                <StatCard icon="chatbubbles" iconColor="#EC4899" iconBg="#FCE7F3" value={stats.totalFeedback} label="Feedback" onPress={() => setActiveTab('feedback')} />
                <StatCard icon="bug" iconColor="#EF4444" iconBg="#FEE2E2" value={stats.bugs} label="Bug Reports" />
            </View>

            {/* Quick Actions */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
            </View>
            <View style={styles.quickActions}>
                <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: '#EDE9FE' }]} onPress={() => setActiveTab('kyc')}>
                    <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
                    <Text style={[styles.quickActionText, { color: '#8B5CF6' }]}>Review KYC</Text>
                    {stats.pendingKYC > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{stats.pendingKYC}</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => setActiveTab('feedback')}>
                    <Ionicons name="chatbubbles" size={24} color="#3B82F6" />
                    <Text style={[styles.quickActionText, { color: '#3B82F6' }]}>View Feedback</Text>
                </TouchableOpacity>
            </View>

            {/* Recent Activity */}
            {kycRequests.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending KYC Requests</Text>
                        <TouchableOpacity onPress={() => setActiveTab('kyc')}>
                            <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {kycRequests.slice(0, 3).map(req => (
                        <View key={req.id} style={[styles.kycCard, { backgroundColor: colors.card }]}>
                            <Image source={{ uri: req.photoURL || undefined }} style={styles.kycAvatar} />
                            <View style={styles.kycInfo}>
                                <Text style={[styles.kycName, { color: colors.text }]}>{req.displayName || 'User'}</Text>
                                <Text style={[styles.kycEmail, { color: colors.textSecondary }]}>{req.email}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.approveBtn, processingId === req.id && { opacity: 0.5 }]}
                                onPress={() => handleVerifyKyc(req.id)}
                                disabled={processingId === req.id}
                            >
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </>
            )}
        </Animatable.View>
    );

    // KYC Tab
    const renderKYC = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            {kycRequests.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="shield-checkmark-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear!</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending KYC requests</Text>
                </View>
            ) : (
                kycRequests.map(req => (
                    <View key={req.id} style={[styles.kycDetailCard, { backgroundColor: colors.card }]}>
                        <View style={styles.kycDetailHeader}>
                            <Image source={{ uri: req.photoURL || undefined }} style={styles.kycDetailAvatar} />
                            <View style={styles.kycDetailInfo}>
                                <Text style={[styles.kycDetailName, { color: colors.text }]}>{req.displayName}</Text>
                                <Text style={[styles.kycDetailEmail, { color: colors.textSecondary }]}>{req.email}</Text>
                            </View>
                        </View>

                        <View style={styles.kycDataRow}>
                            <Text style={[styles.kycLabel, { color: colors.textSecondary }]}>Aadhaar:</Text>
                            <Text style={[styles.kycValue, { color: colors.text }]}>{req.kyc?.aadhaar || 'N/A'}</Text>
                        </View>
                        <View style={styles.kycDataRow}>
                            <Text style={[styles.kycLabel, { color: colors.textSecondary }]}>DOB:</Text>
                            <Text style={[styles.kycValue, { color: colors.text }]}>
                                {req.kyc?.dateOfBirth?.toDate?.().toLocaleDateString() || 'N/A'}
                            </Text>
                        </View>

                        {req.kyc?.selfieUrl && (
                            <TouchableOpacity onPress={() => setViewingKyc({
                                userId: req.id,
                                selfieImageUrl: req.kyc?.selfieUrl,
                                aadhaarImageUrl: req.kyc?.aadhaarUrl,
                                aadhaarNumber: req.kyc?.aadhaar,
                                dateOfBirth: req.kyc?.dateOfBirth
                            })}>
                                <Image source={{ uri: req.kyc.selfieUrl }} style={styles.kycDocImage} resizeMode="cover" />
                                <Text style={{ textAlign: 'center', color: colors.primary, marginTop: 4 }}>Tap to View Docs</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.kycActions}>
                            <TouchableOpacity
                                style={[styles.rejectBtn, processingId === req.id && { opacity: 0.5 }]}
                                onPress={() => { setSelectedUser(req); setShowRejectModal(true); }}
                                disabled={processingId === req.id}
                            >
                                <Ionicons name="close" size={20} color="#EF4444" />
                                <Text style={styles.rejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.verifyBtn, processingId === req.id && { opacity: 0.5 }]}
                                onPress={() => handleVerifyKyc(req.id)}
                                disabled={processingId === req.id}
                            >
                                {processingId === req.id ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                        <Text style={styles.verifyBtnText}>Approve</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
        </Animatable.View>
    );

    // Users Tab
    const renderUsers = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            {/* Search */}
            <View style={[styles.searchBox, { backgroundColor: colors.card }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search users..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* User List */}
            {filteredUsers.map(user => (
                <TouchableOpacity
                    key={user.id}
                    style={[styles.userCard, { backgroundColor: colors.card }]}
                    onPress={() => { setSelectedUser(user); setShowUserModal(true); }}
                >
                    <Image source={{ uri: user.photoURL || undefined }} style={styles.userAvatar} />
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>{user.displayName || 'User'}</Text>
                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
                    </View>
                    <View style={[
                        styles.kycBadge,
                        {
                            backgroundColor: user.kycStatus === 'verified' ? '#D1FAE5' :
                                user.kycStatus === 'pending' ? '#FEF3C7' : '#F3F4F6'
                        }
                    ]}>
                        <Text style={[
                            styles.kycBadgeText,
                            {
                                color: user.kycStatus === 'verified' ? '#10B981' :
                                    user.kycStatus === 'pending' ? '#F59E0B' : '#6B7280'
                            }
                        ]}>
                            {user.kycStatus === 'verified' ? 'Verified' :
                                user.kycStatus === 'pending' ? 'Pending' : 'None'}
                        </Text>
                    </View>
                </TouchableOpacity>
            ))}
        </Animatable.View>
    );

    // Feedback Tab
    const renderFeedback = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            {feedbacks.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="chatbubble-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Feedback</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No feedback received yet</Text>
                </View>
            ) : (
                feedbacks.map(item => (
                    <View key={item.id} style={[styles.feedbackCard, { backgroundColor: colors.card }]}>
                        <View style={[styles.feedbackBadge, { backgroundColor: item.type === 'bug' ? '#FEE2E2' : '#FEF3C7' }]}>
                            <Ionicons name={item.type === 'bug' ? 'bug' : 'bulb'} size={14} color={item.type === 'bug' ? '#EF4444' : '#F59E0B'} />
                            <Text style={[styles.feedbackType, { color: item.type === 'bug' ? '#EF4444' : '#F59E0B' }]}>
                                {item.type === 'bug' ? 'Bug' : 'Suggestion'}
                            </Text>
                        </View>
                        <Text style={[styles.feedbackTitle, { color: colors.text }]}>{item.title || 'Untitled'}</Text>
                        <Text style={[styles.feedbackDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                            {item.description || item.text || 'No description'}
                        </Text>
                        <Text style={[styles.feedbackDate, { color: colors.textSecondary }]}>
                            {item.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                        </Text>
                    </View>
                ))
            )}
        </Animatable.View>
    );

    // Reports Tab
    const renderReports = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            {reports.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="flag-outline" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reports</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All good! No reports pending.</Text>
                </View>
            ) : (
                reports.map(report => (
                    <View key={report.id} style={[styles.reportCard, { backgroundColor: colors.card }]}>
                        <View style={styles.reportHeader}>
                            <View style={[styles.reportBadge, {
                                backgroundColor: report.status === 'resolved' ? '#D1FAE5' :
                                    report.status === 'dismissed' ? '#F3F4F6' : '#FEE2E2'
                            }]}>
                                <Text style={[styles.reportBadgeText, {
                                    color: report.status === 'resolved' ? '#10B981' :
                                        report.status === 'dismissed' ? '#6B7280' : '#EF4444'
                                }]}>{report.type ? report.type.toUpperCase() : 'REPORT'}</Text>
                            </View>
                            <Text style={[styles.reportDate, { color: colors.textSecondary }]}>
                                {report.createdAt?.toDate?.().toLocaleDateString() || 'Recently'}
                            </Text>
                        </View>

                        <Text style={[styles.reportTripTitle, { color: colors.text }]}>Trip: {report.tripTitle || 'Unknown Trip'}</Text>
                        <Text style={[styles.reportStatus, { color: colors.textSecondary }]}>Status: {report.status}</Text>
                        <Text style={[styles.reportDesc, { color: colors.text }]}>{report.description}</Text>

                        {report.status === 'pending' && (
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.reportActionBtn, { borderColor: '#F59E0B' }]}
                                    onPress={() => handleResolveReport(report.id, 'warning')}
                                >
                                    <Text style={{ color: '#F59E0B' }}>⚠️ Warn Host</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.reportActionBtn, { borderColor: '#EF4444' }]}
                                    onPress={() => handleResolveReport(report.id, 'suspend')}
                                >
                                    <Text style={{ color: '#EF4444' }}>🚫 Suspend</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.reportActionBtn, { borderColor: colors.border }]}
                                    onPress={() => handleDismissReport(report.id)}
                                >
                                    <Text style={{ color: colors.textSecondary }}>❌ Dismiss</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {report.status === 'resolved' && (
                            <Text style={{ color: '#10B981', marginTop: 8, fontWeight: 'bold' }}>Resolved: {report.resolution}</Text>
                        )}
                    </View>
                ))
            )}
        </Animatable.View>
    );

    // Trips Tab
    const renderTrips = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            <View style={styles.statsRow}>
                <View style={[styles.miniStat, { backgroundColor: colors.card }]}>
                    <Text style={[styles.miniStatValue, { color: colors.primary }]}>{stats.totalTrips}</Text>
                    <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>Total</Text>
                </View>
                <View style={[styles.miniStat, { backgroundColor: colors.card }]}>
                    <Text style={[styles.miniStatValue, { color: '#10B981' }]}>{stats.activeTrips}</Text>
                    <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>Active</Text>
                </View>
            </View>

            {trips.map(trip => (
                <View key={trip.id} style={[styles.tripCard, { backgroundColor: colors.card }]}>
                    <Image source={{ uri: trip.coverImage || trip.images?.[0] || undefined }} style={styles.tripImage} />
                    <View style={styles.tripInfo}>
                        <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>{trip.title}</Text>
                        <Text style={[styles.tripLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                            📍 {trip.location || trip.toLocation || 'Unknown'}
                        </Text>
                        <Text style={[styles.tripParticipants, { color: colors.textSecondary }]}>
                            👥 {trip.participants?.length || 0} participants
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.tripDeleteBtn}
                        onPress={() => handleDeleteTrip(trip.id)}
                    >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            ))}
        </Animatable.View>
    );

    // System Tab
    const renderSystem = () => (
        <Animatable.View animation="fadeIn" duration={300}>
            <View style={[styles.systemCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.systemTitle, { color: colors.text }]}>Database Overview</Text>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Total Users:</Text>
                    <Text style={[styles.systemValue, { color: colors.text }]}>{stats.totalUsers}</Text>
                </View>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Total Trips:</Text>
                    <Text style={[styles.systemValue, { color: colors.text }]}>{stats.totalTrips}</Text>
                </View>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Pending KYC:</Text>
                    <Text style={[styles.systemValue, { color: '#F59E0B' }]}>{stats.pendingKYC}</Text>
                </View>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Verified KYC:</Text>
                    <Text style={[styles.systemValue, { color: '#10B981' }]}>{stats.verifiedKYC}</Text>
                </View>
            </View>

            <View style={[styles.systemCard, { backgroundColor: colors.card, marginTop: SPACING.lg }]}>
                <Text style={[styles.systemTitle, { color: colors.text }]}>App Info</Text>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Version:</Text>
                    <Text style={[styles.systemValue, { color: colors.text }]}>1.0.0</Text>
                </View>
                <View style={styles.systemRow}>
                    <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>Platform:</Text>
                    <Text style={[styles.systemValue, { color: colors.text }]}>Android</Text>
                </View>
            </View>
        </Animatable.View>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'kyc': return renderKYC();
            case 'users': return renderUsers();
            case 'reports': return renderReports();
            case 'feedback': return renderFeedback();
            case 'trips': return renderTrips();
            case 'system': return renderSystem();
            default: return renderOverview();
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Ionicons name="shield" size={24} color="#fff" />
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={22} color="#fff" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Tab Bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.tabBar, { backgroundColor: colors.card }]}
                contentContainerStyle={styles.tabBarContent}
            >
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tabItem, activeTab === tab.id && styles.activeTabItem]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={20}
                            color={activeTab === tab.id ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[
                            styles.tabLabel,
                            { color: activeTab === tab.id ? colors.primary : colors.textSecondary }
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Content */}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {renderContent()}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* User Detail Modal */}
            <Modal visible={showUserModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>User Details</Text>
                            <TouchableOpacity onPress={() => setShowUserModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        {selectedUser && (
                            <>
                                <Image source={{ uri: selectedUser.photoURL || undefined }} style={styles.modalAvatar} />
                                <Text style={[styles.modalUserName, { color: colors.text }]}>{selectedUser.displayName}</Text>
                                <Text style={[styles.modalEmail, { color: colors.textSecondary }]}>{selectedUser.email}</Text>

                                <View style={styles.modalInfoRow}>
                                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Role:</Text>
                                    <Text style={[styles.modalValue, { color: colors.text }]}>{selectedUser.role || 'user'}</Text>
                                </View>
                                <View style={styles.modalInfoRow}>
                                    <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>KYC:</Text>
                                    <Text style={[styles.modalValue, { color: selectedUser.kycStatus === 'verified' ? '#10B981' : '#F59E0B' }]}>
                                        {selectedUser.kycStatus || 'None'}
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.deleteUserBtn}
                                    onPress={() => { setShowUserModal(false); handleDeleteUser(selectedUser.id); }}
                                >
                                    <Ionicons name="trash" size={20} color="#fff" />
                                    <Text style={styles.deleteUserBtnText}>Delete User</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Reject KYC Modal */}
            <Modal visible={showRejectModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Reject KYC</Text>
                            <TouchableOpacity onPress={() => { setShowRejectModal(false); setRejectReason(''); }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.rejectLabel, { color: colors.textSecondary }]}>
                            Reason for rejection:
                        </Text>
                        <TextInput
                            style={[styles.rejectInput, { backgroundColor: colors.card, color: colors.text }]}
                            placeholder="e.g., Documents unclear, ID mismatch..."
                            placeholderTextColor={colors.textSecondary}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            numberOfLines={3}
                        />
                        <TouchableOpacity
                            style={[styles.confirmRejectBtn, !rejectReason.trim() && { opacity: 0.5 }]}
                            onPress={() => handleRejectKyc(selectedUser?.id)}
                            disabled={!rejectReason.trim() || processingId === selectedUser?.id}
                        >
                            {processingId === selectedUser?.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.confirmRejectText}>Confirm Rejection</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* KYC Document Viewer Modal */}
            <Modal visible={!!viewingKyc} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>KYC Documents</Text>
                            <TouchableOpacity onPress={() => setViewingKyc(null)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={[styles.kycLabel, { color: colors.text, marginBottom: 8, width: '100%' }]}>Selfie (Live Capture):</Text>
                            <Image source={{ uri: viewingKyc?.selfieImageUrl }} style={[styles.kycDocImage, { height: 300 }]} resizeMode="contain" />

                            {viewingKyc?.aadhaarImageUrl && (
                                <>
                                    <Text style={[styles.kycLabel, { color: colors.text, marginTop: 16, marginBottom: 8, width: '100%' }]}>Aadhaar Card (Scanned):</Text>
                                    <Image source={{ uri: viewingKyc.aadhaarImageUrl }} style={[styles.kycDocImage, { height: 200 }]} resizeMode="contain" />
                                </>
                            )}

                            <View style={[styles.kycDataRow, { marginTop: 16 }]}>
                                <Text style={[styles.kycLabel, { color: colors.textSecondary }]}>Aadhaar Number:</Text>
                                <Text style={[styles.kycValue, { color: colors.text }]}>{viewingKyc?.aadhaarNumber || 'N/A'}</Text>
                            </View>
                            <View style={styles.kycDataRow}>
                                <Text style={[styles.kycLabel, { color: colors.textSecondary }]}>Date of Birth:</Text>
                                <Text style={[styles.kycValue, { color: colors.text }]}>
                                    {viewingKyc?.dateOfBirth?.toDate?.().toLocaleDateString() || 'N/A'}
                                </Text>
                            </View>

                            <View style={{ height: 20 }} />

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.rejectBtn, { flex: 1 }]}
                                    onPress={() => { const uid = viewingKyc.userId; setViewingKyc(null); setShowRejectModal(true); setSelectedUser({ id: uid }); }}
                                >
                                    <Ionicons name="close" size={20} color="#EF4444" />
                                    <Text style={styles.rejectBtnText}>Reject</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.verifyBtn, { flex: 1 }]}
                                    onPress={() => { handleVerifyKyc(viewingKyc.userId); setViewingKyc(null); }}
                                >
                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                    <Text style={styles.verifyBtnText}>Approve</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.lg,
    },
    backBtn: { padding: SPACING.xs },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: '#fff' },
    refreshBtn: { padding: SPACING.xs },

    // Tab Bar
    tabBar: { maxHeight: 60, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    tabBarContent: { paddingHorizontal: SPACING.sm },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginHorizontal: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.xs,
    },
    activeTabItem: { backgroundColor: '#EDE9FE' },
    tabLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },

    // Content
    content: { flex: 1, padding: SPACING.lg },

    // Stats Grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
    statCard: {
        width: (width - SPACING.lg * 2 - SPACING.md * 2) / 3,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    statIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
    statValue: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    statLabel: { fontSize: FONT_SIZE.xs, marginTop: 2 },

    // Section
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.md },
    sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    seeAll: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },

    // Quick Actions
    quickActions: { flexDirection: 'row', gap: SPACING.md },
    quickActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    quickActionText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    badge: { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 4 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    // KYC Cards
    kycCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    kycAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB', marginRight: SPACING.md },
    kycInfo: { flex: 1 },
    kycName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    kycEmail: { fontSize: FONT_SIZE.sm },
    approveBtn: { backgroundColor: '#10B981', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // KYC Detail
    kycDetailCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, marginBottom: SPACING.md },
    kycDetailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
    kycDetailAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E5E7EB', marginRight: SPACING.md },
    kycDetailInfo: { flex: 1 },
    kycDetailName: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    kycDetailEmail: { fontSize: FONT_SIZE.sm },
    kycDataRow: { flexDirection: 'row', marginBottom: SPACING.sm },
    kycLabel: { width: 80, fontSize: FONT_SIZE.sm },
    kycValue: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    kycDocImage: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.lg, marginVertical: SPACING.md },
    kycActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
    rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#FEE2E2', gap: SPACING.xs },
    rejectBtnText: { color: '#EF4444', fontWeight: FONT_WEIGHT.bold },
    verifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#10B981', gap: SPACING.xs },
    verifyBtnText: { color: '#fff', fontWeight: FONT_WEIGHT.bold },

    // Users
    searchBox: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md, gap: SPACING.sm },
    searchInput: { flex: 1, fontSize: FONT_SIZE.md },
    userCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB', marginRight: SPACING.md },
    userInfo: { flex: 1 },
    userName: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    userEmail: { fontSize: FONT_SIZE.sm },
    kycBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.md },
    kycBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

    // Feedback
    feedbackCard: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    feedbackBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.md, gap: 4, marginBottom: SPACING.sm },
    feedbackType: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase' },
    feedbackTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: 4 },
    feedbackDesc: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
    feedbackDate: { fontSize: FONT_SIZE.xs, marginTop: SPACING.sm, textAlign: 'right' },

    // Trips
    statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
    miniStat: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center' },
    miniStatValue: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
    miniStatLabel: { fontSize: FONT_SIZE.sm },
    tripCard: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.sm },
    tripImage: { width: 60, height: 60, borderRadius: BORDER_RADIUS.md, backgroundColor: '#E5E7EB', marginRight: SPACING.md },
    tripInfo: { flex: 1 },
    tripTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    tripLocation: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    tripParticipants: { fontSize: FONT_SIZE.xs, marginTop: 2 },
    tripDeleteBtn: { padding: SPACING.sm },

    // System
    systemCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl },
    systemTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.lg },
    systemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
    systemLabel: { fontSize: FONT_SIZE.md },
    systemValue: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.lg },
    emptyText: { fontSize: FONT_SIZE.md, marginTop: SPACING.sm },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    modalAvatar: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', backgroundColor: '#E5E7EB', marginBottom: SPACING.md },
    modalUserName: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
    modalEmail: { fontSize: FONT_SIZE.md, textAlign: 'center', marginBottom: SPACING.lg },
    modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
    modalLabel: { fontSize: FONT_SIZE.md },
    modalValue: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    deleteUserBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginTop: SPACING.xl, gap: SPACING.sm },
    deleteUserBtnText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },

    // Reject Modal
    rejectLabel: { fontSize: FONT_SIZE.md, marginBottom: SPACING.sm },
    rejectInput: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, fontSize: FONT_SIZE.md, minHeight: 100, textAlignVertical: 'top' },
    confirmRejectBtn: { backgroundColor: '#EF4444', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', marginTop: SPACING.lg },
    confirmRejectText: { color: '#fff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },

    // Reports
    reportCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    reportBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    reportBadgeText: { fontSize: 10, fontWeight: 'bold' },
    reportDate: { fontSize: 12 },
    reportTripTitle: { fontSize: FONT_SIZE.md, fontWeight: 'bold', marginBottom: 4 },
    reportStatus: { fontSize: FONT_SIZE.xs, marginBottom: 8 },
    reportDesc: { fontSize: FONT_SIZE.sm, marginBottom: SPACING.md },
    actionRow: { flexDirection: 'row', gap: SPACING.sm },
    reportActionBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center' },

});

export default AdminDashboardScreen;
