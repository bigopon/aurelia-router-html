// @ts-check
const pkg = require('./package.json');
const config = require('./playwright-util')(pkg);

module.exports = {
  ...config,
  testDir: './playwright',
  ...(process.env.PLAYWRIGHT_CI_WEBSERVER === '1'
    ? {
        webServer: {
          command: 'npm run dev:host',
          port: pkg.port,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }
    : {}),
};
