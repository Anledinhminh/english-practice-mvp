"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProgressStore } from "@/lib/store";
import { VocabularyVault } from "./vocabulary-vault";

export function DashboardMockup() {
    const [mounted, setMounted] = useState(false);
    const { fluencyScore, sessions, vocabulary } = useProgressStore();

    // Ensure hydration matches since we use localStorage (zustand persist)
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="text-center p-8 text-slate-500">Loading your progress...</div>;
    }

    // Generate an array of 84 days (approx 12 weeks) ending today
    const generateHeatmap = () => {
        const data = [];
        const today = new Date();

        for (let i = 83; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];

            const session = sessions.find(s => s.date === dateString);
            const count = session ? session.messageCount : 0;

            // Map count to color level (0 to 4)
            let level = 0;
            if (count > 0 && count <= 5) level = 1;
            else if (count > 5 && count <= 15) level = 2;
            else if (count > 15 && count <= 30) level = 3;
            else if (count > 30) level = 4;

            data.push({ date: dateString, level, count });
        }
        return data;
    };

    const activityData = generateHeatmap();

    return (
        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
            {/* Fluency Index */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-center">
                        Fluency Index
                        <span className="text-2xl font-bold text-blue-600">
                            {sessions.length === 0 ? "N/A" : `${fluencyScore}/100`}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Progress value={fluencyScore} className="h-3 bg-slate-100" />
                    <p className="text-sm text-slate-500 mt-2">
                        {fluencyScore >= 90 ? "Excellent natural phrasing! Keep it up." :
                            fluencyScore >= 70 ? "Good progress. Pay attention to subtle grammar tips." :
                                "Focus on clear, simple sentence structures to improve fluency."}
                    </p>
                </CardContent>
            </Card>

            {/* Activity Heatmap */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Activity History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-1">
                        {activityData.map((day, i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-sm transition-colors ${day.level === 0 ? "bg-slate-100" :
                                    day.level === 1 ? "bg-emerald-200" :
                                        day.level === 2 ? "bg-emerald-300" :
                                            day.level === 3 ? "bg-emerald-400" :
                                                "bg-emerald-600"
                                    }`}
                                title={`${day.date}: ${day.count} messages`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                        <span>12 weeks ago</span>
                        <span>Today</span>
                    </div>
                </CardContent>
            </Card>

            {/* Vocabulary Vault */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg text-slate-800">
                        Vocabulary Vault ({vocabulary.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <VocabularyVault />
                </CardContent>
            </Card>
        </div>
    );
}
