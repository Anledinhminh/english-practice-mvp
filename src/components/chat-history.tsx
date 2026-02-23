"use client";

import { useProgressStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare, PlusCircle } from "lucide-react";

export function ChatHistory({ onSelect }: { onSelect: () => void }) {
    const { conversations, setActiveConversation, deleteConversation, activeConversationId, startConversation } = useProgressStore();

    const handleNewChat = () => {
        startConversation();
        onSelect();
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold text-slate-800">Your Conversations</h2>
                <Button onClick={handleNewChat} className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    New Chat
                </Button>
            </div>

            {conversations.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 bg-white">
                    No conversation history yet. Start a new chat!
                </div>
            ) : (
                conversations.map((conv) => (
                    <Card
                        key={conv.id}
                        className={`transition-all ${activeConversationId === conv.id ? 'border-blue-400 shadow-md ring-1 ring-blue-400 relative' : 'hover:border-slate-300'}`}
                    >
                        {activeConversationId === conv.id && (
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                                Active
                            </div>
                        )}
                        <div className="flex items-center justify-between p-4">
                            <div
                                className="flex-1 cursor-pointer pr-4"
                                onClick={() => {
                                    setActiveConversation(conv.id);
                                    onSelect();
                                }}
                            >
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <MessageSquare className={`w-4 h-4 ${activeConversationId === conv.id ? 'text-blue-500' : 'text-slate-400'}`} />
                                    {conv.title}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {new Date(conv.date).toLocaleString()} • {conv.messages.length} messages
                                </p>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("Delete this conversation?")) {
                                        deleteConversation(conv.id);
                                    }
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}
