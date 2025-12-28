import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, SHADOW } from '../styles/constants';

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
    alert('Message sent successfully!');
    setSubject('');
    setMessage('');
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Contact Options */}
          <Animatable.View animation="fadeInUp" duration={400} style={styles.contactContainer}>
            <ContactCard icon="mail-outline" label="Email" iconColor="#8B5CF6" bgColor="#EDE9FE" colors={colors} />
            <ContactCard icon="chatbubble-ellipses-outline" label="Live Chat" iconColor="#10B981" bgColor="#D1FAE5" colors={colors} />
            <ContactCard icon="call-outline" label="Call Us" iconColor="#6B7280" bgColor="#F3F4F6" colors={colors} />
          </Animatable.View>

          {/* FAQ Section */}
          <Animatable.View animation="fadeInUp" delay={100} duration={400} style={[styles.faqSection, { backgroundColor: colors.card }]}>
            <View style={styles.faqHeader}>
              <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
              <Text style={[styles.faqTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
            </View>

            {faqs.map((faq) => (
              <View key={faq.id} style={[styles.faqItem, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => toggleFAQ(faq.id)}
                  style={styles.faqQuestion}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.faqQuestionText, { color: colors.text }]}>{faq.question}</Text>
                  <Ionicons
                    name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <Animatable.View animation="fadeIn" duration={200} style={styles.faqAnswer}>
                    <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{faq.answer}</Text>
                  </Animatable.View>
                )}
              </View>
            ))}
          </Animatable.View>

          {/* Send Message Section */}
          <Animatable.View animation="fadeInUp" delay={200} duration={400} style={[styles.messageSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.messageSectionTitle, { color: colors.text }]}>Send us a message</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Subject"
              placeholderTextColor={colors.textSecondary}
              value={subject}
              onChangeText={setSubject}
            />

            <TextInput
              style={[styles.textArea, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Your message..."
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>Send Message</Text>
            </TouchableOpacity>
          </Animatable.View>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const ContactCard = ({ icon, label, iconColor, bgColor, colors }) => (
  <TouchableOpacity style={[styles.contactCard, { backgroundColor: colors.card }]} activeOpacity={0.7}>
    <View style={[styles.contactIcon, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={28} color={iconColor} />
    </View>
    <Text style={[styles.contactLabel, { color: colors.text }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
  },
  placeholder: {
    width: TOUCH_TARGET.min,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  contactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  contactCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  contactIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  contactLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  faqSection: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  faqTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  faqItem: {
    borderBottomWidth: 1,
    paddingVertical: SPACING.md,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
    marginRight: SPACING.md,
  },
  faqAnswer: {
    marginTop: SPACING.md,
  },
  faqAnswerText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 22,
  },
  messageSection: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  messageSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    fontSize: FONT_SIZE.sm,
    height: 100,
    marginBottom: SPACING.lg,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default HelpSupportScreen;
