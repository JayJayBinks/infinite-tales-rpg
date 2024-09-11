<script>
    import {env} from '$env/dynamic/public';
    import {inject} from '@vercel/analytics';
    import {injectSpeedInsights} from '@vercel/speed-insights/sveltekit';

    const mode = env.VERCEL_ENV || 'development';
    console.log('VERCEL_ENV is', mode);
    if (mode === 'production') {
        injectSpeedInsights();
        inject({mode: 'production'});
    }
</script>

<slot></slot>