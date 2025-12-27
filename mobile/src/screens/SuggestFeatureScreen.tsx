
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const SuggestFeatureScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('suggest'); // 'suggest' or 'bug'

  // Suggest Feature states
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureCategory, setFeatureCategory] = useState('');

  // Report Bug states
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugCategory, setBugCategory] = useState('');
  const [bugSeverity, setBugSeverity] = useState('');

  const featureCategories = [
    { id: 'trip', label: 'Trip Planning', icon: 'map', color: '#3B82F6' },
    { id: 'messaging', label: 'Messaging', icon: 'chatbubble', color: '#8B5CF6' },
    { id: 'profile', label: 'Profile', icon: 'person', color: '#6B7280' },
    { id: 'payments', label: 'Payments', icon: 'card', color: '#06B6D4' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#F59E0B' },
  ];

  const bugCategories = [
    { id: 'crash', label: 'Crash/Freeze', icon: 'warning', color: '#EF4444' },
    { id: 'ui', label: 'UI/Display', icon: 'cube', color: '#10B981' },
    { id: 'login', label: 'Login/Auth', icon: 'lock-closed', color: '#F97316' },
    { id: 'data', label: 'Data Issues', icon: 'analytics', color: '#3B82F6' },
    { id: 'performance', label: 'Performance', icon: 'flash', color: '#FBBF24' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#9CA3AF' },
  ];

  const severityLevels = ['Low', 'Medium', 'High', 'Critical'];

  const handleSubmitFeature = async () => {
    if (!featureTitle || !featureDescription) {
      alert('Please fill in all fields');
      return;
    }

    const currentUser = auth.currentUser;
    await firestore().collection('suggestions').add({
      title: featureTitle,
      description: featureDescription,
      category: featureCategory,
      userId: currentUser.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    alert('Thank you! Your suggestion has been submitted.');
    navigation.goBack();
  };

  const handleSubmitBug = async () => {
    if (!bugTitle || !bugDescription) {
      alert('Please fill in all fields');
      return;
    }

    const currentUser = auth.currentUser;
    await firestore().collection('bugs').add({
      title: bugTitle,
      description: bugDescription,
      category: bugCategory,
      severity: bugSeverity,
      userId: currentUser.uid,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    alert('Thank you! Your bug report has been submitted.');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggest' && styles.activeTab]}
          onPress={() => setActiveTab('suggest')}
        >
          <Ionicons name="bulb-outline" size={18} color={activeTab === 'suggest' ? '#1a1a1a' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'suggest' && styles.activeTabText]}>
            Suggest Feature
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'bug' && styles.activeTab]}
          onPress={() => setActiveTab('bug')}
        >
          <Ionicons name="bug-outline" size={18} color={activeTab === 'bug' ? '#1a1a1a' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'bug' && styles.activeTabText]}>
            Report Bug
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'suggest' ? (
          <Animatable.View animation="fadeIn" style={styles.formContainer}>
            {/* Suggest Feature Icon */}
            <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="bulb" size={40} color="#F59E0B" />
            </View>
            <Text style={styles.formTitle}>Have an idea?</Text>
            <Text style={styles.formSubtitle}>We'd love to hear your suggestions!</Text>

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {featureCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    featureCategory === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setFeatureCategory(cat.id)}
                >
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  <Text style={styles.categoryButtonText}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Feature Title */}
            <Text style={styles.label}>Feature Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dark mode support"
              placeholderTextColor="#999"
              value={featureTitle}
              onChangeText={setFeatureTitle}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your feature idea in detail. What problem does it solve?"
              placeholderTextColor="#999"
              value={featureDescription}
              onChangeText={setFeatureDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Screenshots placeholder */}
            <Text style={styles.label}>Screenshots (optional, max 5)</Text>
            <TouchableOpacity style={styles.uploadBox}>
              <Ionicons name="image-outline" size={32} color="#999" />
              <Text style={styles.uploadText}>Add</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitFeature}>
              <Ionicons name="star" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit Suggestion</Text>
            </TouchableOpacity>

            {/* Tips */}
            <View style={styles.tips}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
                <Text style={styles.tipsTitle}>Tips for great suggestions</Text>
              </View>
              <Text style={styles.tipItem}>• Be specific about what you want</Text>
              <Text style={styles.tipItem}>• Explain the problem it solves</Text>
              <Text style={styles.tipItem}>• Describe how it would work</Text>
            </View>
          </Animatable.View>
        ) : (
          <Animatable.View animation="fadeIn" style={styles.formContainer}>
            {/* Report Bug Icon */}
            <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="bug" size={40} color="#EF4444" />
            </View>
            <Text style={styles.formTitle}>Found a bug?</Text>
            <Text style={styles.formSubtitle}>Help us improve by reporting issues</Text>

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryGrid}>
              {bugCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryButton,
                    bugCategory === cat.id && styles.categoryButtonActive,
                  ]}
                  onPress={() => setBugCategory(cat.id)}
                >
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  <Text style={styles.categoryButtonText}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Severity */}
            <Text style={styles.label}>Severity</Text>
            <View style={styles.severityContainer}>
              {severityLevels.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.severityButton,
                    bugSeverity === level && styles.severityButtonActive,
                  ]}
                  onPress={() => setBugSeverity(level)}
                >
                  <Text
                    style={[
                      styles.severityButtonText,
                      bugSeverity === level && styles.severityButtonTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bug Title */}
            <Text style={styles.label}>Bug Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., App crashes when..."
              placeholderTextColor="#999"
              value={bugTitle}
              onChangeText={setBugTitle}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what happened, what you expected, and steps to reproduce..."
              placeholderTextColor="#999"
              value={bugDescription}
              onChangeText={setBugDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Screenshots placeholder */}
            <Text style={styles.label}>Screenshots (optional, max 5)</Text>
            <TouchableOpacity style={styles.uploadBox}>
              <Ionicons name="image-outline" size={32} color="#999" />
              <Text style={styles.uploadText}>Add</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitBug}>
              <Ionicons name="bug" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Submit Bug Report</Text>
            </TouchableOpacity>

            {/* Tips */}
            <View style={styles.tips}>
              <View style={styles.tipsHeader}>
                <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
                <Text style={styles.tipsTitle}>Bug reporting tips</Text>
              </View>
              <Text style={styles.tipItem}>• Describe what you expected to happen</Text>
              <Text style={styles.tipItem}>• Include steps to reproduce the issue</Text>
              <Text style={styles.tipItem}>• Add screenshots if helpful</Text>
              <Text style={styles.tipItem}>• Mention your device/browser if relevant</Text>
            </View>
          </Animatable.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  categoryButtonActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#8A2BE2',
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  severityContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: '#8A2BE2',
    borderColor: '#8A2BE2',
  },
  severityButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  severityButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
    marginBottom: 24,
  },
  uploadText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tips: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  tipItem: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    lineHeight: 20,
  },
});

export default SuggestFeatureScreen;
