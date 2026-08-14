// @ts-check
const config = require('./playwright-util')(require('./package.json'));

module.exports = {
  ...config,
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    port: require('./package.json').port,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120000,
  },
};
