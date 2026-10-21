// Playwright config for the e2e check against the docker Splunk.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '*.spec.js',
    timeout: 240000,
    retries: 1,
    workers: 1, // one Splunk serves every spec file
    outputDir: 'e2e-results',
    use: {
        baseURL: process.env.SPLUNK_WEB_URL || 'http://localhost:8000',
        ignoreHTTPSErrors: true,
        viewport: { width: 1600, height: 1000 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    reporter: [['list']],
});
