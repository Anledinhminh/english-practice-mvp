import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, hasSupabaseKeys } from './supabase';

export interface VocabularyWord {
    word: string;
    date: string;
    context?: string;
    definition?: string;
}

export interface PracticeSession {
    date: string;       // YYYY-MM-DD
    messageCount: number;
}

export interface ChatMessage {
    id: string;
    role: "user" | "ai";
    content: string;
    correction?: string;
}

export interface Conversation {
    id: string;
    title: string;
    date: string;
    scenario?: string;
    messages: ChatMessage[];
}

interface ProgressState {
    fluencyScore: number;
    totalMessages: number;
    grammarMistakes: number;
    totalWordCount: number;
    totalComplexWords: number;
    totalResponseTimeMs: number;
    vocabulary: VocabularyWord[];
    sessions: PracticeSession[];
    conversations: Conversation[];
    activeConversationId: string | null;

    // Actions
    addMessage: (stats: { hasGrammarMistake: boolean; responseTimeMs: number; wordCount: number; complexWordCount: number }) => void;
    addVocabulary: (word: string, context?: string, definition?: string) => void;
    updateFluencyScore: () => void;

    // Conversation Actions
    startConversation: (scenario?: string) => string;
    addChatMessage: (msg: ChatMessage) => void;
    updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
    deleteConversation: (id: string) => void;
    setActiveConversation: (id: string | null) => void;
}

