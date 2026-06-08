import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, TextInput, ActivityIndicator, Alert, Animated, Keyboard, Modal, Dimensions, TouchableWithoutFeedback, ScrollView, Linking } from 'react-native';
import { FlashList } from "@shopify/flash-list";

const TypedFlashList = FlashList as any;
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { syncDatabase } from '../database/sync';
import { showUploadNotification, completeUploadNotification, failUploadNotification } from '../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '../components/Icon';
import { NeumorphicCloseButton } from '../components/NeumorphicIconButtons';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, NEUTRAL } from '../styles';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { aiService, AIMessage, PlaceImage, AIModel, Conversation } from '../services/AIService';
import useAIPlannerQuery from '../hooks/useAIPlannerQuery';
import { useQueryClient } from '@tanstack/react-query';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

// ─── Typing Dots Component ──────────────────────────────────────────
const TypingDots = ({ color }: { color: string }) => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            );
        };
        const a1 = animate(dot1, 0);
        const a2 = animate(dot2, 150);
        const a3 = animate(dot3, 300);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.typingDotsRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View
                    key={i}
                    style={[
                        styles.typingDot,
                        { backgroundColor: color, transform: [{ translateY: dot }] },
                    ]}
                />
            ))}
        </View>
    );
};

// ─── Models Config ──────────────────────────────────────────────────
const MODELS: { id: AIModel; label: string; icon: string; desc: string }[] = [
    { id: 'llama-3.3-70b-versatile', label: 'Detailed', icon: '🧠', desc: 'Best for trip planning' },
    { id: 'llama-3.1-8b-instant', label: 'Quick', icon: '⚡', desc: 'Faster responses' },
];

// ─── Dynamic Suggestions ────────────────────────────────────────────
const getContextSuggestions = (messages: AIMessage[]): string[] => {
    if (messages.length === 0) return [];

    const lastAiMsg = messages.find(m => m.user._id === 'nxtvibes-ai');

    // 1. If the AI provided explicit suggestions in the response, use them (Perfect accuracy)
    if (lastAiMsg?.suggestions && lastAiMsg.suggestions.length > 0) {
        return lastAiMsg.suggestions;
    }

    // 2. Fallback to keyword-based suggestions (Rule-based accuracy)
    const lastText = lastAiMsg?.text?.toLowerCase() || '';

    if (lastText.includes('where are you starting') || lastText.includes('origin') || lastText.includes('from where')) {
        return ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai'];
    }
    if (lastText.includes('destination') || lastText.includes('where') || lastText.includes('which place')) {
        return ['Goa', 'Ladakh', 'Coorg', 'Rishikesh', 'Udaipur'];
    }
    if (lastText.includes('budget') || lastText.includes('cost') || lastText.includes('₹') || lastText.includes('spend')) {
        return ['₹5,000 per person', '₹10,000 per person', '₹20,000 per person', 'Budget friendly'];
    }
    if (lastText.includes('transport') || lastText.includes('travel') || lastText.includes('getting there')) {
        return ['Train', 'Flight', 'Car / Road Trip', 'Bike', 'Bus'];
    }
    if (lastText.includes('accommodation') || lastText.includes('stay') || lastText.includes('hotel') || lastText.includes('sleep')) {
        return ['Hotel', 'Hostel', 'Homestay', 'Camping', 'Not needed'];
    }
    if (lastText.includes('duration') || lastText.includes('how many days') || lastText.includes('how long')) {
        return ['2 days', '3 days', '5 days', '1 week'];
    }
    if (lastText.includes('when') || lastText.includes('date') || lastText.includes('start date') || lastText.includes('departure')) {
        return ['This weekend', 'Next week', 'End of this month', 'I\'m flexible'];
    }
    if (lastText.includes('traveler') || lastText.includes('people') || lastText.includes('group') || lastText.includes('how many')) {
        return ['Solo trip', '2 people', '4-5 friends', 'Large group (8+)'];
    }
    if (lastText.includes('trip type') || lastText.includes('kind of') || lastText.includes('interest') || lastText.includes('adventure')) {
        return ['Adventure', 'Sightseeing', 'Beach & Relax', 'Trekking', 'Road trip'];
    }
    if (lastText.includes('shall i create') || lastText.includes('trip card') || lastText.includes('confirm') || lastText.includes('summary')) {
        return ['Yes, create the trip card!', 'Change the budget', 'Add more places', 'Looks good, go ahead!'];
    }
    if (lastText.includes('posted') || lastText.includes('success') || lastText.includes('done') || lastText.includes('created')) {
        return ['Plan another trip', 'Show me popular destinations', 'Thanks!'];
    }

    return ['Create trip card', 'Suggest more places', 'Change plans', 'Show budget breakdown'];
};

