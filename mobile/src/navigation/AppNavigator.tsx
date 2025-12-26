
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import MapScreen from '../screens/MapScreen';
import CreateTripScreen from '../screens/CreateTripScreen'; // Import the new screen

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main application tabs for authenticated users
const AppTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Map" component={MapScreen} />
    <Tab.Screen name="My Trips" component={TripsScreen} />
  </Tab.Navigator>
);

// Handles the overall navigation flow
const AppNavigator = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup on unmount
  }, []);

  if (loading) {
    // You might want to render a splash screen here
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is signed in, show the main app with tabs
          <>
            <Stack.Screen name="App" component={AppTabs} />
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
          </>
        ) : (
          // No user is signed in, show the login screen
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
