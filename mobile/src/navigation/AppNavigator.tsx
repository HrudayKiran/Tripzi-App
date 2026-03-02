import React from 'react';
import { NavigationContainer, DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Modal, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import { navigationRef } from './RootNavigation';
import OfflineBanner from '../components/OfflineBanner';
import auth from '@react-native-firebase/auth';

import usePushNotifications from '../hooks/usePushNotifications';
import usePermissions from '../hooks/usePermissions';

import LaunchScreen from '../screens/LaunchScreen';
import WelcomeScreen from '../screens/WelcomeScreen';

import StartScreen from '../screens/StartScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import AIChatScreen from '../screens/AIChatScreen';

import ChatsListScreen from '../screens/ChatsListScreen';
import ChatScreen from '../screens/ChatScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MessageSettingsScreen from '../screens/MessageSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const CreateTripTabPlaceholder = () => null;

const AppTabs = () => {
    const { colors } = useTheme();
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    usePushNotifications();
    usePermissions();

    const handleCreateTripPress = (navigation: any) => {
        setShowCreateModal(true);
    };

    const navigateToCreateTrip = () => {
        setShowCreateModal(false);
        const parentNav = navigationRef.current;
        if (parentNav) {
            parentNav.navigate('CreateTrip' as never);
        }
    };

    const navigateToAIPlanner = () => {
        setShowCreateModal(false);
        const parentNav = navigationRef.current;
        if (parentNav) {
            parentNav.navigate('App' as never, { screen: 'AITripPlanner' } as never);
        }
    };

    return (
        <>
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: true,
                    tabBarHideOnKeyboard: true,
                    tabBarStyle: {
                        backgroundColor: colors.card,
                        borderTopColor: colors.border,
                        borderTopWidth: 1,
                        height: 76,
                        paddingBottom: 10,
                        paddingTop: 8,
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textSecondary,
                    tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
                }}
            >
                <Tab.Screen
                    name="Home"
                    component={FeedScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="AITripPlanner"
                    component={AIChatScreen}
                    options={{
                        tabBarLabel: 'AI Planner',
                        tabBarIcon: ({ color, size }) => (
                            <View style={styles.aiTabIconWrap}>
                                <Image source={require('../../assets/Tripzi AI.png')} style={styles.aiTabIcon} />
                            </View>
                        ),
                    }}
                />
                <Tab.Screen
                    name="CreateTripTab"
                    component={CreateTripTabPlaceholder}
                    options={({ navigation }) => ({
                        tabBarLabel: '',
                        tabBarIcon: () => null,
                        tabBarButton: (props) => (
                            <TouchableOpacity
                                {...props}
                                style={[
                                    props.style,
                                    styles.createTripFab,
                                    {
                                        backgroundColor: '#9d74f7',
                                        borderColor: colors.card,
                                    },
                                ]}
                                onPress={() => handleCreateTripPress(navigation)}
                                activeOpacity={0.88}
                            >
                                <Ionicons name="add" size={30} color="#fff" />
                            </TouchableOpacity>
                        ),
                    })}
                />
                <Tab.Screen
                    name="Messages"
                    component={ChatsListScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
                    }}
                />
            </Tab.Navigator>

            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCreateModal(false)}
                >
                    <View style={[styles.createModalContent, { backgroundColor: colors.background }]}>
                        <Text style={[styles.createModalTitle, { color: colors.text }]}>Create New Trip</Text>

                        <TouchableOpacity
                            style={[styles.createOption, { backgroundColor: colors.card }]}
                            onPress={navigateToCreateTrip}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.createOptionIcon, { backgroundColor: '#E0E7FF' }]}>
                                <Ionicons name="create-outline" size={24} color="#9d74f7" />
                            </View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>Create a Trip Manually</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Fill in details and add your own photos</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.createOption, { backgroundColor: colors.card }]}
                            onPress={navigateToAIPlanner}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.createOptionIcon, { backgroundColor: '#EDE9FE' }]}>
                                <View style={styles.tripziAiIconWrap}>
                                    <Image source={require('../../assets/Tripzi AI.png')} style={styles.tripziAiIcon} />
                                </View>
                            </View>
                            <View style={styles.createOptionText}>
                                <Text style={[styles.createOptionTitle, { color: colors.text }]}>Create with Tripzi AI</Text>
                                <Text style={[styles.createOptionDesc, { color: colors.textSecondary }]}>Let AI plan and generate images for you</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </>
    )
};

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = React.useState<string | null>(null);
    const userRef = React.useRef(auth().currentUser);
    const wasLoggedInRef = React.useRef<boolean>(!!auth().currentUser);

    React.useEffect(() => {
        // Check auth state AND Firestore profile on mount
        const checkAuthAndProfile = async () => {
            const currentUser = auth().currentUser;

            if (currentUser) {
                // User is authenticated - but do they have a Firestore profile?
                try {
                    const firestore = require('@react-native-firebase/firestore').default;
                    const userDoc = await firestore().collection('users').doc(currentUser.uid).get();

                    // Handle both Firebase API versions (exists as property or function)
                    const docExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;

                    if (docExists) {
                        // User has both Auth AND Firestore profile → Go to App
                        setInitialRoute('App');
                    } else {
                        // User has Auth but NO Firestore profile → Continue onboarding flow
                        setInitialRoute('CompleteProfile');
                    }
                } catch (error) {
                    // Error checking profile → Sign out and show auth flow
                    await auth().signOut();
                    setInitialRoute('Launch');
                }
            } else {
                // User is NOT logged in → Show LaunchScreen flow
                setInitialRoute('Launch');
            }
        };

        checkAuthAndProfile();

        // Listen for auth changes during runtime (login/logout)
        // Navigation is handled explicitly by StartScreen (login) and ProfileScreen (logout).
        // This listener only tracks auth state via ref — NO setState to avoid
        // re-rendering AppNavigator which would remount NavigationContainer.
        const unsubscribe = auth().onAuthStateChanged((userState) => {
            userRef.current = userState;
            wasLoggedInRef.current = !!userState;
        });

        return unsubscribe;
    }, []);

    // Show nothing (or a minimal splash) until we determine the initial route
    if (!initialRoute) {
        return (
            <ThemeProvider>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9d74f7" />
                </View>
            </ThemeProvider>
        );
    }

    const linking = {
        prefixes: ['tripzi://', 'https://tripzi.com'],
        config: {
            screens: {
                // Auth


                // Profile
                UserProfile: 'user/:userId',

                // Fallback to App tabs
                App: {
                    screens: {
                        Home: 'feed',

                        Messages: 'messages',
                        Profile: 'profile',
                    }
                }
            }
        }
    };

    const ThemedNavigation = () => {
        const { colors, isDarkMode } = useTheme();
        const navigationTheme = {
            ...(isDarkMode ? NavigationDarkTheme : NavigationDefaultTheme),
            colors: {
                ...(isDarkMode ? NavigationDarkTheme.colors : NavigationDefaultTheme.colors),
                background: colors.background,
                card: colors.card,
                text: colors.text,
                border: colors.border,
                primary: colors.primary,
            },
        };
        return (
            <NavigationContainer ref={navigationRef} linking={linking} theme={navigationTheme}>
                <Stack.Navigator
                    initialRouteName={initialRoute}
                    screenOptions={{
                        headerShown: false,
                        cardStyleInterpolator: ({ current, layouts }) => ({
                            cardStyle: {
                                backgroundColor: colors.background,
                                transform: [
                                    {
                                        translateX: current.progress.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [layouts.screen.width, 0],
                                        }),
                                    },
                                ],
                            },
                        }),
                        cardStyle: { backgroundColor: colors.background },
                        gestureEnabled: false,
                    }}
                >
                    {/* Auth Flow Screens */}
                    <Stack.Screen name="Launch" component={LaunchScreen} />
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />

                    <Stack.Screen name="Start" component={StartScreen} />
                    <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />

                    {/* Main App */}
                    <Stack.Screen
                        name="App"
                        component={AppTabs}
                        options={{ gestureEnabled: false }}
                    />

                    {/* Other Screens */}
                    <Stack.Screen name="MyTrips" component={MyTripsScreen} />
                    <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
                    <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
                    <Stack.Screen name="AIChat" component={AIChatScreen} />

                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="Map" component={MapScreen} />
                    <Stack.Screen name="CreateGroupChat" component={CreateGroupScreen} />
                    <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
                    <Stack.Screen name="Terms" component={TermsScreen} />
                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                    <Stack.Screen name="SuggestFeature" component={SuggestFeatureScreen} />
                    <Stack.Screen name="MessageSettings" component={MessageSettingsScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} />

                </Stack.Navigator>
            </NavigationContainer>
        );
    };

    return (
        <ThemeProvider>
            <NetworkProvider>
                <ThemedNavigation />
                <OfflineBanner />
            </NetworkProvider>
        </ThemeProvider >
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000', // Dark background for instant feel
    },
    createTripFab: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -38,
        shadowColor: '#9d74f7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 10,
    },
    aiTabIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
    },
    aiTabIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    createModalContent: {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 32,
    },
    createModalTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
    },
    createOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    createOptionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    createOptionText: {
        flex: 1,
    },
    createOptionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    createOptionDesc: {
        fontSize: 13,
    },
    tripziAiIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        overflow: 'hidden',
    },
    tripziAiIcon: {
        width: '100%',
        height: '100%',
    },
});

export default AppNavigator;
