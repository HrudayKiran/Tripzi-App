
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const HelpSupportScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help and Support</Text>
      <Text style={styles.content}>
        For any help or support, please contact us at support@tripzi.app
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default HelpSupportScreen;
