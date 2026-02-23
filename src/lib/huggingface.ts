import { HfInference } from "@huggingface/inference";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!HF_API_KEY) {
    console.warn("HUGGINGFACE_API_KEY is not set in environment variables.");
}

const hf = new HfInference(HF_API_KEY);

export async function hfChat(messages: { role: string; content: string }[]) {
    try {
        // Automatically mapped to router.huggingface.co by the SDK
        const response = await hf.chatCompletion({
            model: "meta-llama/Meta-Llama-3-8B-Instruct",
            messages: messages as any,
            max_tokens: 500,
            temperature: 0.7,
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error("Empty response from HF Chat");
        }

        return response;
    } catch (error: any) {
        throw new Error("HF Chat API error: " + error.message);
    }
}

export async function hfStt(audioBlob: Blob, contentType: string = "audio/webm") {
    console.log(`[HF STT] Preparing to send audio to Whisper via SDK. Size: ${audioBlob.size} bytes, Type: ${contentType}`);
    try {
        // Use the official SDK which automatically handles routing and model fallbacks
        // Pass the Blob directly so the SDK can extract the content-type (e.g., 'audio/webm')
        const response = await hf.automaticSpeechRecognition({
            model: "openai/whisper-large-v3",
            data: audioBlob,
            provider: "hf-inference"
        });

        console.log(`[HF STT] Transcription success via SDK:`, response);
        return { text: response.text };
    } catch (error: any) {
        console.error(`[HF STT] SDK Error:`, error);
        throw new Error(`HF STT SDK error: ${error.message}`);
    }
}

