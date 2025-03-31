const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return config
    },
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 10000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    // Don't fail tests when screenshot or video capture fails
    screenshotOnRunFailure: false,
    video: false,
    // For better debugging
    chromeWebSecurity: false,
  },
}) 