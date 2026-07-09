import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../styles';
import { useRouter } from 'expo-router';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';

const TermsScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <NeumorphicBackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
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

            <Section title="1. Acceptance of Terms" colors={colors}>
              By using NxtVibes, you agree to these Terms. If you do not agree, do not use the app.
            </Section>

            <Section title="2. India-Only and 18+" colors={colors}>
              NxtVibes is designed for users in India and is intended only for adults who are at least 18 years old.
              You must provide accurate profile information, including your age and gender where required for trip participation rules.
            </Section>

            <Section title="3. Accounts and Google Sign-In" colors={colors}>
              NxtVibes uses Google Sign-In for account access. You are responsible for keeping your Google account secure
              and for any activity that happens through your NxtVibes account.
            </Section>

            <Section title="4. Platform Use" colors={colors}>
              NxtVibes lets users create trips, join trips, chat with other travelers, share profile content,
              upload images, and report abusive or unsafe behavior. You must use the app lawfully and respectfully.
            </Section>

            <Section title="5. Content and Conduct" colors={colors}>
              You must not post illegal, abusive, misleading, sexual, hateful, violent, fraudulent, or unsafe content.
              NxtVibes may remove content, restrict accounts, cancel trips, or suspend users to protect the community.
            </Section>

            <Section title="6. Trip Participation and Safety" colors={colors}>
              NxtVibes is a platform for connecting travelers. NxtVibes does not guarantee the conduct, identity, safety,
              legality, or reliability of any user, trip, destination, or off-platform arrangement. Users remain
              responsible for their own safety, spending, bookings, transportation, and decisions.
            </Section>

            <Section title="7. Notifications, Media, and Features" colors={colors}>
              Certain NxtVibes features depend on optional permissions such as notifications, photos, camera, and location.
              If you deny a permission, related features may be limited or unavailable.
            </Section>

            <Section title="8. Termination and Deletion" colors={colors}>
              You can request account deletion from Settings. NxtVibes may retain limited records required for security,
              fraud prevention, abuse handling, legal compliance, and service administration, including deletion reasons.
            </Section>

            <Section title="9. Changes to Terms" colors={colors}>
              NxtVibes may update these Terms from time to time. Continued use of the app after an update means you accept the revised Terms.
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

export default TermsScreen;
