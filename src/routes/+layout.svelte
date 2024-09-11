<script>
    import { VERCEL_ENV } from '$env/static/private';
    import {inject} from '@vercel/analytics';
    import {injectSpeedInsights} from '@vercel/speed-insights/sveltekit';

    const mode = VERCEL_ENV || 'development';
    console.log('VERCEL_ENV is', VERCEL_ENV);
    if (mode === 'production') {
        injectSpeedInsights();
        inject({mode: 'production'});
    }
</script>

<slot></slot>