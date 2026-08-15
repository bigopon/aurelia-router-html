// @ts-check
const path = require('node:path');
const getPlaywrightConfig = require('../playwright-util');
const port = Number(process.env.APP_PORT ?? 9027);
const vite = path.resolve(__dirname, '../node_modules/vite/bin/vite.js');
const shared = getPlaywrightConfig({ port }, 1);

module.exports = {
  ...shared,
  use: {
    ...shared.use,
    baseURL: `http://127.0.0.1:${port}`,
  },
  testDir: './playwright',
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
    ? {}
    : {
        webServer: {
          command: `node "${vite}" "${__dirname}" --host 127.0.0.1`,
          url: `http://127.0.0.1:${port}`,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      }),
};
