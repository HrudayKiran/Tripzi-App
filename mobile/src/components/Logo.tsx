
import React from 'react';
import { Text, StyleSheet } from 'react-native';

const Logo = () => {
  return <Text style={styles.logo}>Tripzi</Text>;
};

const styles = StyleSheet.create({
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8A2BE2',
  },
});

export default Logo;
