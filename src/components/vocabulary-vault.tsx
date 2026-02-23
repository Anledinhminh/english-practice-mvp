"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Volume2, Trash2, BrainCircuit, Check, X, ArrowRight, RotateCcw } from "lucide-react";
import { useProgressStore, VocabularyWord } from "@/lib/store";

export function VocabularyVault() {
    const { vocabulary, updateVocabularyStatus, deleteVocabulary } = useProgressStore();
    const [reviewMode, setReviewMode] = useState(false);
    const [filter, setFilter] = useState<"all" | "new" | "learning" | "mastered">("all");

    // Flashcard state
    const [reviewCards, setReviewCards] = useState<VocabularyWord[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showBack, setShowBack] = useState(false);

    const filteredVocab = vocabulary.filter(v => filter === "all" || v.status === filter || (!v.status && filter === "new"));

    const playAudio = (text: string) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const startReview = () => {
        // Prioritize 'new' and 'learning' words for review
        const toReview = vocabulary.filter(v => v.status !== "mastered").sort(() => Math.random() - 0.5).slice(0, 10);
        if (toReview.length === 0) {
            // If all mastered, review random 10
            setReviewCards([...vocabulary].sort(() => Math.random() - 0.5).slice(0, 10));
        } else {
            setReviewCards(toReview);
        }
        setCurrentIndex(0);
        setShowBack(false);
        setReviewMode(true);
    };

    const handleReviewResult = (status: "learning" | "mastered") => {
        const word = reviewCards[currentIndex].word;
        updateVocabularyStatus(word, status);

        if (currentIndex < reviewCards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setShowBack(false);
        } else {
            setReviewMode(false); // End of review
        }
    };

    if (reviewMode && reviewCards.length > 0) {
        const currentCard = reviewCards[currentIndex];
        return (
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border-2 border-slate-200 min-h-[300px] w-full text-center relative">
                <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-slate-400 hover:text-slate-600" onClick={() => setReviewMode(false)}>
                    <X className="w-4 h-4" />
                </Button>

                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
                    Card {currentIndex + 1} of {reviewCards.length}
                </span>

                <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-4xl font-bold text-slate-800">{currentCard.word}</h3>
                    <Button variant="ghost" size="icon" className="hover:bg-slate-200 rounded-full" onClick={() => playAudio(currentCard.word)}>
                        <Volume2 className="w-5 h-5 text-blue-600" />
                    </Button>
                </div>

                {!showBack ? (
                    <Button className="mt-8" onClick={() => setShowBack(true)}>Show Definition</Button>
                ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        {currentCard.definition && <p className="text-lg text-slate-600 mb-2">{currentCard.definition}</p>}
                        {currentCard.context && <p className="text-sm italic text-slate-500 mb-8 max-w-sm">"{currentCard.context}"</p>}

                        <p className="text-sm font-medium text-slate-700 mb-4">How well did you know this?</p>
                        <div className="flex gap-4 w-full justify-center">
                            <Button variant="outline" className="border-red-200 hover:bg-red-50 hover:text-red-600" onClick={() => handleReviewResult("learning")}>
                                <RotateCcw className="w-4 h-4 mr-2" /> Needs Practice
                            </Button>
                            <Button variant="outline" className="border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => handleReviewResult("mastered")}>
                                <Check className="w-4 h-4 mr-2" /> Mastered
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(["all", "new", "learning", "mastered"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                {vocabulary.length > 0 && (
                    <Button onClick={startReview} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                        <BrainCircuit className="w-4 h-4 mr-2" /> Review Flashcards
                    </Button>
                )}
            </div>

            {/* List */}
            {vocabulary.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                    No vocabulary saved yet. Highlight any word in the chat to define and save it!
                </div>
            ) : filteredVocab.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    No words found in this category.
                </div>
            ) : (
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredVocab.map((v, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors group">
                            <div className="flex flex-col flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-slate-800 text-lg">{v.word}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-600" onClick={() => playAudio(v.word)}>
                                        <Volume2 className="w-4 h-4" />
                                    </Button>
                                    <Badge variant={v.status === "mastered" ? "default" : v.status === "learning" ? "secondary" : "outline"} className="text-[10px] ml-2">
                                        {v.status || "new"}
                                    </Badge>
                                </div>
                                {v.definition && <span className="text-sm text-slate-600 mb-1">{v.definition}</span>}
                                {v.context && <span className="text-xs text-slate-500 italic">"{v.context}"</span>}
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-center mt-2 sm:mt-0"
                                onClick={() => deleteVocabulary(v.word)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

