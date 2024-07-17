import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {}
	},
	daisyui: {
		themes: ["forest"],
	},

	plugins: [
		require('daisyui'),
	],
} as Config;
