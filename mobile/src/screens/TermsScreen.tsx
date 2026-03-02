import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles';

const TermsScreen = ({ navigation }) => {
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animatable.View animation="fadeInUp" duration={400}>
            <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
              Last updated: January 2026
            </Text>

            <Section title="1. Acceptance of Terms" colors={colors}>
              By accessing and using Tripzi, you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to these terms, please do not use our service.
            </Section>

            <Section title="2. Use of Service" colors={colors}>
              Tripzi provides a platform for solo travelers to connect, plan trips, and share experiences.
              You agree to use the service only for lawful purposes and in accordance with these Terms.
            </Section>

            <Section title="3. User Accounts" colors={colors}>
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activities that occur under your account. You agree to notify us immediately of any
              unauthorized use of your account.
            </Section>

            <Section title="4. Content Guidelines" colors={colors}>
              Users must not post content that is illegal, harmful, threatening, abusive, harassing,
              defamatory, vulgar, obscene, or otherwise objectionable. Tripzi reserves the right to
              remove any content that violates these guidelines.
            </Section>

            <Section title="5. Privacy" colors={colors}>
              Your use of Tripzi is also governed by our Privacy Policy. Please review our Privacy
              Policy to understand our practices.
            </Section>

            <Section title="6. Limitation of Liability" colors={colors}>
              Tripzi shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of or inability to use the service.
            </Section>

            <Section title="7. Changes to Terms" colors={colors}>
              We reserve the right to modify these terms at any time. We will notify users of any
              significant changes via email or through the app.
            </Section>

            <Section title="8. Contact Us" colors={colors}>
              If you have any questions about these Terms, please contact us at support@tripzi.com
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

export default TermsScreen;