export const useProgressStore = create<ProgressState>()(
    persist(
        (set, get) => ({
            fluencyScore: 100, // Starts at perfect, decreases with mistakes, increases with error-free messages
            totalMessages: 0,
            grammarMistakes: 0,
            totalWordCount: 0,
            totalComplexWords: 0,
            totalResponseTimeMs: 0,
            vocabulary: [],
            sessions: [],
            conversations: [],
            activeConversationId: null,

            addMessage: (stats) => {
                const today = new Date().toISOString().split('T')[0];

                set((state) => {
                    // Update sessions history
                    const existingSessionIndex = state.sessions.findIndex(s => s.date === today);
                    let newSessions = [...state.sessions];

                    if (existingSessionIndex >= 0) {
                        newSessions[existingSessionIndex] = {
                            ...newSessions[existingSessionIndex],
                            messageCount: newSessions[existingSessionIndex].messageCount + 1
                        };
                    } else {
                        newSessions.push({ date: today, messageCount: 1 });
                    }

                    // Keep max 90 days of sessions to avoid blowing up local storage
                    if (newSessions.length > 90) newSessions.shift();

                    const newState = {
                        totalMessages: state.totalMessages + 1,
                        grammarMistakes: state.grammarMistakes + (stats.hasGrammarMistake ? 1 : 0),
                        totalWordCount: state.totalWordCount + stats.wordCount,
                        totalComplexWords: state.totalComplexWords + stats.complexWordCount,
                        totalResponseTimeMs: state.totalResponseTimeMs + stats.responseTimeMs,
                        sessions: newSessions
                    };

                    // Optimistic Sync to Supabase if configured (Requires user Auth, assuming anon/single user for now if keys exist)
                    if (hasSupabaseKeys()) {
                        // In a real app, you'd have user.id from Supabase Auth.
                        // Here we just update a generic row or rely on RLS policies.
                        supabase.from('profiles').upsert({
                            id: 'default-user-id', // Placeholder
                            fluency_score: Math.max(0, 100 - ((newState.grammarMistakes / newState.totalMessages) * 50)), // Quick estimate
                            total_messages: newState.totalMessages,
                            grammar_mistakes: newState.grammarMistakes,
                            total_word_count: newState.totalWordCount,
                            total_complex_words: newState.totalComplexWords,
                            total_response_time_ms: newState.totalResponseTimeMs
                        }).then(({ error }: { error: any }) => { if (error) console.warn("[Supabase Sync] Warning:", error?.message || JSON.stringify(error)) });

                        supabase.from('sessions').upsert({
                            id: 'default-user-id-' + today, // Placeholder
                            user_id: 'default-user-id',
                            date: today,
                            message_count: newState.sessions.find(s => s.date === today)?.messageCount || 1
                        }).then(({ error }: { error: any }) => { if (error) console.warn("[Supabase Sync] Warning:", error?.message || JSON.stringify(error)) });
                    }

                    return newState;
                });

                // Recalculate fluency
                get().updateFluencyScore();
            },

            addVocabulary: (word: string, context?: string, definition?: string) => {
                set((state) => {
                    // Prevent duplicates
                    if (state.vocabulary.some(v => v.word.toLowerCase() === word.toLowerCase())) {
                        return state;
                    }

                    const newWord: VocabularyWord = {
                        word,
                        context,
                        definition,
                        date: new Date().toLocaleDateString()
                    };

                    const nextState = {
                        vocabulary: [newWord, ...state.vocabulary].slice(0, 100) // Keep latest 100 words
                    };

                    if (hasSupabaseKeys()) {
                        supabase.from('vocabulary').insert({
                            user_id: 'default-user-id',
                            word,
                            context,
                            definition,
                            date: new Date().toISOString()
                        }).then(({ error }: { error: any }) => { if (error) console.warn("[Supabase Sync] Warning:", error?.message || JSON.stringify(error)) });
                    }

                    return nextState;
                });
            },

            updateFluencyScore: () => {
                set((state) => {
                    if (state.totalMessages === 0) return { fluencyScore: 100 };

                    // Advanced algorithm:
                    // Start at 100
                    // - Penalty for grammar mistakes (e.g., each mistake costs 5%)
                    // - Penalty for slow response (e.g., average response > 5000ms costs percentage)
                    // + Bonus for complex words

                    const mistakeRate = state.grammarMistakes / state.totalMessages;
                    const avgResponseTime = state.totalResponseTimeMs / state.totalMessages;
                    const complexWordRate = state.totalComplexWords / state.totalMessages;

                    let newScore = 100;

                    // Penalty: Grammar mistakes
                    newScore -= (mistakeRate * 50); // up to 50 pts penalty if every message has a mistake

                    // Penalty: Slow responses (expect <= 3000ms, penalize up to 20 pts for > 8000ms)
                    if (avgResponseTime > 3000) {
                        const slowPenalty = Math.min(20, ((avgResponseTime - 3000) / 5000) * 20);
                        newScore -= slowPenalty;
                    }

                    // Bonus: Complex words (up to +15 pts)
                    const complexBonus = Math.min(15, complexWordRate * 10);
                    newScore += complexBonus;

                    // Clamp between 0 and 100
                    newScore = Math.floor(Math.max(0, Math.min(100, newScore)));

                    return { fluencyScore: newScore };
                });
            },

            startConversation: (scenario?: string) => {
                const id = Date.now().toString();
                const newConv: Conversation = {
                    id,
                    title: "New Conversation",
                    date: new Date().toISOString(),
                    scenario,
                    messages: []
                };
                set((state) => ({
                    conversations: [newConv, ...state.conversations],
                    activeConversationId: id
                }));

                if (hasSupabaseKeys()) {
                    supabase.from('conversations').insert({
                        id,
                        user_id: 'default-user-id',
                        title: newConv.title,
                        scenario,
                        date: newConv.date
                    }).then(({ error }: { error: any }) => { if (error) console.warn("[Supabase Sync] Warning:", error?.message || JSON.stringify(error)) });
                }

                return id;
            },

            addChatMessage: (msg) => {
                set((state) => {
                    let activeId = state.activeConversationId;
                    let conversations = [...state.conversations];

                    // Auto-start if no active conversation exists
                    if (!activeId) {
                        activeId = Date.now().toString();
                        conversations = [{
                            id: activeId,
                            title: msg.content.substring(0, 30) + (msg.content.length > 30 ? "..." : ""),
                            date: new Date().toISOString(),
                            messages: []
                        }, ...conversations];
                    }

                    let finalTitle = "";

                    const convIndex = conversations.findIndex(c => c.id === activeId);
                    if (convIndex >= 0) {
                        const conv = conversations[convIndex];
                        // Auto-title on first message
                        let newTitle = conv.title;
                        if (conv.messages.length === 0 && msg.role === "user") {
                            newTitle = msg.content.substring(0, 30) + (msg.content.length > 30 ? "..." : "");
                        }

                        finalTitle = newTitle;

                        conversations[convIndex] = {
                            ...conv,
                            title: newTitle,
                            messages: [...conv.messages, msg]
                        };
                    }

                    // Sync message to Supabase
                    if (hasSupabaseKeys()) {
                        supabase.from('messages').insert({
                            id: msg.id,
                            conversation_id: activeId,
                            user_id: 'default-user-id',
                            role: msg.role,
                            content: msg.content,
                            correction: msg.correction
                        }).then(({ error }: { error: any }) => { if (error) console.warn("[Supabase Sync] Warning:", error?.message || JSON.stringify(error)) });

                        // Update conversation title if it changed
                        if (finalTitle !== "" && finalTitle !== conversations.find(c => c.id === activeId)?.title) {
                            supabase.from('conversations').update({ title: finalTitle }).eq('id', activeId)
                                .then(({ error }: { error: any }) => { if (error) console.error("Supabase Sync Error:", error) });
                        }
                    }

                    return { conversations, activeConversationId: activeId };
                });
            },

            updateChatMessage: (id, updates) => {
                set((state) => {
                    if (!state.activeConversationId) return state;
                    const conversations = [...state.conversations];
                    const activeIndex = conversations.findIndex(c => c.id === state.activeConversationId);
                    if (activeIndex >= 0) {
                        const conv = conversations[activeIndex];
                        const msgIndex = conv.messages.findIndex(m => m.id === id);
                        if (msgIndex >= 0) {
                            const newMessages = [...conv.messages];
                            newMessages[msgIndex] = { ...newMessages[msgIndex], ...updates };
                            conversations[activeIndex] = { ...conv, messages: newMessages };
                        }
                    }
                    return { conversations };
                });
            },

            deleteConversation: (id) => {
                set((state) => ({
                    conversations: state.conversations.filter(c => c.id !== id),
                    activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
                }));
            },

            setActiveConversation: (id) => {
                set({ activeConversationId: id });
            }
        }),
        {
            name: 'english-practice-progress', // unique name for localStorage key
        }
    )
);
