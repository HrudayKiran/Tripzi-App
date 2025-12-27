
import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AppTabs = () => {
    const navigation = useNavigation();
    usePushNotifications();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: styles.tabBar,
            }}
        >
            <Tab.Screen 
                name="Home" 
                component={FeedScreen} 
                options={{
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="home-outline" size={size} color={color} />,
                }}
            />
            <Tab.Screen 
                name="My Trips" 
                component={MyTripsScreen} 
                options={{
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="map-outline" size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="CreateTripTab"
                component={() => null}
                options={{
                    tabBarButton: () => (
                        <TouchableOpacity
                            style={styles.plusButton}
                            onPress={() => navigation.navigate('CreateTrip')}
                        >
                            <Ionicons name="add" size={32} color="#fff" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <Tab.Screen 
                name="Messages" 
                component={MessagesScreen} 
                options={{
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />,
                }}
            />
            <Tab.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{
                    tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name="person-outline" size={size} color={color} />,
                }}
            />
        </Tab.Navigator>
    )
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Start" component={StartScreen} />
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="App" component={AppTabs} />
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
            <Stack.Screen name="Message" component={MessageScreen} />
            <Stack.Screen name="Comments" component={CommentsScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
            <Stack.Screen name="CreateGroupChat" component={CreateGroupChatScreen} />
            <Stack.Screen name="Kyc" component={KycScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="SuggestFeature" component={SuggestFeatureScreen} />
        </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 25,
        left: 20,
        right: 20,
        
        backgroundColor: '#ffffff',
        borderRadius: 15,
        height: 70,
        shadowColor: '#7F5DF0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 3.5,
        elevation: 5
    },
    plusButton: {
        top: -30,
        justifyContent: 'center',
        alignItems: 'center',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#8A2BE2',
    },
});

export default AppNavigator;
