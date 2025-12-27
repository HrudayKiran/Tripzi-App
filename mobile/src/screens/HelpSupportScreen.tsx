
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';

const HelpSupportScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const faqs = [
    { id: 1, question: 'How do I create a trip?', answer: 'Go to My Trips and tap the + icon at the top right corner. Fill in the trip details and tap Post Trip.' },
    { id: 2, question: "How do I join someone else's trip?", answer: 'Browse trips on the Home page, open a trip you like, and tap the "Join Trip" button.' },
    { id: 3, question: 'What is KYC verification?', answer: 'KYC (Know Your Customer) verification helps us ensure the safety of our community. Go to Profile > KYC Status to complete your verification.' },
    { id: 4, question: 'How do I message other travelers?', answer: 'Tap on the Messages icon in the bottom navigation bar to see your conversations.' },
    { id: 5, question: 'Can I edit or delete my trip?', answer: 'Yes! Go to My Trips, tap on your trip, and you can edit or delete it from the trip details page.' },
  ];

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleSendMessage = () => {
    // Handle submit logic
    alert('Message sent successfully!');
    setSubject('');
    setMessage('');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Contact Options */}
      <Animatable.View animation="fadeInUp" style={styles.contactContainer}>
        <TouchableOpacity style={styles.contactCard}>
          <View style={[styles.contactIcon, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="mail-outline" size={32} color="#8B5CF6" />
          </View>
          <Text style={styles.contactLabel}>Email</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard}>
          <View style={[styles.contactIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#10B981" />
          </View>
          <Text style={styles.contactLabel}>Live Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard}>
          <View style={[styles.contactIcon, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="call-outline" size={32} color="#6B7280" />
          </View>
          <Text style={styles.contactLabel}>Call Us</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* FAQ Section */}
      <Animatable.View animation="fadeInUp" delay={200} style={styles.faqSection}>
        <View style={styles.faqHeader}>
          <Ionicons name="help-circle-outline" size={24} color="#8A2BE2" />
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
        </View>

        {faqs.map((faq) => (
          <View key={faq.id} style={styles.faqItem}>
            <TouchableOpacity onPress={() => toggleFAQ(faq.id)} style={styles.faqQuestion}>
              <Text style={styles.faqQuestionText}>{faq.question}</Text>
              <Ionicons
                name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
            {expandedFAQ === faq.id && (
              <Animatable.View animation="fadeInDown" duration={300} style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{faq.answer}</Text>
              </Animatable.View>
            )}
          </View>
        ))}
      </Animatable.View>

      {/* Send Message Section */}
      <Animatable.View animation="fadeInUp" delay={400} style={styles.messageSection}>
        <Text style={styles.messageSectionTitle}>Send us a message</Text>

        <TextInput
          style={styles.input}
          placeholder="Subject"
          placeholderTextColor="#999"
          value={subject}
          onChangeText={setSubject}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your issue or question..."
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.sendButtonText}>Send Message</Text>
        </TouchableOpacity>
      </Animatable.View>

      <View style={{ height: 100 }} />
    </ScrollView>
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
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  contactCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 100,
  },
  contactIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  faqSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 16,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  messageSection: {
    paddingHorizontal: 20,
  },
  messageSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  sendButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HelpSupportScreen;
