import { NextResponse } from 'next/server';
import { hfStt } from '@/lib/huggingface';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as Blob | null;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        const contentType = audioFile.type || 'audio/webm';
        const result = await hfStt(audioFile, contentType);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("STT Route Error Details:", error);

        // Pass original Hugging Face error message down if possible
        const errorMessage = error.message.includes("{")
            ? error.message
            : JSON.stringify({ error: error.message });

        return new NextResponse(errorMessage, {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
