"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, Square, Play, Loader2, AlertCircle } from "lucide-react";
import { useProgressStore, ChatMessage } from "@/lib/store";

export function ChatInterface() {
    const { conversations, activeConversationId, addMessage, addVocabulary, addChatMessage, updateChatMessage, startConversation, setActiveConversation, setUserId } = useProgressStore();
    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = activeConversation ? activeConversation.messages : [];

    const [selectedScenario, setSelectedScenario] = useState("casual");

    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [audioBlobs, setAudioBlobs] = useState<Record<string, Blob>>({});

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Text Selection State
    const [selection, setSelection] = useState<{ text: string, context: string, x: number, y: number, isSelecting: boolean } | null>(null);
    const [isDefining, setIsDefining] = useState(false);

    // Fluency Metrics State
    const lastAiTimeRef = useRef<number | null>(null);
    const recordingStartTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Handle initial Supabase Auth for session tracking
    useEffect(() => {
        import("@/lib/supabase").then(({ supabase, hasSupabaseKeys }) => {
            if (hasSupabaseKeys()) {
                supabase.auth.signInAnonymously().then(({ data, error }: { data: any; error: any }) => {
                    if (data?.user) {
                        setUserId(data.user.id);
                        console.log("Signed in anonymously as:", data.user.id);
                    } else if (error) {
                        console.error("Anon Auth failed:", error);
                    }
                });
            }
        });
    }, [setUserId]);

    // Handle Text Selection
    useEffect(() => {
        const handleSelection = () => {
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.toString().trim().length > 0 && !isRecording) {
                const text = currentSelection.toString().trim();

                // Only allow selecting words (no more than 3 words)
                if (text.split(' ').length > 3) {
                    setSelection(null);
                    return;
                }

                // Get surrounding context (the message content)
                let context = "";
                let node: Node | null = currentSelection.anchorNode;
                while (node && node.nodeName !== 'P' && node.nodeName !== 'DIV') {
                    node = node.parentNode;
                }
                if (node && node.textContent) {
                    context = node.textContent;
                }

                const range = currentSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                setSelection({
                    text,
                    context,
                    x: rect.x + (rect.width / 2),
                    y: rect.y - 10,
                    isSelecting: true
                });
            } else {
                // Delay hiding slightly to allow clicking the button
                setTimeout(() => {
                    const activeSelection = window.getSelection();
                    if (!activeSelection || activeSelection.toString().trim().length === 0) {
                        setSelection(null);
                    }
                }, 200);
            }
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, [isRecording]);

    const handleDefineAndSave = async () => {
        if (!selection) return;
        setIsDefining(true);
        try {
            const res = await fetch('/api/dictionary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: selection.text, context: selection.context })
            });
            if (!res.ok) throw new Error("Dictionary lookup failed");
            const data = await res.json();

            addVocabulary(selection.text, selection.context, data.definition);

            // Clear selection visually
            window.getSelection()?.removeAllRanges();
            setSelection(null);

            // Could add a toast here in the future
            alert(`Saved! ${selection.text}: ${data.definition}`);
        } catch (err) {
            console.error(err);
            alert("Failed to get definition.");
        } finally {
            setIsDefining(false);
        }
    };

    const startRecording = async () => {
        try {
            // Track response time
            recordingStartTimeRef.current = Date.now();

            // Auto start conversation with scenario if it's the first message
            if (!activeConversationId) {
                const newId = startConversation(selectedScenario);
                setActiveConversation(newId);
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await handleAudioSubmission(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Microphone access is required for this app.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks to release the mic
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleAudioSubmission = async (audioBlob: Blob) => {
        setIsProcessing(true);
        setErrorMsg(null);
        try {
            // 1. STT: Transcribe user's audio
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const sttRes = await fetch("/api/stt", { method: "POST", body: formData });

            if (!sttRes.ok) {
                const errorData = await sttRes.json().catch(() => ({}));
                throw new Error(`STT failed: ${errorData.error || sttRes.statusText}`);
            }

            const sttData = await sttRes.json();
            const userText = sttData.text || "Could not transcribe audio.";

            // Calculate advanced fluency metrics
            let responseTimeMs = 0;
            if (lastAiTimeRef.current && recordingStartTimeRef.current) {
                responseTimeMs = recordingStartTimeRef.current - lastAiTimeRef.current;
                responseTimeMs = Math.min(30000, Math.max(0, responseTimeMs)); // Cap between 0 and 30s
            }

            const words = userText.trim().split(/\s+/);
            const wordCount = words.length > 0 && words[0] !== "" ? words.length : 0;
            const complexWordCount = words.filter((w: string) => w.replace(/[^a-zA-Z]/g, '').length > 6).length;

            const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: userText };
            setAudioBlobs(prev => ({ ...prev, [newUserMsg.id]: audioBlob }));
            addChatMessage(newUserMsg);

            // 2. Chat: Get AI response and potential grammar correction
            // We use the messages array directly (it will not yet include the newUserMsg we just dispatched due to react batching)
            const chatContext = messages.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
            chatContext.push({ role: "user", content: userText });

            const chatRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: chatContext,
                    scenario: activeConversation?.scenario || selectedScenario
                }),
            });
            if (!chatRes.ok) throw new Error("Chat failed");

            const chatData = await chatRes.json();

            // Update user message with ghost correction if provided
            const hasCorrection = chatData.correction && chatData.correction.trim() !== "";
            if (hasCorrection) {
                updateChatMessage(newUserMsg.id, { correction: chatData.correction });
            }

            // Save progress to Zustand with advanced stats
            addMessage({
                hasGrammarMistake: hasCorrection,
                responseTimeMs,
                wordCount,
                complexWordCount
            });

            const newAiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "ai",
                content: chatData.response
            };

            addChatMessage(newAiMsg);

            // Auto-play AI response using browser TTS
            const utterance = new SpeechSynthesisUtterance(chatData.response);
            utterance.lang = "en-US";
            utterance.onend = () => {
                lastAiTimeRef.current = Date.now(); // Start timer for user's response time when AI finishes speaking
            };
            window.speechSynthesis.speak(utterance);

        } catch (error: any) {
            console.error("Pipeline error:", error);
            setErrorMsg(error.message || "An unknown error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const playAudio = (msg: ChatMessage) => {
        if (msg.role === "user" && audioBlobs[msg.id]) {
            const url = URL.createObjectURL(audioBlobs[msg.id]);
            const audio = new Audio(url);
            audio.play();
        } else if (msg.role === "ai") {
            const utterance = new SpeechSynthesisUtterance(msg.content);
            utterance.lang = "en-US";
            window.speechSynthesis.speak(utterance);
        }
    };

    return (
        <Card className="flex flex-col h-[600px] w-full max-w-2xl mx-auto shadow-xl border-slate-200">
            <div className="p-4 bg-slate-900 text-white rounded-t-xl shrink-0">
                <h2 className="text-xl font-semibold">Tutor AI</h2>
                <p className="text-sm text-slate-400">Fluency over perfection</p>
            </div>

            <ScrollArea className="flex-1 p-4 bg-slate-50 relative" ref={scrollRef}>

                {/* Selection Popover */}
                {selection && selection.isSelecting && (
                    <div
                        className="fixed z-50 transform -translate-x-1/2 -translate-y-full pb-2 pointer-events-auto"
                        style={{ left: selection.x, top: selection.y, transition: 'all 0.1s ease-out' }}
                    >
                        <Button
                            size="sm"
                            className="shadow-lg rounded-full bg-slate-900 border border-slate-700 hover:bg-slate-800 animate-in fade-in zoom-in duration-200"
                            onClick={(e) => {
                                e.preventDefault();
                                handleDefineAndSave();
                            }}
                            disabled={isDefining}
                        >
                            {isDefining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "📚"}
                            {isDefining ? "Defining..." : `Define "${selection.text}"`}
                        </Button>
                    </div>
                )}

                <div className="flex flex-col gap-6 pb-4">
                    {errorMsg && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 flex items-start gap-2 text-sm max-w-[80%] mx-auto sticky top-0 z-10 shadow-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    {messages.length === 0 && (
                        <div className="flex flex-col items-center text-center mt-10">
                            <h3 className="text-lg font-medium text-slate-700 mb-2">Choose your scenario</h3>
                            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
                                {[
                                    { id: "casual", label: "Casual Chat", icon: "☕️" },
                                    { id: "interview", label: "Job Interview", icon: "💼" },
                                    { id: "restaurant", label: "Restaurant", icon: "🍽️" },
                                    { id: "travel", label: "Travel & Airport", icon: "✈️" }
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedScenario(s.id)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${selectedScenario === s.id
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className="text-2xl">{s.icon}</span>
                                        <span className="text-sm font-medium">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-slate-400">Tap the microphone to start practicing!</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                            <div
                                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-tr-sm"
                                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    <p className="leading-relaxed">{msg.content}</p>

                                    {/* Playback Button */}
                                    {(msg.role === "ai" || audioBlobs[msg.id]) && (
                                        <button
                                            onClick={() => playAudio(msg)}
                                            className="mt-1 opacity-70 hover:opacity-100 transition-opacity"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ghost Correction */}
                            {msg.role === "user" && msg.correction && (
                                <div className="mt-1 max-w-[80%] text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <span className="opacity-70">💡 Suggested:</span> {msg.correction}
                                </div>
                            )}
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="flex items-start">
                            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2 text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">AI is thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-6 bg-white border-t flex justify-center items-center rounded-b-xl shrink-0">
                <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={`rounded-full w-20 h-20 shadow-lg transition-transform ${isRecording ? 'animate-pulse scale-105' : 'hover:scale-105'}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing}
                >
                    {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>
            </div>
        </Card>
    );
}
