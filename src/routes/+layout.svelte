<script lang="ts">
	import { inject } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { resetAllState } from '$lib/state/stores';

	let { children, data } = $props();
	const mode = data.VERCEL_ENV || 'development';
	if (mode === 'production') {
		injectSpeedInsights();
		inject({ mode: 'production' });
	}

	if (typeof window !== 'undefined') {
		(window as unknown as { __resetAllState?: () => Promise<void> }).__resetAllState = async () => {
			await resetAllState();
		};
	}
</script>

{@render children()}
