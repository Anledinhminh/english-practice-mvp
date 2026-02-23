import { NextResponse } from 'next/server';
import { hfStt } from '@/lib/huggingface';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as Blob | null;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        // Limit audio file size to 5MB to prevent OOM
        if (audioFile.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'Audio file too large. Please keep recordings under 1 minute.' }, { status: 413 });
        }

        const contentType = audioFile.type || 'audio/webm';
        const result = await hfStt(audioFile, contentType);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[STT API Error] (Hidden from Client):", error.message || error);

        // Return a generic error to the frontend
        return NextResponse.json(
            { error: "Audio processing failed. The AI service may be temporarily overloaded." },
            { status: 500 }
        );
    }
}
