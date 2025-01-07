import { MsEdgeTTS } from 'msedge-tts';
import { json } from '@sveltejs/kit';

export async function GET() {
	const tts = new MsEdgeTTS();
	return json(await tts.getVoices());
}
