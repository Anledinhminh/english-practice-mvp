"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, LogOut, User } from "lucide-react";
import { supabase, hasSupabaseKeys } from "@/lib/supabase";
import { useProgressStore } from "@/lib/store";

export function AuthModal() {
    const { userId, setUserId } = useProgressStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Check active session on mount
    useEffect(() => {
        if (!hasSupabaseKeys()) return;

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }: any) => {
            if (session?.user && !session.user.is_anonymous) {
                setUserId(session.user.id);
                setUserEmail(session.user.email || null);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            if (session?.user) {
                if (!session.user.is_anonymous) {
                    setUserId(session.user.id);
                    setUserEmail(session.user.email || null);
                } else {
                    // It's an anonymous user 
                    setUserId(session.user.id);
                    setUserEmail(null);
                }
            } else {
                // Logged out
                setUserEmail(null);
                // We fallback to a generic local ID to prevent crashes, then trigger anon auth again in chat-interface
                setUserId('local-user-' + Math.random().toString(36).substring(7));
            }
        });

        return () => subscription.unsubscribe();
    }, [setUserId]);

    const handleAuth = async (type: "login" | "signup", e: React.FormEvent) => {
        e.preventDefault();
        if (!hasSupabaseKeys()) {
            setErrorMsg("Supabase is not configured.");
            return;
        }

        setIsLoading(true);
        setErrorMsg(null);

        try {
            let error;
            if (type === "signup") {
                const res = await supabase.auth.signUp({ email, password });
                error = res.error;
                if (!error && res.data.user) {
                    // Check if email confirmation is required by Supabase settings
                    if (res.data.user.identities?.length === 0) {
                        setErrorMsg("Email already in use or please check your inbox for confirmation.");
                        setIsLoading(false);
                        return;
                    }
                }
            } else {
                const res = await supabase.auth.signInWithPassword({ email, password });
                error = res.error;
            }

            if (error) {
                setErrorMsg(error.message);
            } else {
                setIsOpen(false);
                setEmail("");
                setPassword("");
            }
        } catch (err: any) {
            setErrorMsg(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        await supabase.auth.signOut();
        setIsLoading(false);
        // Page reload can help clear aggressively cached zustand state if needed, but we'll try smooth transition first
    };

    if (!hasSupabaseKeys()) return null;

    if (userEmail) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-500 font-medium">Logged in as</span>
                    <span className="text-sm font-semibold text-slate-800">{userEmail}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoading} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                    Log Out
                </Button>
            </div>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <User className="w-4 h-4 mr-2" />
                    Sign In to Save Progress
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Account Access</DialogTitle>
                    <DialogDescription>
                        Sign in to sync your fluency score, vocabulary, and chat history across all your devices.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="login" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    {/* Login Form */}
                    <TabsContent value="login">
                        <form onSubmit={(e) => handleAuth("login", e)} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                            {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                                Sign In
                            </Button>
                        </form>
                    </TabsContent>

                    {/* Sign Up Form */}
                    <TabsContent value="signup">
                        <form onSubmit={(e) => handleAuth("signup", e)} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="signup-email">Email</Label>
                                <Input id="signup-email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signup-password">Password</Label>
                                <Input id="signup-password" type="password" placeholder="Min 6 characters" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                            {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <User className="w-4 h-4 mr-2" />}
                                Create Account
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

