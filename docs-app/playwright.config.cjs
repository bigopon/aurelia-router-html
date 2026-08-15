// @ts-check
const getPlaywrightConfig = require('../playwright-util');

module.exports = {
  ...getPlaywrightConfig({ port: 9027 }, 1),
  testDir: './playwright',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    port: 9027,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
};
