import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { navigationRef } from './RootNavigation';

import usePushNotifications from '../hooks/usePushNotifications';

import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import StartScreen from '../screens/StartScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import FeedScreen from '../screens/FeedScreen';
import MyTripsScreen from '../screens/MyTripsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MessageScreen from '../screens/MessageScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import MapScreen from '../screens/MapScreen';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import CreateGroupChatScreen from '../screens/CreateGroupChatScreen';
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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AppTabs = () => {
    const { colors } = useTheme();
    usePushNotifications();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarStyle: {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
                name="My Trips"
                component={MyTripsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
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
    return (
        <ThemeProvider>
            <NavigationContainer ref={navigationRef}>
                <Stack.Navigator
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
                        gestureEnabled: true,
                        gestureDirection: 'horizontal',
                    }}
                >
                    <Stack.Screen name="Splash" component={SplashScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    <Stack.Screen name="Start" component={StartScreen} />
                    <Stack.Screen name="SignIn" component={SignInScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="App" component={AppTabs} />
                    <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
                    <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
                    <Stack.Screen name="Message" component={MessageScreen} />
                    <Stack.Screen name="Comments" component={CommentsScreen} />
                    <Stack.Screen name="Map" component={MapScreen} />
                    <Stack.Screen name="CreateGroupChat" component={CreateGroupChatScreen} />
                    <Stack.Screen name="KYC" component={KycScreen} />
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
                </Stack.Navigator>
            </NavigationContainer>
        </ThemeProvider>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
});

export default AppNavigator;
