# Cypress End-to-End Tests for Navi CFCI Frontend

This directory contains end-to-end tests for the Navi CFCI frontend application using Cypress.

## Table of Contents
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Current Test Coverage](#current-test-coverage)
- [Skipped Tests](#skipped-tests)
- [Adding data-testid Attributes](#adding-data-testid-attributes)
- [Writing More Tests](#writing-more-tests)
- [Best Practices](#best-practices)
- [Cross-Browser Testing](#cross-browser-testing)
- [Future Enhancements](#future-enhancements)

## Test Structure

- `cypress/e2e/`: Contains test specifications
  - `transcript-processing.cy.js`: Tests for the interview transcript upload and analysis workflow
  - `navigation.cy.js`: Tests for basic UI navigation and homepage components
- `cypress/fixtures/`: Contains test data files
  - `sample.vtt`: Sample VTT file for testing successful uploads
  - `invalid.txt`: Invalid file for testing error handling
- `cypress/support/`: Contains support files
  - `commands.js`: Custom Cypress commands
  - `e2e.js`: Configuration for E2E tests

## Running Tests

You can run the tests using the following commands:

```bash
# Using Docker (with containers already running):
# Run all tests headlessly
docker exec -it navi_cfci-frontend-1 npm run cy:run

# Run just the E2E tests headlessly
docker exec -it navi_cfci-frontend-1 npm run cy:run:e2e

# Run a specific test file
docker exec -it navi_cfci-frontend-1 npm run cy:run -- --spec 'cypress/e2e/navigation.cy.js'

# Run tests in Chrome browser
docker exec -it navi_cfci-frontend-1 npx cypress run --browser chrome

# Directly with npm (if running outside Docker):
# Open Cypress in interactive mode
npm run cy:open

# Run all tests headlessly
npm run cy:run

# Run just the E2E tests headlessly
npm run cy:run:e2e

# Run a specific test file
npm run cy:run -- --spec 'cypress/e2e/navigation.cy.js'

# Run tests in Chrome browser
npx cypress run --browser chrome
```

## Current Test Coverage

### Transcript Processing Tests
1. Opening the transcript upload dialog
2. Validating file types (rejecting non-VTT files)
3. Handling API errors gracefully

### Navigation Tests
1. Displaying the app title and header
2. Showing project cards on the homepage
3. Displaying key metrics sections
4. Showing the recent interviews section
5. Opening and verifying the transcript upload dialog

## Skipped Tests

Some tests are intentionally skipped (using `it.skip()`) because they require UI components or functionality that are not yet fully implemented:

1. **"should upload and process a valid VTT file"** - Skipped because:
   - It requires specific UI components with `data-testid` attributes that aren't implemented yet
   - It needs API mocking that matches the current API response format
   - It tests a complete workflow that may still be in development

2. **"should allow navigating to previous analysis results"** - Skipped because:
   - It depends on localStorage manipulation and navigation between pages
   - The analysis results page may not be fully implemented

**To enable these tests:**
- Implement the required UI components with the correct `data-testid` attributes
- Remove the `.skip()` from the test definition
- Adjust the mocked API responses if your actual API format differs

## Adding data-testid Attributes

The tests use selectors like `[data-testid="loading-indicator"]` and `[data-testid="analysis-results"]`, but these attributes **don't exist in your current React components**.

To make the skipped tests work, you'll need to add these attributes to your components:

```jsx
// Example for your loading spinner
<div data-testid="loading-indicator">
  <svg className="animate-spin">...</svg>
</div>

// Example for analysis results page
<div data-testid="analysis-results">
  <div data-testid="problem-areas">
    {problemAreas.map(problem => (
      <div key={problem.id} data-testid="problem-area-item">
        {problem.title}
      </div>
    ))}
  </div>
  <div data-testid="synthesis">{synthesis}</div>
</div>
```

Using `data-testid` attributes makes your tests more resilient to style or structure changes while keeping them focused on functionality.

## Writing More Tests

When adding new tests:

1. Use the existing custom commands in `cypress/support/commands.js`
2. Follow the same patterns for testing UI components
3. Use `cy.intercept()` to mock API responses as needed
4. Use `.skip()` for tests that rely on features still in development

## Best Practices

1. **Test user behavior**, not implementation details
   - Focus on what users see and do, not internal implementation
   - Test from the user's perspective

2. **Keep tests independent** of each other
   - Each test should set up its own state
   - Tests should not depend on other tests running first

3. **Use custom commands** for common operations
   - Abstract repetitive workflows into commands
   - Keep test code DRY (Don't Repeat Yourself)

4. **Use meaningful assertions** that verify what the user would see
   - Test visible content and UI state
   - Avoid testing internal state unless necessary

5. **Keep test fixtures up to date** with the latest API response formats
   - Update mock responses when API formats change
   - Use realistic data in fixtures

## Cross-Browser Testing

To run tests across different browsers:

```bash
# Run in Chrome
npx cypress run --browser chrome

# Run in Firefox (if installed)
npx cypress run --browser firefox

# Run in Edge (if installed)
npx cypress run --browser edge
```

Note: Browsers must be installed on your system before Cypress can use them.

## Future Enhancements

As the application matures, consider adding:

1. **Visual regression tests** to catch UI changes
2. **Accessibility tests** to ensure the application is accessible
3. **Performance tests** to measure loading times
4. **Cross-browser tests** to ensure compatibility
5. **True end-to-end tests** that use the actual backend instead of mocks for critical user journeys 