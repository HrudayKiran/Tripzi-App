import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { useRouter } from 'expo-router';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';

const PrivacyPolicyScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <NeumorphicBackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
          <View style={{ width: 45 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
          >
            <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
              Last updated: March 2026
            </Text>

            <Section title="1. Information We Collect" colors={colors}>
              NxtVibes may collect your Google account email, profile details you submit during onboarding,
              trip content, chat content, reports, bug submissions, device tokens for notifications,
              and technical diagnostics needed to operate the app.
            </Section>

            <Section title="2. How We Use Your Information" colors={colors}>
              We use your information to create and manage your account, operate trips and group chats,
              deliver notifications, prevent abuse, improve app performance, investigate reports, and support users.
            </Section>

            <Section title="3. What Other Users Can See" colors={colors}>
              Other signed-in users may see your public NxtVibes profile information, public trip posts,
              and content you share inside chats or group chats.
            </Section>

            <Section title="4. Permissions and Device Access" colors={colors}>
              NxtVibes asks for permissions only for features that need them, such as notifications,
              camera, media access, location, and saving media to the device gallery. If you do not grant
              a permission, the related feature may not work.
            </Section>

            <Section title="5. Storage, Analytics, and Vendors" colors={colors}>
              NxtVibes uses Firebase services for messaging, remote config,
              app check, performance, crash reporting, and related analytics. NxtVibes may also use Cloudflare R2
              for media storage and other service providers needed to deliver app functionality.
            </Section>

            <Section title="6. Security and Retention" colors={colors}>
              We take reasonable measures to protect user data, but no system is perfectly secure.
              NxtVibes may retain limited records after account deletion for fraud prevention, abuse review,
              moderation history, legal compliance, and operational security.
            </Section>

            <Section title="7. Your Choices" colors={colors}>
              You can update your profile, manage selected settings, control optional permissions,
              and request account deletion from within the app. If notification permission is denied,
              NxtVibes may disable both push and in-app notifications for your account on that device.
            </Section>

            <Section title="8. Age and Region" colors={colors}>
              NxtVibes is intended for users in India who are at least 18 years old. Users under 18 are not permitted to create or use accounts.
            </Section>

            <Section title="9. Changes to this Policy" colors={colors}>
              NxtVibes may update this Privacy Policy from time to time. The latest version will be available in the app and the production listing.
            </Section>

            <Section title="10. Contact" colors={colors}>
              Support contact details will be published in the production release and Play Store listing.
            </Section>

            <View style={{ height: SPACING.xxxl }} />
          </MotiView>
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
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
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
