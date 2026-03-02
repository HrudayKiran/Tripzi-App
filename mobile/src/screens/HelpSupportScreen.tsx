import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import auth from '@react-native-firebase/auth';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, TOUCH_TARGET, BRAND, NEUTRAL } from '../styles';

// ─── Tawk.to Configuration ─────────────────────────────────────────
const TAWKTO_PROPERTY_ID = process.env.EXPO_PUBLIC_TAWKTO_PROPERTY_ID || '';
const TAWKTO_WIDGET_ID = process.env.EXPO_PUBLIC_TAWKTO_WIDGET_ID || '';

const SUPPORT_EMAIL = 'support@tripzi.com';

const HelpSupportScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const currentUser = auth().currentUser;

  const faqs = [
    { id: 1, question: 'How do I create a trip?', answer: 'Go to My Trips and tap the + icon at the top right corner. Fill in the trip details and tap Post Trip.' },
    { id: 2, question: "How do I join someone else's trip?", answer: 'Browse trips on the Home page, open a trip you like, and tap the "Join Trip" button.' },
    { id: 3, question: 'What is KYC verification?', answer: 'KYC (Know Your Customer) verification helps us ensure the safety of our community. Go to Profile > KYC Status to complete your verification.' },
    { id: 4, question: 'How do I message other travelers?', answer: 'Tap on the Messages icon in the bottom navigation bar to see your conversations.' },
    { id: 5, question: 'Can I edit or delete my trip?', answer: 'Yes! Go to My Trips, tap on your trip, and you can edit or delete it from the trip details page.' },
    { id: 6, question: 'How do I delete my account?', answer: 'Go to Settings > scroll to the bottom > tap "Delete Account". All your data will be permanently removed.' },
    { id: 7, question: 'Is my data safe?', answer: 'Yes! We use Firebase security, encrypted connections, and follow strict privacy guidelines. See our Privacy Policy for details.' },
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
    const subject = encodeURIComponent('Tripzi App Support');
    const body = encodeURIComponent(`\n\n---\nUser: ${currentUser?.displayName || 'N/A'}\nEmail: ${currentUser?.email || 'N/A'}\nUID: ${currentUser?.uid || 'N/A'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  // tawk.to Direct Chat Link URL
  const chatUrl = `https://tawk.to/chat/${TAWKTO_PROPERTY_ID}/${TAWKTO_WIDGET_ID}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
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

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {/* Contact Options */}
          <Animatable.View animation="fadeInUp" duration={400} style={styles.contactContainer}>
            <ContactCard
              icon="mail-outline"
              label="Email"
              iconColor="#9d74f7"
              bgColor="#EDE9FE"
              colors={colors}
              onPress={openEmail}
            />
            <ContactCard
              icon="chatbubble-ellipses-outline"
              label="Live Chat"
              iconColor="#10B981"
              bgColor="#D1FAE5"
              colors={colors}
              onPress={openLiveChat}
            />
            <ContactCard
              icon="call-outline"
              label="Call Us"
              iconColor="#6B7280"
              bgColor="#F3F4F6"
              colors={colors}
              onPress={() => Linking.openURL('tel:+911234567890')}
            />
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
              <Ionicons name="close" size={26} color={NEUTRAL.white} />
            </TouchableOpacity>
            <View style={styles.chatHeaderCenter}>
              <Ionicons name="chatbubbles" size={20} color={NEUTRAL.white} />
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
              <Ionicons name="refresh" size={22} color={NEUTRAL.white} />
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
