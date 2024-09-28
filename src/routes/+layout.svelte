<script>
    import {inject} from '@vercel/analytics';
    import {injectSpeedInsights} from '@vercel/speed-insights/sveltekit';

    export let data;
    const mode = data.VERCEL_ENV || 'development';
    if (mode === 'production') {
        injectSpeedInsights();
        inject({mode: 'production'});
    }
</script>

<slot></slot>
