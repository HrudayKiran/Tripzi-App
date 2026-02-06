import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import OnboardingScreen from '../screens/OnboardingScreen';
import StartScreen from '../screens/StartScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import FeedScreen from '../screens/FeedScreen';
import MomentsScreen from '../screens/MomentsScreen';
import SearchScreen from '../screens/SearchScreen';
import MyTripsScreen from '../screens/MyTripsScreen';

import ChatsListScreen from '../screens/ChatsListScreen';
import ChatScreen from '../screens/ChatScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import MapScreen from '../screens/MapScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupInfoScreen from '../screens/GroupInfoScreen';
import StoriesScreen from '../screens/StoriesScreen';
import KycScreen from '../screens/KycScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UsernameSetupScreen from '../screens/UsernameSetupScreen';
import GoogleProfileScreen from '../screens/GoogleProfileScreen';
import PhoneVerificationScreen from '../screens/PhoneVerificationScreen';
import MessageSettingsScreen from '../screens/MessageSettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AppTabs = () => {
    const { colors } = useTheme();
    usePushNotifications();
    usePermissions();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarHideOnKeyboard: true,
                tabBarStyle: {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 70,
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
                name="Search"
                component={SearchScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
                }}
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
    )
};

const AppNavigator = () => {
    const [initialRoute, setInitialRoute] = React.useState<string | null>(null);
    const [user, setUser] = React.useState(auth().currentUser);

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
                        // User has Auth but NO Firestore profile → Sign them out, show auth flow
                        await auth().signOut();
                        setInitialRoute('Launch');
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

        // Also listen for auth changes during runtime
        const unsubscribe = auth().onAuthStateChanged(async (userState) => {
            console.log('[AppNavigator] onAuthStateChanged fired. User:', userState?.uid || 'null');
            setUser(userState);

            // If user just signed in, verify they have a Firestore profile
            if (userState && navigationRef.current) {
                try {
                    console.log('[AppNavigator] Checking Firestore for user profile...');
                    const firestore = require('@react-native-firebase/firestore').default;

                    // Retry logic to handle race condition during sign-up
                    // The Firestore document might not exist immediately after creation
                    let docExists = false;
                    const maxRetries = 3;
                    const retryDelay = 1000; // 1 second

                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                        const userDoc = await firestore().collection('users').doc(userState.uid).get();
                        docExists = typeof userDoc.exists === 'function' ? userDoc.exists() : userDoc.exists;
                        console.log(`[AppNavigator] Firestore check attempt ${attempt + 1}. Exists:`, docExists);

                        if (docExists) break;

                        // Wait before retrying (but not after the last attempt)
                        if (attempt < maxRetries - 1) {
                            console.log('[AppNavigator] Doc not found, waiting before retry...');
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        }
                    }

                    if (!docExists) {
                        // User has no Firestore profile after retries - sign them out
                        console.log('[AppNavigator] User has NO profile after retries, signing out...');
                        await auth().signOut();
                        return;
                    }
                    console.log('[AppNavigator] User HAS profile, allowing navigation');
                } catch (error: any) {
                    // Error checking - sign out to be safe
                    console.log('[AppNavigator] Firestore error:', error.message);
                    await auth().signOut();
                    return;
                }
            }

            // Handle runtime logout
            if (!userState && navigationRef.current) {
                console.log('[AppNavigator] User logged out, resetting to Welcome');
                navigationRef.current.reset({
                    index: 1,
                    routes: [{ name: 'Welcome' }, { name: 'Start' }],
                });
            }
        });

        return unsubscribe;
    }, []);

    // Show nothing (or a minimal splash) until we determine the initial route
    if (!initialRoute) {
        return (
            <ThemeProvider>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#895af6" />
                </View>
            </ThemeProvider>
        );
    }

    const linking = {
        prefixes: ['tripzi://', 'https://tripzi.com'],
        config: {
            screens: {
                // Auth
                SignIn: 'signin',
                SignUp: 'signup',

                // Deep link into TripeDetails directly
                TripDetails: 'trip/:tripId',

                // Profile
                UserProfile: 'user/:userId',

                // Fallback to App tabs
                App: {
                    screens: {
                        Home: 'feed',
                        Moments: 'moments',
                        Messages: 'messages',
                        Profile: 'profile',
                    }
                }
            }
        }
    };

    return (
        <ThemeProvider>
            <NetworkProvider>
                <NavigationContainer ref={navigationRef} linking={linking}>
                    <Stack.Navigator
                        initialRouteName={initialRoute}
                        screenOptions={{
                            headerShown: false,
                            cardStyleInterpolator: ({ current, layouts }) => ({
                                cardStyle: {
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
                            gestureEnabled: false,
                        }}
                    >
                        {/* Auth Flow Screens */}
                        <Stack.Screen name="Launch" component={LaunchScreen} />
                        <Stack.Screen name="Welcome" component={WelcomeScreen} />
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                        <Stack.Screen name="Start" component={StartScreen} />
                        <Stack.Screen name="SignIn" component={SignInScreen} />
                        <Stack.Screen name="SignUp" component={SignUpScreen} />
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

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

                        <Stack.Screen name="Chat" component={ChatScreen} />
                        <Stack.Screen name="Comments" component={CommentsScreen} />
                        <Stack.Screen name="Map" component={MapScreen} />
                        <Stack.Screen name="CreateGroupChat" component={CreateGroupScreen} />
                        <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
                        <Stack.Screen name="Stories" component={StoriesScreen} />
                        <Stack.Screen name="KYC" component={KycScreen} />
                        <Stack.Screen name="KycScreen" component={KycScreen} />
                        <Stack.Screen name="Terms" component={TermsScreen} />
                        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
                        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                        <Stack.Screen name="SuggestFeature" component={SuggestFeatureScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                        <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
                        <Stack.Screen name="GoogleProfile" component={GoogleProfileScreen} />
                        <Stack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
                        <Stack.Screen name="MessageSettings" component={MessageSettingsScreen} />
                    </Stack.Navigator>
                </NavigationContainer>
                <OfflineBanner />
            </NetworkProvider>
        </ThemeProvider>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000', // Dark background for instant feel
    },
});

export default AppNavigator;
