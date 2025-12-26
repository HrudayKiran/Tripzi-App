
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Booking } from '../hooks/useTrips';

interface TripCardProps {
  booking: Booking;
  onPress: () => void;
}

const TripCard: React.FC<TripCardProps> = ({ booking, onPress }) => {
  const { trip } = booking;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { backgroundColor: '#10B981' }; // Green-500
      case 'pending':
        return { backgroundColor: '#F59E0B' }; // Amber-500
      default:
        return { backgroundColor: '#6B7280' }; // Gray-500
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {/* Image Placeholder */}
      <View style={styles.imagePlaceholder} />
      <View style={[styles.badge, getStatusStyle(booking.status)]}>
        <Text style={styles.badgeText}>{booking.status}</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>{trip.title}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>{trip.destination}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>
            {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>{trip.current_travelers} / {trip.max_travelers} travelers</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    height: 130,
    backgroundColor: '#E5E7EB', // Gray-200
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#4B5563', // Gray-600
    marginLeft: 4,
  },
});

export default TripCard;
