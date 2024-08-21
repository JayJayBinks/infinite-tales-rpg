<script>
    import { dev } from '$app/environment';
    import { inject } from '@vercel/analytics';
    import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

    injectSpeedInsights();
    inject({ mode: dev ? 'development' : 'production' });
</script>

<svelte:head>
    <script
            data-project-id="SfkFai2WWOHlSK8TCRwdJkstUbYY8BqxxLcuDOhP"
            data-is-production-environment={false}
            src="https://snippet.meticulous.ai/v1/meticulous.js"
    ></script>
</svelte:head>

<slot></slot>