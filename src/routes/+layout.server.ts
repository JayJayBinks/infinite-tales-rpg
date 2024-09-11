import { VERCEL_ENV } from '$env/static/private';

export function load() {
    return {
        VERCEL_ENV
    };
}