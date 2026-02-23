import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const hasSupabaseKeys = () => {
    return supabaseUrl !== '' && supabaseUrl !== 'your_supabase_project_url_here' &&
        supabaseAnonKey !== '' && supabaseAnonKey !== 'your_supabase_anon_key_here';
};

// Initialize the Supabase client conditionally.
export const supabase = hasSupabaseKeys() ? createClient(supabaseUrl, supabaseAnonKey) : null as any;

// --- Database Schema Definitions (For Reference / Future Migration) ---
/*
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    fluency_score INTEGER DEFAULT 100,
    total_messages INTEGER DEFAULT 0,
    grammar_mistakes INTEGER DEFAULT 0,
    total_word_count INTEGER DEFAULT 0,
    total_complex_words INTEGER DEFAULT 0,
    total_response_time_ms INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.conversations (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    title TEXT NOT NULL,
    scenario TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'ai'
    content TEXT NOT NULL,
    correction TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.vocabulary (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    word TEXT NOT NULL,
    context TEXT,
    definition TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, word)
);

CREATE TABLE public.sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- SECURITY: Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users edit own profile" ON profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users edit own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users edit own messages" ON messages FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users edit own vocabulary" ON vocabulary FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users edit own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);
*/
