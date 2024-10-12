<script lang="ts">
    import {inject} from '@vercel/analytics';
    import {injectSpeedInsights} from '@vercel/speed-insights/sveltekit';

    let {children, data} = $props();
    const mode = data.VERCEL_ENV || 'development';
    if (mode === 'production') {
        injectSpeedInsights();
        inject({mode: 'production'});
    }
</script>

{@render children()}
