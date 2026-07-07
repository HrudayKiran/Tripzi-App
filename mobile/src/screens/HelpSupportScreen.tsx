import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { MotiView } from 'moti';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, NEUTRAL } from '../styles';

// ─── Tawk.to Configuration ─────────────────────────────────────────
const TAWKTO_PROPERTY_ID = process.env.EXPO_PUBLIC_TAWKTO_PROPERTY_ID || '';
const TAWKTO_WIDGET_ID = process.env.EXPO_PUBLIC_TAWKTO_WIDGET_ID || '';

const SUPPORT_EMAIL = 'nxtvibes.app@gmail.com';

import { useRouter } from 'expo-router';
import { NeumorphicBackButton } from '../components/NeumorphicIconButtons';

const HelpSupportScreen = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  const faqs = [
    { id: 1, question: 'How do I create a trip?', answer: 'Tap the + button from the main tabs, then create a trip manually or with NxtVibes AI.' },
    { id: 2, question: "Why can't I join some trips?", answer: 'Trips may be full, already started, cancelled, or restricted by host gender preference. Your profile must also be complete.' },
    { id: 3, question: 'When do group chats appear?', answer: 'A trip group chat is created automatically when the first traveler joins a trip. Later joined users are added to the same group.' },
    { id: 4, question: 'Why are notifications not working?', answer: 'NxtVibes needs device notification permission. If permission is denied, NxtVibes may disable both push and in-app notifications until you enable it again.' },
    { id: 6, question: 'How do I delete my account?', answer: 'Open Settings, choose Delete Account, select a reason, and confirm. NxtVibes will delete your account and connected data, while keeping limited safety records if required.' },
    { id: 7, question: 'Is NxtVibes available outside India?', answer: 'No. NxtVibes is currently designed only for users in India and for adults aged 18 or above.' },
  ];

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  // Open tawk.to live chat via Direct Chat Link
  const openLiveChat = () => {
    setChatLoading(true);
    setChatVisible(true);
  };

  // Open email client with pre-filled user info
  const openEmail = () => {
    const subject = encodeURIComponent('NxtVibes App Support');
    const body = encodeURIComponent(`\n\n---\nUser: ${currentUser?.user_metadata?.full_name || 'N/A'}\nEmail: ${currentUser?.email || 'N/A'}\nUID: ${currentUser?.id || 'N/A'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const openWebsite = () => {
    Linking.openURL('https://nxtvibes.vercel.app/');
  };

  // tawk.to Direct Chat Link URL
  const chatUrl = `https://tawk.to/chat/${TAWKTO_PROPERTY_ID}/${TAWKTO_WIDGET_ID}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <NeumorphicBackButton onPress={() => router.back()} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
          <View style={{ width: 45 }} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {/* Contact Options */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={styles.contactContainer}
          >
            <ContactCard
              icon="Envelope"
              label="Email"
              iconColor={colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000'}
              bgColor={colors.background !== '#FFFFFF' ? '#333333' : '#F3F4F6'}
              colors={colors}
              onPress={openEmail}
            />
            <ContactCard
              icon="ChatDots"
              label="Live Chat"
              iconColor={colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000'}
              bgColor={colors.background !== '#FFFFFF' ? '#333333' : '#F3F4F6'}
              colors={colors}
              onPress={openLiveChat}
            />
            <ContactCard
              icon="Globe"
              label="Website"
              iconColor={colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000'}
              bgColor={colors.background !== '#FFFFFF' ? '#333333' : '#F3F4F6'}
              colors={colors}
              onPress={openWebsite}
            />
          </MotiView>

          {/* FAQ Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            style={[styles.faqSection, { backgroundColor: colors.card }]}
          >
            <View style={styles.faqHeader}>
              <Icon name="Question" size={24} color={colors.background !== '#FFFFFF' ? '#FFFFFF' : '#000000'} />
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
                  <Icon
                    name={expandedFAQ === faq.id ? "CaretUp" : "CaretDown"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 200 }}
                    style={styles.faqAnswer}
                  >
                    <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{faq.answer}</Text>
                  </MotiView>
                )}
              </View>
            ))}
          </MotiView>


          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tawk.to Live Chat Modal — loads the Direct Chat Link URL */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setChatVisible(false)}
      >
        <SafeAreaView style={[styles.chatModal, { backgroundColor: colors.background }]} edges={['top']}>
          {/* Chat Header */}
          <View style={[styles.chatHeader, { backgroundColor: BRAND.primary }]}>
            <TouchableOpacity
              onPress={() => setChatVisible(false)}
              style={styles.chatCloseBtn}
              activeOpacity={0.7}
            >
              <Icon name="X" size={26} color={NEUTRAL.white} />
            </TouchableOpacity>
            <View style={styles.chatHeaderCenter}>
              <Icon name="ChatTeardropDots" size={20} color={NEUTRAL.white} />
              <Text style={styles.chatHeaderTitle}>Live Support</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                webViewRef.current?.reload();
                setChatLoading(true);
              }}
              style={styles.chatCloseBtn}
              activeOpacity={0.7}
            >
              <Icon name="ArrowClockwise" size={22} color={NEUTRAL.white} />
            </TouchableOpacity>
          </View>

          {/* WebView — loads tawk.to Direct Chat Link */}
          <WebView
            ref={webViewRef}
            source={{ uri: chatUrl }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onLoadStart={() => setChatLoading(true)}
            onLoadEnd={() => setChatLoading(false)}
            originWhitelist={['*']}
            mixedContentMode="always"
            setSupportMultipleWindows={false}
            cacheEnabled={true}
            thirdPartyCookiesEnabled={true}
            allowsInlineMediaPlayback={true}
            javaScriptCanOpenWindowsAutomatically={true}
            onShouldStartLoadWithRequest={(request) => {
              // Allow tawk.to URLs to load, open external links in browser
              if (request.url.includes('tawk.to') || request.url.includes('embed.tawk.to') || request.url.startsWith('about:')) {
                return true;
              }
              Linking.openURL(request.url);
              return false;
            }}
          />

          {/* Loading overlay */}
          {chatLoading && (
            <View style={[styles.chatLoadingOverlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={BRAND.primary} />
              <Text style={[styles.chatLoadingText, { color: colors.textSecondary }]}>
                Connecting to support...
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const ContactCard = ({ icon, label, iconColor, bgColor, colors, onPress }) => (
  <TouchableOpacity
    style={[styles.contactCard, { backgroundColor: colors.card }]}
    activeOpacity={0.7}
    onPress={onPress}
  >
    <View style={[styles.contactIcon, { backgroundColor: bgColor }]}>
      <Icon name={icon as any} size={28} color={iconColor} />
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
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
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
  helpFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  helpFooterText: {
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
    flex: 1,
  },

  // Chat Modal
  chatModal: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  chatCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chatHeaderTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: NEUTRAL.white,
  },
  webView: {
    flex: 1,
  },
  chatLoadingOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatLoadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
});

export default HelpSupportScreen;
