import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET } from '../styles';

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
              Last updated: March 2026
            </Text>

            <Section title="1. Information We Collect" colors={colors}>
              Tripzi may collect your Google account email, profile details you submit during onboarding,
              trip content, chat content, ratings, reports, bug submissions, device tokens for notifications,
              and technical diagnostics needed to operate the app.
            </Section>

            <Section title="2. How We Use Your Information" colors={colors}>
              We use your information to create and manage your account, operate trips and group chats,
              deliver notifications, prevent abuse, improve app performance, investigate reports, and support users.
            </Section>

            <Section title="3. What Other Users Can See" colors={colors}>
              Other signed-in users may see your public Tripzi profile information, public trip posts,
              ratings you leave where applicable, and content you share inside chats or group chats.
            </Section>

            <Section title="4. Permissions and Device Access" colors={colors}>
              Tripzi asks for permissions only for features that need them, such as notifications,
              camera, media access, location, and saving media to the device gallery. If you do not grant
              a permission, the related feature may not work.
            </Section>

            <Section title="5. Storage, Analytics, and Vendors" colors={colors}>
              Tripzi uses Firebase services for authentication, database, messaging, remote config,
              performance, crash reporting, and related backend operations. Tripzi may also use Cloudflare R2
              for media storage and other service providers needed to deliver app functionality.
            </Section>

            <Section title="6. Security and Retention" colors={colors}>
              We take reasonable measures to protect user data, but no system is perfectly secure.
              Tripzi may retain limited records after account deletion for fraud prevention, abuse review,
              moderation history, legal compliance, and operational security.
            </Section>

            <Section title="7. Your Choices" colors={colors}>
              You can update your profile, manage selected settings, control optional permissions,
              and request account deletion from within the app. If notification permission is denied,
              Tripzi may disable both push and in-app notifications for your account on that device.
            </Section>

            <Section title="8. Age and Region" colors={colors}>
              Tripzi is intended for users in India who are at least 18 years old. Users under 18 are not permitted to create or use accounts.
            </Section>

            <Section title="9. Changes to this Policy" colors={colors}>
              Tripzi may update this Privacy Policy from time to time. The latest version will be available in the app and the production listing.
            </Section>

            <Section title="10. Contact" colors={colors}>
              Support contact details will be published in the production release and Play Store listing.
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
