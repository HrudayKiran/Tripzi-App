import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../styles/constants';

const UsernameSetupScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const [username, setUsername] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState(null);
    const currentUser = auth().currentUser;

    const checkUsername = async (value) => {
        const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setUsername(cleaned);

        if (cleaned.length < 3) {
            setIsAvailable(null);
            return;
        }

        setIsChecking(true);
        try {
            const snapshot = await firestore()
                .collection('users')
                .where('username', '==', cleaned)
                .get();

            setIsAvailable(snapshot.empty);
        } catch (error) {
            // Error checking username

            setIsAvailable(true); // Assume available if can't check
        }
        setIsChecking(false);
    };

    const handleSubmit = async () => {
        if (!username || username.length < 3) {
            Alert.alert('Invalid Username', 'Username must be at least 3 characters.');
            return;
        }

        if (!isAvailable) {
            Alert.alert('Username Taken', 'Please choose a different username.');
            return;
        }

        try {
            await firestore().collection('users').doc(currentUser.uid).set({
                username,
                displayName: currentUser.displayName || username,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                createdAt: firestore.FieldValue.serverTimestamp(),
                ageVerified: false,
            }, { merge: true });

            navigation.replace('App');
        } catch (error) {
            // Error saving username

            // Navigate anyway - will retry later
            navigation.replace('App');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Animatable.View animation="fadeInUp" style={styles.header}>
                    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.iconGradient}>
                        <Ionicons name="at" size={40} color="#fff" />
                    </LinearGradient>
                    <Text style={[styles.title, { color: colors.text }]}>Choose Your Username</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        This will be your unique identity on Tripzi.{'\n'}Choose wisely - it can't be changed later!
                    </Text>
                </Animatable.View>

                <Animatable.View animation="fadeInUp" delay={100} style={styles.inputSection}>
                    <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: isAvailable === false ? '#EF4444' : isAvailable === true ? '#10B981' : colors.border }]}>
                        <Text style={[styles.atSymbol, { color: colors.textSecondary }]}>@</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            value={username}
                            onChangeText={checkUsername}
                            placeholder="username"
                            placeholderTextColor={colors.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={20}
                        />
                        {isChecking && <Ionicons name="hourglass-outline" size={20} color={colors.textSecondary} />}
                        {!isChecking && isAvailable === true && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                        {!isChecking && isAvailable === false && <Ionicons name="close-circle" size={20} color="#EF4444" />}
                    </View>

                    {isAvailable === true && (
                        <Text style={styles.availableText}>✓ Username available!</Text>
                    )}
                    {isAvailable === false && (
                        <Text style={styles.unavailableText}>✗ Username already taken</Text>
                    )}

                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Only lowercase letters, numbers, and underscores
                    </Text>
                </Animatable.View>

                <Animatable.View animation="fadeInUp" delay={200} style={styles.buttonSection}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!username || username.length < 3 || isAvailable === false}
                    >
                        <LinearGradient
                            colors={username && username.length >= 3 && isAvailable !== false ? ['#8B5CF6', '#EC4899'] : ['#9CA3AF', '#9CA3AF']}
                            style={styles.submitButton}
                        >
                            <Text style={styles.submitButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animatable.View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, padding: SPACING.xl, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: SPACING.xxxl },
    iconGradient: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
    title: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
    subtitle: { fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
    inputSection: { marginBottom: SPACING.xxxl },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: BORDER_RADIUS.lg, borderWidth: 2, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    atSymbol: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, marginRight: SPACING.xs },
    input: { flex: 1, fontSize: FONT_SIZE.lg },
    availableText: { color: '#10B981', fontSize: FONT_SIZE.sm, marginTop: SPACING.sm, marginLeft: SPACING.sm },
    unavailableText: { color: '#EF4444', fontSize: FONT_SIZE.sm, marginTop: SPACING.sm, marginLeft: SPACING.sm },
    hint: { fontSize: FONT_SIZE.xs, marginTop: SPACING.md, marginLeft: SPACING.sm },
    buttonSection: {},
    submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg, gap: SPACING.sm },
    submitButtonText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
});

export default UsernameSetupScreen;
