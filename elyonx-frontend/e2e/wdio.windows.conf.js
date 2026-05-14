const app = process.env.ELYONX_WINDOWS_APP_ID || process.env.ELYONX_WINDOWS_APP;

if (!app) {
  throw new Error(
    'Set ELYONX_WINDOWS_APP_ID or ELYONX_WINDOWS_APP before running Windows E2E.',
  );
}

exports.config = {
  runner: 'local',
  specs: ['./e2e/**/*.e2e.js'],
  maxInstances: 1,
  logLevel: 'info',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 60000,
  },
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          relaxedSecurity: true,
        },
      },
    ],
  ],
  capabilities: [
    {
      platformName: 'Windows',
      'appium:automationName': 'Windows',
      'appium:app': app,
      'appium:newCommandTimeout': 120,
    },
  ],
};
