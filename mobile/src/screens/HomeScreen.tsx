
import React from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { AdMobBanner } from 'expo-ads-admob';

const HomeScreen = ({ navigation }) => { // Add navigation prop
  const auth = getAuth();

  const handleSignOut = () => {
    auth.signOut().catch(error => alert(error.message));
  };

  // AdMob Banner Ad Unit ID
  const bannerAdUnitId = Platform.select({
    // Replace with your actual Ad Unit ID for iOS
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy',
    // Replace with your actual Ad Unit ID for Android
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy',
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Home Screen</Text>
        <Text style={styles.email}>Welcome, {auth.currentUser?.email}</Text>
        <Button title="Sign Out" onPress={handleSignOut} />
        <View style={styles.buttonSpacer} />
        <Button title="Create a New Trip" onPress={() => navigation.navigate('CreateTrip')} />
      </View>
      {bannerAdUnitId && (
        <AdMobBanner
          bannerSize="fullBanner"
          adUnitID={bannerAdUnitId}
          servePersonalizedAds // Optional
          onDidFailToReceiveAdWithError={error => console.error(error)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  email: {
    fontSize: 18,
    marginBottom: 20,
  },
  buttonSpacer: {
    height: 10,
  }
});

export default HomeScreen;
