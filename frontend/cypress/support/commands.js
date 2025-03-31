// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Import cypress file upload plugin if needed
// import 'cypress-file-upload';

// -- Custom commands specific to the interview transcript processing workflow --

/**
 * Custom command to upload a transcript file and submit the form
 * @param {string} fixtureFilePath - Path to the fixture file to upload
 * @param {string} fileType - MIME type of the file
 */
Cypress.Commands.add('uploadTranscript', (fixtureFilePath, shouldSubmit = true) => {
  // Open the upload dialog
  cy.openUploadDialog();
  
  // Upload the file
  cy.get('#file').selectFile(`cypress/fixtures/${fixtureFilePath}`, { force: true });
  
  // Submit the form if requested
  if (shouldSubmit) {
    cy.get('form').find('button[type="submit"]').click();
  }
});

/**
 * Custom command to verify analysis results are displayed
 */
Cypress.Commands.add('verifyAnalysisResults', () => {
  // Wait for loading to complete
  cy.get('[data-testid="loading-indicator"]', { timeout: 30000 })
    .should('exist')
    .then(() => {
      // Wait for loading to disappear and results to appear
      cy.get('[data-testid="loading-indicator"]', { timeout: 30000 }).should('not.exist');
      cy.get('[data-testid="analysis-results"]', { timeout: 30000 }).should('be.visible');
    });
  
  // Verify key components of results are visible
  cy.get('[data-testid="problem-areas"]').should('exist');
  cy.get('[data-testid="synthesis"]').should('exist');
});

/**
 * Custom command to verify error state
 */
Cypress.Commands.add('verifyErrorState', (expectedErrorText) => {
  cy.get('[data-testid="error-message"]', { timeout: 10000 })
    .should('be.visible')
    .and('contain', expectedErrorText);
});

/**
 * Custom command to complete the full transcript analysis workflow
 */
Cypress.Commands.add('completeTranscriptAnalysisWorkflow', (fixtureFilePath) => {
  // Navigate to upload page
  cy.visit('/');
  
  // Upload transcript file
  cy.uploadTranscript(fixtureFilePath);
  
  // Verify results
  cy.verifyAnalysisResults();
});

// Basic custom command for opening the upload dialog
Cypress.Commands.add('openUploadDialog', () => {
  cy.contains('button', 'Upload New Transcript').click();
  cy.contains('Upload New Transcript').should('be.visible');
});

// Command for checking if we're on the analysis results page
Cypress.Commands.add('verifyOnAnalysisPage', () => {
  cy.url().should('include', '/interview-analysis');
  cy.contains('Interview Analysis').should('be.visible');
  cy.contains('Analysis Summary').should('be.visible');
});

// Command for waiting until loading is complete
Cypress.Commands.add('waitForLoading', () => {
  // First check that loading indicator appears
  cy.get('svg.animate-spin').should('be.visible');
  // Then wait for it to disappear (using should with timeout)
  cy.get('svg.animate-spin', { timeout: 10000 }).should('not.exist');
}); 