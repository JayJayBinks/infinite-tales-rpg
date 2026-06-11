import { env } from '$env/dynamic/private';

export function load() {
	return {
		VERCEL_ENV: env.VERCEL_ENV
	};
}
