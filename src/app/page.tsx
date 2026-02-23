"use client";

import { useState, useEffect } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { DashboardMockup } from "@/components/dashboard-mockup";
import { ChatHistory } from "@/components/chat-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressStore } from "@/lib/store";

export default function Home() {
  const [activeTab, setActiveTab] = useState("chat");
  const [mounted, setMounted] = useState(false);

  // We need to ensure client-side rendering matches for Zustand persistence
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            English Practice <span className="text-blue-600">MVP</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Focus on sounding natural. AI understands you and gives gentle ghost corrections when needed.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8 bg-slate-200/50 p-1">
            <TabsTrigger value="chat" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Practice Chat
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Chat History
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Progress Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            <ChatInterface />
          </TabsContent>

          <TabsContent value="history" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            <ChatHistory onSelect={() => setActiveTab("chat")} />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            <DashboardMockup />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
