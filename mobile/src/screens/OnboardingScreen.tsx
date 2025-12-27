
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Logo from '../components/Logo';

const OnboardingScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: 'https://i.imgur.com/your-image-url.jpg' }} // Replace with your image URL
        style={styles.carouselImage}
      />
      <View style={styles.logoContainer}>
        <Logo />
      </View>
      <Text style={styles.subtitle}>
        Explore the world, <Text style={styles.notAlone}>not alone.</Text>
      </Text>
      <Text style={styles.joinJourney}>JOIN THE JOURNEY</Text>
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={() => navigation.navigate('Start')}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  carouselImage: {
    width: '90%',
    height: '60%',
    borderRadius: 30,
    marginTop: 50,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
  },
  notAlone: {
    color: '#8A2BE2',
  },
  joinJourney: {
    color: '#666',
    marginTop: 20,
    letterSpacing: 2,
  },
  nextButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 15,
    paddingHorizontal: 120,
    borderRadius: 25,
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;
