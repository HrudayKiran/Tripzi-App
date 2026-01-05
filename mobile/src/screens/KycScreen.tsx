import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';
import { validateAadhaar, formatAadhaar, maskAadhaar } from '../utils/aadhaarValidator';

const KycScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarImage, setAadhaarImage] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ aadhaar?: string; aadhaarImage?: string; userImage?: string; dob?: string }>({});

  const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      setErrors(prev => ({ ...prev, dob: undefined }));
    }
  };

  const pickImage = async (setImage: (uri: string) => void, type: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: type === 'aadhaar' ? [16, 10] : [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      setErrors(prev => ({ ...prev, [type === 'aadhaar' ? 'aadhaarImage' : 'userImage']: undefined }));
    }
  };

  const uploadImageToStorage = async (uri: string, path: string): Promise<string> => {
    const reference = storage().ref(path);
    await reference.putFile(uri);
    return await reference.getDownloadURL();
  };

  const handleSubmitKyc = async () => {
    const newErrors: typeof errors = {};

    // Validate Aadhaar using Verhoeff algorithm
    if (!aadhaarNumber) {
      newErrors.aadhaar = 'Aadhaar number is required';
    } else {
      const aadhaarValidation = validateAadhaar(aadhaarNumber);
      if (!aadhaarValidation.valid) {
        newErrors.aadhaar = aadhaarValidation.error || 'Invalid Aadhaar number';
      }
    }

    if (!dateOfBirth) {
      newErrors.dob = 'Date of birth is required';
    } else if (calculateAge(dateOfBirth) < 18) {
      newErrors.dob = 'You must be at least 18 years old';
    }

    if (!aadhaarImage) {
      newErrors.aadhaarImage = 'Aadhaar card image is required';
    }

    if (!userImage) {
      newErrors.userImage = 'Passport photo is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setUploading(true);
    const currentUser = auth().currentUser;

    try {
      // Upload images to Firebase Storage
      const aadhaarImageUrl = await uploadImageToStorage(
        aadhaarImage!,
        `kyc/${currentUser!.uid}/aadhaar_${Date.now()}.jpg`
      );
      const selfieImageUrl = await uploadImageToStorage(
        userImage!,
        `kyc/${currentUser!.uid}/selfie_${Date.now()}.jpg`
      );

      // Create KYC document in dedicated collection
      await firestore().collection('kyc').add({
        userId: currentUser!.uid,
        status: 'pending',
        dateOfBirth: firestore.Timestamp.fromDate(dateOfBirth!),
        ageVerified: calculateAge(dateOfBirth!) >= 18,
        aadhaarNumber: aadhaarNumber, // Consider hashing in production
        aadhaarImageUrl,
        selfieImageUrl,
        submittedAt: firestore.FieldValue.serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      });

      // Update user's kycStatus
      await firestore().collection('users').doc(currentUser!.uid).update({
        kycStatus: 'pending',
      });

      setUploading(false);
      Alert.alert('Success! 🎉', 'KYC submitted for verification. You will be notified once verified.');
      navigation.goBack();
    } catch (error) {
      console.error('KYC submission error:', error);
      setUploading(false);
      Alert.alert('Error', 'Failed to submit KYC. Please try again.');
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Info Card */}
        <Animatable.View animation="fadeInUp" style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.iconGradient}>
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
          </LinearGradient>
          <Text style={[styles.infoTitle, { color: colors.text }]}>Why KYC?</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            KYC verification helps us maintain a safe community. Verified users get a verification badge and can create & join trips.
          </Text>
        </Animatable.View>

        {/* Instructions */}
        <Animatable.View animation="fadeInUp" delay={100} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Instructions</Text>
          <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.stepText, { color: colors.primary }]}>1</Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.text }]}>Enter your 12-digit Aadhaar number</Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.stepText, { color: colors.primary }]}>2</Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.text }]}>Upload a clear photo of your Aadhaar card (front side)</Text>
            </View>
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.stepText, { color: colors.primary }]}>3</Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.text }]}>Upload a passport-size photo (face clearly visible)</Text>
            </View>
          </View>
        </Animatable.View>

        {/* Form */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.section}>
          {/* Aadhaar Number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Aadhaar Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, color: colors.text, borderColor: errors.aadhaar ? '#EF4444' : colors.border }
              ]}
              placeholder="Enter 12-digit Aadhaar number"
              placeholderTextColor={colors.textSecondary}
              value={aadhaarNumber}
              onChangeText={(text) => {
                setAadhaarNumber(text);
                setErrors(prev => ({ ...prev, aadhaar: null }));
              }}
              keyboardType="numeric"
              maxLength={12}
            />
            {errors.aadhaar && <Text style={styles.errorText}>{errors.aadhaar}</Text>}
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Date of Birth <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.datePickerButton,
                { backgroundColor: colors.inputBackground, borderColor: errors.dob ? '#EF4444' : colors.border }
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.dateText, { color: dateOfBirth ? colors.text : colors.textSecondary }]}>
                {dateOfBirth ? formatDate(dateOfBirth) : 'Select your date of birth'}
              </Text>
            </TouchableOpacity>
            {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
            {dateOfBirth && calculateAge(dateOfBirth) >= 18 && (
              <View style={styles.ageVerifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.ageVerifiedText}>Age verified (18+)</Text>
              </View>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth || new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
            />
          )}

          {/* Aadhaar Image */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Aadhaar Card Photo <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.imagePicker,
                { backgroundColor: colors.card, borderColor: errors.aadhaarImage ? '#EF4444' : colors.border }
              ]}
              onPress={() => pickImage(setAadhaarImage, 'aadhaar')}
            >
              {aadhaarImage ? (
                <Image source={{ uri: aadhaarImage }} style={styles.previewImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="card-outline" size={40} color={colors.primary} />
                  <Text style={[styles.uploadText, { color: colors.text }]}>Upload Aadhaar Card</Text>
                  <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>
            {errors.aadhaarImage && <Text style={styles.errorText}>{errors.aadhaarImage}</Text>}
          </View>

          {/* Passport Photo */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Passport Photo <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.imagePicker,
                { backgroundColor: colors.card, borderColor: errors.userImage ? '#EF4444' : colors.border }
              ]}
              onPress={() => pickImage(setUserImage, 'user')}
            >
              {userImage ? (
                <Image source={{ uri: userImage }} style={styles.previewImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="person-outline" size={40} color={colors.primary} />
                  <Text style={[styles.uploadText, { color: colors.text }]}>Upload Your Photo</Text>
                  <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>Clear face, white background</Text>
                </View>
              )}
            </TouchableOpacity>
            {errors.userImage && <Text style={styles.errorText}>{errors.userImage}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity onPress={handleSubmitKyc} disabled={uploading} style={styles.submitContainer}>
            <LinearGradient
              colors={uploading ? ['#9CA3AF', '#9CA3AF'] : ['#8B5CF6', '#EC4899']}
              style={styles.submitButton}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit for Verification</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animatable.View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  infoCard: { margin: SPACING.lg, padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
  iconGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  infoTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  infoText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 22 },
  section: { paddingHorizontal: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  instructionCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, gap: SPACING.md },
  instructionItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  stepNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepText: { fontWeight: FONT_WEIGHT.bold },
  instructionText: { flex: 1, fontSize: FONT_SIZE.sm },
  inputGroup: { marginTop: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm },
  required: { color: '#EF4444' },
  input: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, fontSize: FONT_SIZE.md },
  errorText: { color: '#EF4444', fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  imagePicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, alignItems: 'center', minHeight: 140 },
  uploadPlaceholder: { alignItems: 'center', gap: SPACING.xs },
  uploadText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  uploadHint: { fontSize: FONT_SIZE.xs },
  previewImage: { width: 120, height: 120, borderRadius: BORDER_RADIUS.md },
  submitContainer: { marginTop: SPACING.xl },
  submitButton: { flexDirection: 'row', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  submitButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  // DOB Picker styles
  datePickerButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  dateText: { flex: 1, fontSize: FONT_SIZE.md },
  ageVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  ageVerifiedText: { color: '#10B981', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
});

export default KycScreen;
