import { MsEdgeTTS } from 'msedge-tts';
import { json } from '@sveltejs/kit';

export async function GET({ setHeaders }) {
	const tts = new MsEdgeTTS();
	//cache one year and never revalidate
	const cacheControlString = 'public, max-age=604800, immutable';
	setHeaders({
		'cache-control': cacheControlString,
		'CDN-Cache-Control': cacheControlString,
		'Vercel-CDN-Cache-Control': cacheControlString
	});
	return json(await tts.getVoices());
}
