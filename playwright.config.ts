import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 120000,
		reuseExistingServer: !process.env.CI,
	},
	testDir: 'e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	timeout: 60000,
	use: {
		baseURL: 'http://localhost:4173',
		// Use system chromium if available
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
		},
	},
	projects: [
		{
			name: 'chromium',
			use: {
				channel: undefined,
			},
		},
	],
};

export default config;
