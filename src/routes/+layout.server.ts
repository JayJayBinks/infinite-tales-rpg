// @ts-expect-error VERCEL_ENV is present
import { env } from '$env/dynamic/private';

/**
 * Expose deployment environment to the root layout.
 * Uses dynamic env import so local dev (where VERCEL_ENV may be absent) doesn't break the build.
 */
export function load() {
	const vercelEnv = env.VERCEL_ENV ?? 'development';
	return {
		VERCEL_ENV: vercelEnv
	};
}
