<script>
    import {inject} from '@vercel/analytics';
    import {injectSpeedInsights} from '@vercel/speed-insights/sveltekit';

    export let data;
    const mode = data.VERCEL_ENV || 'development';
    console.log('data is', data);
    if (mode === 'production') {
        injectSpeedInsights();
        inject({mode: 'production'});
    }
</script>

{JSON.stringify(data)}

<slot></slot>