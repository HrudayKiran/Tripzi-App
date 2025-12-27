
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Logo from '../components/Logo';
import auth from '@react-native-firebase/auth';

const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (user) {
        navigation.replace('App');
      } else {
        navigation.replace('Start');
      }
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Logo />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default SplashScreen;
