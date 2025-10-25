import { devices, type PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 20 * 1000,
		reuseExistingServer: !process.env.CI,
	},
	testDir: 'e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	timeout: 60 * 1000,
  use: {
		baseURL: 'http://localhost:4173',
  },
	reporter: 'list',
	fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
	projects: [
		{
			name: 'chromium',
			use: {
				launchOptions: {
					executablePath: '/usr/bin/chromium-browser',
				},
			},
		},
	],
};

export default config;
