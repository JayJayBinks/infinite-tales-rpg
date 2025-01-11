import { MsEdgeTTS } from 'msedge-tts';
import { json } from '@sveltejs/kit';

export async function GET({ setHeaders }) {
	const tts = new MsEdgeTTS();
	//cache one year and never revalidate
	setHeaders({
		'cache-control': 'public, max-age=604800, immutable'
	});
	return json(await tts.getVoices());
}
