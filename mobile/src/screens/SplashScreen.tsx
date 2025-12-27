import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image } from 'react-native';

const SplashScreen = ({ navigation }) => {
  const handleNext = () => {
    navigation.replace('Start');
  };

  return (
    <View style={styles.container}>
      {/* Mountain Image Card */}
      <View style={styles.imageCard}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' }}
          style={styles.imageBackground}
          imageStyle={styles.imageStyle}
        >
          {/* Location Badge */}
          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>Leh Palace</Text>
          </View>

          {/* Page Dots */}
          <View style={styles.dotsContainer}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </ImageBackground>
      </View>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.rocketEmoji}>🚀</Text>
        </View>
      </View>

      {/* App Name and Tagline */}
      <Text style={styles.appName}>Tripzi</Text>
      <Text style={styles.tagline}>
        Explore the world, <Text style={styles.taglineHighlight}>not alone</Text>.
      </Text>
      <Text style={styles.joinText}>JOIN THE JOURNEY</Text>

      {/* Next Button */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3EF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  imageCard: {
    width: '100%',
    height: '55%',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  imageBackground: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  imageStyle: {
    borderRadius: 30,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  logoContainer: {
    marginTop: 30,
    marginBottom: 10,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E8D5FF',
    elevation: 3,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  rocketEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  taglineHighlight: {
    color: '#8A2BE2',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  joinText: {
    fontSize: 12,
    color: '#999',
    letterSpacing: 2,
    marginTop: 20,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 18,
    paddingHorizontal: 140,
    borderRadius: 30,
    marginTop: 30,
    elevation: 3,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default SplashScreen;
