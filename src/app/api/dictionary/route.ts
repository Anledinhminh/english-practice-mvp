import { NextResponse } from 'next/server';
import { HfInference } from "@huggingface/inference";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!HF_API_KEY) {
    console.warn("HUGGINGFACE_API_KEY is not set in environment variables.");
}

const hf = new HfInference(HF_API_KEY);

const SYSTEM_PROMPT = `
You are an English dictionary and vocabulary assistant. 
The user will provide a WORD and the CONTEXT SENTENCE it appeared in.
Provide a concise, easy-to-understand definition of the word exactly as it is used in the given context.
Keep the definition to 1-2 short sentences maximum.

Format your response strictly as a JSON object:
{
  "definition": "The concise definition here."
}
Respond ONLY with valid JSON.
`;

export async function POST(req: Request) {
    try {
        const { word, context } = await req.json();

        if (!word || word.length > 50) {
            return NextResponse.json({ error: 'Word is missing or too long' }, { status: 400 });
        }

        if (context && context.length > 500) {
            return NextResponse.json({ error: 'Context is too long' }, { status: 400 });
        }

        const apiMessages: any = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Define this word: <word>${word}</word>\nFound in this text: <context>${context || 'No context provided.'}</context>` }
        ];

        const response = await hf.chatCompletion({
            model: "meta-llama/Meta-Llama-3-8B-Instruct",
            messages: apiMessages,
            max_tokens: 150,
            temperature: 0.3,
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error("Empty response from HF");
        }

        let aiResponseText = response.choices[0].message.content || "";
        let parsedContent;

        try {
            const jsonStart = aiResponseText.indexOf('{');
            const jsonEnd = aiResponseText.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                aiResponseText = aiResponseText.substring(jsonStart, jsonEnd + 1);
            }
            parsedContent = JSON.parse(aiResponseText);
        } catch (e) {
            parsedContent = { definition: aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim() };
        }

        return NextResponse.json(parsedContent);
    } catch (error: any) {
        console.error("[Dictionary API Error] (Hidden from Client):", error.message || error);
        return NextResponse.json(
            { error: "Dictionary service is currently unavailable." },
            { status: 500 }
        );
    }
}
