/** @type {(pkg: { port?: number }, workers?: number) => import('@playwright/test').PlaywrightTestConfig} */
module.exports = function getPlaywrightConfig(pkg, workers) {
  return {
    forbidOnly: !!process.env.CI,
    workers: process.env.CI ? 3 : workers,
    retries: process.env.CI ? 1 : 0,
    use: {
      headless: true,
      baseURL: `http://localhost:${pkg.port ?? defaultVitePort}`,
    },
    expect: {
      timeout: 10_000,
    },
  };
};

const defaultVitePort = 5173;
