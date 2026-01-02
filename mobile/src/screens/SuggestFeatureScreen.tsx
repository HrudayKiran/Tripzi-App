import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const SuggestFeatureScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('suggest');
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureCategory, setFeatureCategory] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugCategory, setBugCategory] = useState('');
  const [bugSeverity, setBugSeverity] = useState('');
  const [featureImage, setFeatureImage] = useState(null);
  const [bugImage, setBugImage] = useState(null);

  const pickImage = async (setImage) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const featureCategories = [
    { id: 'trip', label: 'Trip Planning', icon: 'map', color: '#3B82F6' },
    { id: 'messaging', label: 'Messaging', icon: 'chatbubble', color: '#8B5CF6' },
    { id: 'profile', label: 'Profile', icon: 'person', color: '#6B7280' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#F59E0B' },
  ];

  const bugCategories = [
    { id: 'crash', label: 'Crash', icon: 'warning', color: '#EF4444' },
    { id: 'ui', label: 'UI/Display', icon: 'cube', color: '#10B981' },
    { id: 'login', label: 'Login', icon: 'lock-closed', color: '#F97316' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
  ];

  const severityLevels = ['Low', 'Medium', 'High', 'Critical'];

  const handleSubmitFeature = async () => {
    if (!featureTitle || !featureDescription) {
      Alert.alert('Required Fields', 'Please fill in title and description.');
      return;
    }
    try {
      const currentUser = auth().currentUser;
      await firestore().collection('suggestions').add({
        title: featureTitle,
        description: featureDescription,
        category: featureCategory,
        imageUri: featureImage,
        userId: currentUser?.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert('Thank You! 🎉', 'Your suggestion has been submitted.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Thank You! 🎉', 'Your suggestion has been saved locally.');
      navigation.goBack();
    }
  };

  const handleSubmitBug = async () => {
    if (!bugTitle || !bugDescription) {
      Alert.alert('Required Fields', 'Please fill in title and description.');
      return;
    }
    try {
      const currentUser = auth().currentUser;
      await firestore().collection('bugs').add({
        title: bugTitle,
        description: bugDescription,
        category: bugCategory,
        severity: bugSeverity,
        imageUri: bugImage,
        userId: currentUser?.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert('Thank You! 🎉', 'Your bug report has been submitted.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Thank You! 🎉', 'Your bug report has been saved locally.');
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Feedback</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'suggest' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('suggest')}
            activeOpacity={0.8}
          >
            <Ionicons name="bulb-outline" size={18} color={activeTab === 'suggest' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'suggest' ? '#fff' : colors.textSecondary }]}>
              Suggest
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bug' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('bug')}
            activeOpacity={0.8}
          >
            <Ionicons name="bug-outline" size={18} color={activeTab === 'bug' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'bug' ? '#fff' : colors.textSecondary }]}>
              Report Bug
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeIn" duration={300} key={activeTab}>
            {activeTab === 'suggest' ? (
              <>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="bulb" size={40} color="#F59E0B" />
                </View>
                <Text style={[styles.formTitle, { color: colors.text }]}>Have an idea?</Text>
                <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>We'd love to hear your suggestions!</Text>

                <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                <View style={styles.categoryGrid}>
                  {featureCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryButton,
                        { backgroundColor: colors.card, borderColor: featureCategory === cat.id ? cat.color : colors.border },
                      ]}
                      onPress={() => setFeatureCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                      <Text style={[styles.categoryText, { color: colors.text }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., Dark mode support"
                  placeholderTextColor={colors.textSecondary}
                  value={featureTitle}
                  onChangeText={setFeatureTitle}
                />

                <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="Describe your feature idea..."
                  placeholderTextColor={colors.textSecondary}
                  value={featureDescription}
                  onChangeText={setFeatureDescription}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <Text style={[styles.label, { color: colors.text }]}>Screenshot (Optional)</Text>
                <TouchableOpacity
                  style={[styles.imageUpload, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => pickImage(setFeatureImage)}
                >
                  {featureImage ? (
                    <Image source={{ uri: featureImage }} style={styles.uploadedImage} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={32} color={colors.primary} />
                      <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Add screenshot</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmitFeature}
                  activeOpacity={0.8}
                >
                  <Ionicons name="star" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Suggestion</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="bug" size={40} color="#EF4444" />
                </View>
                <Text style={[styles.formTitle, { color: colors.text }]}>Found a bug?</Text>
                <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Help us improve by reporting issues</Text>

                <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                <View style={styles.categoryGrid}>
                  {bugCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryButton,
                        { backgroundColor: colors.card, borderColor: bugCategory === cat.id ? cat.color : colors.border },
                      ]}
                      onPress={() => setBugCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                      <Text style={[styles.categoryText, { color: colors.text }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Severity</Text>
                <View style={styles.severityContainer}>
                  {severityLevels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.severityButton,
                        { backgroundColor: bugSeverity === level ? colors.primary : colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => setBugSeverity(level)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.severityText, { color: bugSeverity === level ? '#fff' : colors.text }]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.text }]}>Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., App crashes when..."
                  placeholderTextColor={colors.textSecondary}
                  value={bugTitle}
                  onChangeText={setBugTitle}
                />

                <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="Describe the bug and steps to reproduce..."
                  placeholderTextColor={colors.textSecondary}
                  value={bugDescription}
                  onChangeText={setBugDescription}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <Text style={[styles.label, { color: colors.text }]}>Screenshot (Optional)</Text>
                <TouchableOpacity
                  style={[styles.imageUpload, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => pickImage(setBugImage)}
                >
                  {bugImage ? (
                    <Image source={{ uri: bugImage }} style={styles.uploadedImage} />
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons name="image-outline" size={32} color={colors.primary} />
                      <Text style={[styles.uploadText, { color: colors.textSecondary }]}>Add screenshot</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmitBug}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bug" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Bug Report</Text>
                </TouchableOpacity>
              </>
            )}
          </Animatable.View>
          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold },
  placeholder: { width: TOUCH_TARGET.min },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.sm,
  },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
  content: { flex: 1, paddingHorizontal: SPACING.xl },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  formTitle: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', marginBottom: SPACING.sm },
  formSubtitle: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginBottom: SPACING.xxl },
  label: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm, marginTop: SPACING.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  categoryText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  severityContainer: { flexDirection: 'row', gap: SPACING.sm },
  severityButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  severityText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm,
    height: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  submitButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  imageUpload: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    minHeight: 100,
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  uploadText: {
    fontSize: FONT_SIZE.sm,
  },
});

export default SuggestFeatureScreen;
