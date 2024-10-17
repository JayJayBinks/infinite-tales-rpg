import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			colors: {
				'infinity-blue': '#339AF0'
			}
		}
	},
	daisyui: {
		themes: ['business']
	},

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	plugins: [require('@tailwindcss/typography'), require('daisyui')]
} as Config;