const EMPTY_STATE_SUGGESTIONS = [
    { icon: '🏖️', title: 'Plan a Beach Trip', prompt: 'Plan a relaxing 3-day beach trip to Goa' },
    { icon: '🏔️', title: 'Mountain Escape', prompt: 'Plan an adventure trip to Manali for a group of 4' },
    { icon: '💡', title: 'NxtVibes Features', prompt: 'How do I use NxtVibes features like joining trips or finding travel buddies?' },
    { icon: '🎒', title: 'Backpacking', prompt: 'Plan a budget backpacking trip to Rishikesh' },
];
const IS_DEVELOPMENT_MODE = true;

export default function AIPlannerScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    if (IS_DEVELOPMENT_MODE) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
                <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', duration: 800 }}
                    style={{ alignItems: 'center', maxWidth: 320 }}
                >
                    <View style={[styles.devIconWrapper, { backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.08)' }]}>
                        <Icon name="Sparkle" size={48} color="#a855f7" weight="fill" />
                    </View>
                    
                    <View style={styles.devBetaBadge}>
                        <Text style={styles.devBetaText}>COMING SOON</Text>
                    </View>

                    <Text style={[styles.devTitle, { color: colors.text }]}>AI Trip Planner</Text>
                    
                    <Text style={[styles.devDesc, { color: colors.textSecondary }]}>
                        Our intelligent travel planning assistant is currently under development. Soon, you will be able to instantly draft custom day-by-day itineraries, explore personalized destination recommendations, and plan trips with friends using state-of-the-art AI.
                    </Text>

                    <Text style={[styles.devTimeline, { color: colors.primary }]}>
                        Stay tuned for upcoming updates! ✨
                    </Text>
                </MotiView>
            </View>
        );
    }

    // UI State
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModel>('llama-3.1-8b-instant');
    const [showModelPicker, setShowModelPicker] = useState(false);

    const [conversationId, setConversationId] = useState<string | null>((params.conversationId as string) || null);
    const { conversations, messages: serverMsgs, loading: loadingQuery, refetchConversations } = useAIPlannerQuery(conversationId);
    const conversationCreated = useRef(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (serverMsgs.length > 0) {
            setMessages(serverMsgs);
        }
    }, [serverMsgs]);

    // Refs
    const flatListRef = useRef<any>(null);
    const inputRef = useRef<TextInput>(null);

    // Drawer State
    const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Rename Modal State
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameText, setRenameText] = useState('');
    const [chatToRename, setChatToRename] = useState<Conversation | null>(null);

    const initialPrompt = params.initialPrompt as string | undefined;

    useFocusEffect(
        useCallback(() => {
            refetchConversations();
            setConversationId(null);
            conversationCreated.current = false;
            setInputText('');
            setMessages([]);
        }, [])
    );



    const initChat = async (forceNew = false) => {
        if (conversationId && !forceNew) {
            try {
                const serverMsgs = await aiService.getConversationMessages(conversationId);
                if (serverMsgs.length > 0) {
                    const loadedMsgs: AIMessage[] = serverMsgs.map((m) => ({
                        _id: m.id,
                        text: m.content,
                        createdAt: new Date(m.created_at),
                        user: m.role === 'assistant'
                            ? { _id: 'nxtvibes-ai', name: 'NxtVibes AI' }
                            : { _id: 'user', name: 'User' },
                        suggestions: m.suggestions,
                    }));
                    setMessages(loadedMsgs.reverse());
                    conversationCreated.current = true;
                    return;
                }
            } catch { /* fall through to welcome */ }
        }

        // Welcome state
        setMessages([]);
        if (initialPrompt && !forceNew) {
            setTimeout(() => {
                sendMessageDirectly(initialPrompt);
            }, 800);
        }
    };

    useEffect(() => {
        initChat();
    }, [conversationId]);

    const toggleDrawer = () => {
        const toValue = isDrawerOpen ? -DRAWER_WIDTH : 0;
        Animated.timing(drawerAnim, {
            toValue,
            duration: 300,
            useNativeDriver: true,
        }).start();
        setIsDrawerOpen(!isDrawerOpen);
    };

    const handleNewChat = () => {
        if (isDrawerOpen) toggleDrawer();
        setConversationId(null);
        conversationCreated.current = false;
        setInputText('');
        initChat(true);
    };

    const handleSelectChat = (conv: Conversation) => {
        toggleDrawer();
        if (conv.id === conversationId) return;
        setConversationId(conv.id);
        conversationCreated.current = true;
        // Effect on conversationId change isn't there, so manually call initChat
        aiService.getConversationMessages(conv.id).then(serverMsgs => {
            if (serverMsgs.length > 0) {
                const loadedMsgs: AIMessage[] = serverMsgs.map((m) => ({
                    _id: m.id,
                    text: m.content,
                    createdAt: new Date(m.created_at),
                    user: m.role === 'assistant'
                        ? { _id: 'nxtvibes-ai', name: 'NxtVibes AI' }
                        : { _id: 'user', name: 'User' },
                }));
                setMessages(loadedMsgs.reverse());
            }
        });
    };

    const handleDeleteChat = (conv: Conversation) => {
        Alert.alert(
            'Delete Chat',
            `Delete "${conv.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        await aiService.deleteConversation(conv.id);
                        queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
                        if (conversationId === conv.id) {
                            handleNewChat();
                        }
                    },
                },
            ]
        );
    };

    const openRenameModal = (conv: Conversation) => {
        setChatToRename(conv);
        setRenameText(conv.title);
        setRenameModalVisible(true);
    };

    const handleRenameSubmit = async () => {
        if (!chatToRename || !renameText.trim()) return;
        setRenameModalVisible(false);
        try {
            await aiService.renameConversation(chatToRename.id, renameText.trim());
            queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
        } catch {
            Alert.alert("Error", "Failed to rename chat");
        }
    };

    const ensureConversation = async (firstMessage: string): Promise<string | null> => {
        if (conversationId) return conversationId;
        if (conversationCreated.current) return conversationId;

        try {
            conversationCreated.current = true;
            // Generate title from first message
            const title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
            const conv = await aiService.createConversation(title, selectedModel);
            if (conv) {
                setConversationId(conv.id);
                queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
                return conv.id;
            }
        } catch { /* fall through */ }
        return null;
    };

    const sendMessageDirectly = async (text: string) => {
        const userMsg: AIMessage = {
            _id: Date.now() + Math.random(),
            text,
            createdAt: new Date(),
            user: { _id: 'user', name: 'User' },
        };

        setMessages(prev => [userMsg, ...prev]);
        setIsTyping(true);

        try {
            const convId = await ensureConversation(text);
            let newAiMessages: AIMessage[];

            if (convId) {
                const result = await aiService.sendConversationMessage(convId, text, selectedModel);
                if (result) {
                    newAiMessages = [{
                        _id: result.aiMessage.id,
                        text: result.aiMessage.content,
                        createdAt: new Date(result.aiMessage.created_at),
                        user: { _id: 'nxtvibes-ai', name: 'NxtVibes AI' },
                        suggestions: result.aiMessage.suggestions,
                    }];
                } else {
                    const responses = await aiService.sendMessage(text, messages, selectedModel);
                    newAiMessages = responses.reverse();
                }
            } else {
                const responses = await aiService.sendMessage(text, messages, selectedModel);
                newAiMessages = responses.reverse();
            }

            setMessages(prev => [...newAiMessages, ...prev]);
        } catch {
            // silent
        } finally {
            setIsTyping(false);
        }
    };

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text) return;
        Keyboard.dismiss();

        const userMsg: AIMessage = {
            _id: Date.now() + Math.random(),
            text,
            createdAt: new Date(),
            user: { _id: 'user', name: 'User' },
        };

        setMessages(prev => [userMsg, ...prev]);
        setInputText('');
        setIsTyping(true);

        try {
            const convId = await ensureConversation(text);
            let newAiMessages: AIMessage[];

            if (convId) {
                const result = await aiService.sendConversationMessage(convId, text, selectedModel);
                if (result) {
                    newAiMessages = [{
                        _id: result.aiMessage.id,
                        text: result.aiMessage.content,
                        createdAt: new Date(result.aiMessage.created_at),
                        user: { _id: 'nxtvibes-ai', name: 'NxtVibes AI' },
                        suggestions: result.aiMessage.suggestions,
                    }];
                } else {
                    const responses = await aiService.sendMessage(text, messages, selectedModel);
                    newAiMessages = responses.reverse();
                }
            } else {
                const responses = await aiService.sendMessage(text, messages, selectedModel);
                newAiMessages = responses.reverse();
            }

            setMessages(prev => [...newAiMessages, ...prev]);
        } catch {
            Alert.alert("Error", "Failed to connect to AI. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    const renderMessage = ({ item }: { item: AIMessage }) => {
        const isUser = item.user._id === 'user';

        return (
            <MotiView
                from={{ opacity: 0, translateX: isUser ? 20 : -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
            >
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <Image source={require('../../assets/nxtvibes_ai.png')} style={styles.avatarImage} contentFit="cover" />
                    </View>
                )}
                <View style={{ maxWidth: '100%' }}>
                    <View style={[styles.bubble, isUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card }, isUser ? styles.userBubble : styles.aiBubble]}>
                        <Text style={[styles.messageText, isUser ? { color: '#fff' } : { color: colors.text }]}>{item.text}</Text>
                    </View>
                </View>
            </MotiView>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateHero}>
                <Image source={require('../../assets/nxtvibes_ai.png')} style={styles.emptyStateLogo} contentFit="cover" />
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>NxtVibes AI</Text>
                <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>Your personal travel planner. What are we exploring next?</Text>
            </View>
            <View style={styles.emptySuggestionsGrid}>
                {EMPTY_STATE_SUGGESTIONS.map((s, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[styles.emptySuggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => { setInputText(s.prompt); setTimeout(() => inputRef.current?.focus(), 100); }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.emptySuggestionIcon}>{s.icon}</Text>
                        <Text style={[styles.emptySuggestionTitle, { color: colors.text }]}>{s.title}</Text>
                        <Text style={[styles.emptySuggestionDesc, { color: colors.textSecondary }]} numberOfLines={2}>{s.prompt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const suggestions = getContextSuggestions(messages);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + SPACING.xs, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={toggleDrawer} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Icon name="List" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.modelBadge, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowModelPicker(true)} activeOpacity={0.7}>
                        <Text style={[styles.modelBadgeText, { color: colors.text }]}>{MODELS.find(m => m.id === selectedModel)?.label}</Text>
                        <Icon name="CaretDown" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNewChat} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Icon name="NotePencil" size={26} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Chat Area */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 72}>
                {messages.length === 0 ? (
                    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACING.lg }}>
                        {renderEmptyState()}
                    </ScrollView>
                ) : (
                    <TypedFlashList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item._id.toString()}
                        inverted
                        style={{ flex: 1 }}
                        contentContainerStyle={[styles.listContent, { paddingBottom: SPACING.sm }]}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                        estimatedItemSize={200}
                        ListHeaderComponent={
                            isTyping ? (
                                <View style={styles.typingContainer}>
                                    <View style={styles.avatarContainer}><Image source={require('../../assets/nxtvibes_ai.png')} style={styles.avatarImage} contentFit="cover" /></View>
                                    <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card }]}><TypingDots color={colors.primary} /></View>
                                </View>
                            ) : null
                        }
                    />
                )}

                {/* Suggestions above input */}
                {suggestions.length > 0 && (
                    <View style={[styles.suggestionsContainer, { borderTopColor: colors.border }]}>
                        <TypedFlashList
                            data={suggestions} horizontal showsHorizontalScrollIndicator={false}
                            keyExtractor={(item, index) => `${item}-${index}`}
                            contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setInputText(item); setTimeout(() => inputRef.current?.focus(), 100); }}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
                                </TouchableOpacity>
                            )}
                            estimatedItemSize={100}
                        />
                    </View>
                )}

                {/* Input Area */}
                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 84 }]}>
                    <TextInput
                        ref={inputRef} style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Message NxtVibes AI..." placeholderTextColor={colors.textSecondary}
                        value={inputText} onChangeText={setInputText} multiline maxLength={500}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]} onPress={handleSend} disabled={!inputText.trim() || isTyping}>
                        {isTyping ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="ArrowUp" size={22} color="#fff" />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Side Drawer */}
            {isDrawerOpen && (
                <TouchableWithoutFeedback onPress={toggleDrawer}>
                    <Animated.View style={[styles.drawerOverlay, { opacity: drawerAnim.interpolate({ inputRange: [-DRAWER_WIDTH, 0], outputRange: [0, 1] }) }]} />
                </TouchableWithoutFeedback>
            )}
            <Animated.View style={[styles.drawerContainer, { backgroundColor: colors.card, transform: [{ translateX: drawerAnim }], paddingTop: insets.top }]}>
                <View style={styles.drawerHeader}>
                    <Text style={[styles.drawerTitle, { color: colors.text }]}>Chat History</Text>
                    <NeumorphicCloseButton
                        onPress={toggleDrawer}
                        size={38}
                        iconSize={22}
                    />
                </View>
                <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
                    <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: colors.text }]} onPress={handleNewChat}>
                        <Icon name="Plus" size={20} color={colors.background} />
                        <Text style={[styles.newChatBtnText, { color: colors.background }]}>New Chat</Text>
                    </TouchableOpacity>
                    <Text style={[styles.drawerSectionTitle, { color: colors.textSecondary }]}>Recent</Text>
                    {conversations.map(conv => (
                        <View key={conv.id} style={[styles.drawerItemWrap, conversationId === conv.id && { backgroundColor: colors.border, borderRadius: BORDER_RADIUS.md }]}>
                            <TouchableOpacity style={styles.drawerItem} onPress={() => handleSelectChat(conv)}>
                                <Icon name="ChatTeardropText" size={18} color={colors.text} />
                                <Text style={[styles.drawerItemText, { color: colors.text }]} numberOfLines={1}>{conv.title}</Text>
                            </TouchableOpacity>
                            <View style={styles.drawerItemActions}>
                                <TouchableOpacity onPress={() => openRenameModal(conv)} style={styles.drawerActionBtn}>
                                    <Icon name="Pencil" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteChat(conv)} style={styles.drawerActionBtn}>
                                    <Icon name="Trash" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </Animated.View>

            {/* Rename Modal */}
            <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.renameModalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.renameModalTitle, { color: colors.text }]}>Rename Chat</Text>
                        <TextInput
                            style={[styles.renameInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={renameText}
                            onChangeText={setRenameText}
                            autoFocus
                        />
                        <View style={styles.renameModalActions}>
                            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenameModalVisible(false)}>
                                <Text style={[styles.renameBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.renameSubmitBtn, { backgroundColor: colors.primary }]} onPress={handleRenameSubmit}>
                                <Text style={[styles.renameBtnText, { color: '#fff' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Model Picker */}
            <Modal visible={showModelPicker} transparent animationType="fade" onRequestClose={() => setShowModelPicker(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModelPicker(false)}>
                    <MotiView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 200 }}
                        style={[styles.modelDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Text style={[styles.modelDropdownTitle, { color: colors.textSecondary }]}>Select AI Model</Text>
                        {MODELS.map((model) => (
                            <TouchableOpacity key={model.id} style={[styles.modelOption, selectedModel === model.id && { backgroundColor: 'rgba(157,116,247,0.1)' }]} onPress={() => { setSelectedModel(model.id); setShowModelPicker(false); }}>
                                <Text style={styles.modelOptionIcon}>{model.icon}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.modelOptionLabel, { color: colors.text }]}>{model.label}</Text>
                                    <Text style={[styles.modelOptionDesc, { color: colors.textSecondary }]}>{model.desc}</Text>
                                </View>
                                {selectedModel === model.id && <Icon name="CheckCircle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        ))}
                    </MotiView>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {},
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
    iconBtn: { padding: SPACING.xs },
    modelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    modelBadgeText: { fontSize: 13, fontWeight: FONT_WEIGHT.semibold },

    // Empty State
    emptyStateContainer: { flex: 1, alignItems: 'center', paddingTop: height * 0.05 },
    emptyStateHero: { alignItems: 'center', marginBottom: SPACING.xl },
    emptyStateLogo: { width: 64, height: 64, borderRadius: 32, marginBottom: SPACING.md },
    emptyStateTitle: { fontSize: 24, fontWeight: FONT_WEIGHT.bold, marginBottom: 8 },
    emptyStateSubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: SPACING.xl },
    emptySuggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, justifyContent: 'center' },
    emptySuggestionCard: { width: '45%', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    emptySuggestionIcon: { fontSize: 24, marginBottom: 8 },
    emptySuggestionTitle: { fontSize: 14, fontWeight: FONT_WEIGHT.semibold, marginBottom: 4 },
    emptySuggestionDesc: { fontSize: 12 },

    // Drawer
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
    drawerContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, zIndex: 11, elevation: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)' },
    drawerTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold },
    newChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: 8, marginBottom: SPACING.lg },
    newChatBtnText: { color: '#fff', fontSize: 16, fontWeight: FONT_WEIGHT.semibold },
    drawerSectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
    drawerItemWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    drawerItem: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 12 },
    drawerItemText: { fontSize: 15, flex: 1 },
    drawerItemActions: { flexDirection: 'row', alignItems: 'center' },
    drawerActionBtn: { padding: 8 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
    modelDropdown: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: 'hidden', width: '100%', maxWidth: 320 },
    modelDropdownTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
    modelOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg },
    modelOptionIcon: { fontSize: 24 },
    modelOptionLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
    modelOptionDesc: { fontSize: 12, marginTop: 2 },

    renameModalContent: { width: '100%', maxWidth: 320, padding: 20, borderRadius: BORDER_RADIUS.xl },
    renameModalTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold, marginBottom: 16 },
    renameInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 12, fontSize: 16, marginBottom: 20 },
    renameModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    renameCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
    renameSubmitBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: BORDER_RADIUS.md },
    renameBtnText: { fontSize: 15, fontWeight: FONT_WEIGHT.semibold },

    // Chat items
    listContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
    messageRow: { flexDirection: 'row', marginBottom: SPACING.md, maxWidth: '85%' },
    userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
    aiRow: { alignSelf: 'flex-start' },
    avatarContainer: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', marginRight: SPACING.xs, backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.08)', borderWidth: 1 },
    avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    bubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.xl, marginBottom: 2 },
    userBubble: { borderBottomRightRadius: 4 },
    aiBubble: { borderTopLeftRadius: 4 },
    messageText: { fontSize: FONT_SIZE.md, lineHeight: 22 },

    typingContainer: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 0, marginBottom: SPACING.md },
    typingDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    typingDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.7 },

    suggestionsContainer: { paddingVertical: SPACING.sm, borderTopWidth: 0.5 },
    chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.xl, borderWidth: 1 },
    chipText: { fontSize: FONT_SIZE.sm },

    inputContainer: { flexDirection: 'row', padding: SPACING.sm, paddingHorizontal: SPACING.md, borderTopWidth: 1, alignItems: 'flex-end', gap: SPACING.sm },
    input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16 },
    sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

    // Location Request Card
    locationRequestCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, alignItems: 'center', marginHorizontal: SPACING.lg, marginVertical: SPACING.md },
    locationRequestIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(157,116,247,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
    locationRequestTitle: { fontSize: 18, fontWeight: FONT_WEIGHT.bold, marginBottom: 8 },
    locationRequestDesc: { fontSize: 14, textAlign: 'center', marginBottom: SPACING.lg, paddingHorizontal: SPACING.sm },
    locationRequestBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, borderRadius: BORDER_RADIUS.md },
    locationRequestBtnText: { color: '#fff', fontSize: 15, fontWeight: FONT_WEIGHT.bold },

    // Trip Card
    tripCard: { width: width * 0.75, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginTop: SPACING.sm },
    tripCardBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    tripCardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    tripCardOverlayTitle: { position: 'absolute', bottom: 12, left: 12, right: 12, color: '#fff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    tripCardBody: { padding: SPACING.md },
    tripCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: 4 },
    tripCardText: { fontSize: 15, fontWeight: '600' },
    tripCardDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
    tripCardDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 8 },
    tripCardDetailText: { fontSize: 12, fontWeight: '500' },
    tripCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: SPACING.sm },
    itinerarySection: { marginTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.3)', paddingTop: SPACING.sm },
    itineraryTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
    itineraryItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 6 },
    itineraryDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
    itineraryText: { fontSize: 13, flex: 1 },
    tripCardActions: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    actionBtnTextWhite: { color: '#fff', fontSize: 13, fontWeight: '600' },
    // Development placeholder screen styles
    devIconWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    devBetaBadge: {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    devBetaText: {
        color: '#a855f7',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    devTitle: {
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    devDesc: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    devTimeline: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
});
