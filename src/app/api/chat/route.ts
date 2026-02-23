import { NextResponse } from 'next/server';
import { hfChat } from '@/lib/huggingface';

export async function POST(req: Request) {
    try {
        const { messages, scenario } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        let persona = "You are a friendly and encouraging native English speaker practicing conversation with a learner.";
        if (scenario === "interview") {
            persona = "You are a professional HR manager conducting a job interview. Ask relevant interview questions and keep a formal but encouraging tone.";
        } else if (scenario === "restaurant") {
            persona = "You are a polite waiter at a nice restaurant. The user is a customer ordering food. Keep the conversation focused on the dining experience.";
        } else if (scenario === "travel") {
            persona = "You are an airport official or travel agent assisting a traveler. Help them with directions, tickets, or travel advice.";
        }

        const FINAL_SYSTEM_PROMPT = `
${persona}
Keep your responses natural, conversational, and fairly brief (1-3 sentences) to encourage back-and-forth dialogue.
If the user makes a significant grammatical error or unnatural phrasing, you must provide a "ghost correction" seamlessly.

Format your response strictly as a JSON object with two fields:
{
  "response": "Your natural conversational reply to the user.",
  "correction": "The grammatically correct version of what the user just said (leave empty string if the user's English was natural and correct)."
}

Respond ONLY with valid JSON. Do not include any other text outside the JSON block.
`;

        // Truncate history to last 10 messages (approx 5 conversational turns) to prevent Context Window/Token limits
        const recentMessages = messages.slice(-10);

        const apiMessages = [
            { role: "system", content: FINAL_SYSTEM_PROMPT },
            ...recentMessages
        ];

        const result = await hfChat(apiMessages);

        // Attempt to parse the expected JSON response from the LLM
        let aiResponseText = result.choices?.[0]?.message?.content || "";
        let parsedContent;
        try {
            // Find JSON fences or parse directly
            const jsonStart = aiResponseText.indexOf('{');
            const jsonEnd = aiResponseText.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                aiResponseText = aiResponseText.substring(jsonStart, jsonEnd + 1);
            }
            parsedContent = JSON.parse(aiResponseText);
        } catch (e) {
            // Fallback if the LLM doesn't output strict JSON
            parsedContent = {
                response: aiResponseText,
                correction: ""
            };
        }

        return NextResponse.json(parsedContent);
    } catch (error: any) {
        console.error("[Chat API Error] (Hidden from Client):", error.message || error);
        return NextResponse.json(
            { error: "The AI Tutor is currently overloaded. Please try again in a few moments." },
            { status: 500 }
        );
    }
}
