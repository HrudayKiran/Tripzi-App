import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles/constants';

const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors } = useTheme();

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInUp" duration={400}>
            <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
              Last updated: January 2026
            </Text>

            <Section title="1. Information We Collect" colors={colors}>
              We collect information you provide directly to us, including your name, email address,
              phone number, profile information, and any other information you choose to provide when
              using Tripzi.
            </Section>

            <Section title="2. How We Use Your Information" colors={colors}>
              We use the information we collect to provide, maintain, and improve our services, to
              communicate with you, to monitor and analyze trends and usage, and to personalize your
              experience on Tripzi.
            </Section>

            <Section title="3. Information Sharing" colors={colors}>
              We do not share your personal information with third parties except as described in this
              policy. We may share information with other users as part of the trip planning and
              social features of the app.
            </Section>

            <Section title="4. Data Security" colors={colors}>
              We take reasonable measures to protect your personal information from unauthorized access,
              use, or disclosure. However, no internet transmission is ever fully secure or error-free.
            </Section>

            <Section title="5. Your Rights" colors={colors}>
              You have the right to access, update, or delete your personal information at any time
              through your account settings. You may also contact us to exercise these rights.
            </Section>

            <Section title="6. Cookies and Tracking" colors={colors}>
              We use cookies and similar tracking technologies to collect information about your
              browsing activities and to provide you with a personalized experience.
            </Section>

            <Section title="7. Children's Privacy" colors={colors}>
              Tripzi is not intended for use by children under 13 years of age. We do not knowingly
              collect personal information from children under 13.
            </Section>

            <Section title="8. Changes to Privacy Policy" colors={colors}>
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </Section>

            <Section title="9. Contact Us" colors={colors}>
              If you have any questions about this Privacy Policy, please contact us at
              privacy@tripzi.com
            </Section>

            <View style={{ height: SPACING.xxxl }} />
          </Animatable.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const Section = ({ title, children, colors }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    <Text style={[styles.paragraph, { color: colors.textSecondary }]}>{children}</Text>
  </View>
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
    paddingHorizontal: SPACING.xxl,
  },
  lastUpdated: {
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.md,
  },
  paragraph: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 24,
  },
});

export default PrivacyPolicyScreen;
