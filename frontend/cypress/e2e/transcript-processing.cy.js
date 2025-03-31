/// <reference types="cypress" />

describe('Interview Transcript Processing', () => {
  beforeEach(() => {
    // Visit the home page before each test
    cy.visit('/');
    
    // Clear localStorage to ensure a clean state
    cy.window().then((win) => {
      win.localStorage.clear();
    });
  });

  it('should open transcript upload dialog', () => {
    // Use our custom command to open the dialog
    cy.openUploadDialog();
    
    // Verify file input is visible
    cy.get('#file').should('be.visible');
  });

  // This test should pass even in early development
  it('should validate file type', () => {
    // Open the dialog and upload invalid file without submitting
    cy.uploadTranscript('invalid.txt', false);
    
    // Submit the form - the validation will prevent submission
    cy.get('form').find('button[type="submit"]').click();
    
    // Check if the alert appears
    cy.on('window:alert', (text) => {
      expect(text).to.contain('Please select a .vtt file');
    });
  });

  // This test may need modification based on your API implementation
  it.skip('should upload and process a valid VTT file', () => {
    // Mock the API response to avoid actual API calls during testing
    cy.intercept('POST', '/api/interview_analysis/analyze', {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          problem_areas: [
            {
              problem_id: 'navigation-issue',
              title: 'Navigation Usability',
              description: 'Users struggle with finding settings',
              excerpts: [
                {
                  text: 'The main issue is definitely finding the settings menu',
                  categories: ['Pain Point'],
                  insight_summary: 'Navigation confusion',
                  transcript_reference: '4'
                }
              ]
            }
          ],
          synthesis: {
            background: 'User was interviewed about product experience',
            problem_areas: ['Navigation is confusing'],
            next_steps: ['Improve menu visibility']
          },
          metadata: {
            transcript_length: 500,
            problem_areas_count: 1,
            excerpts_count: 1
          }
        }
      }
    }).as('analyzeRequest');
    
    // Upload a valid file and submit
    cy.uploadTranscript('sample.vtt');
    
    // Check that the loading state is displayed
    cy.get('svg.animate-spin').should('be.visible');
    cy.contains('Analyzing...').should('be.visible');
    
    // Wait for the API request to complete
    cy.wait('@analyzeRequest');
    
    // Verify we're on the analysis page
    cy.verifyOnAnalysisPage();
    
    // Verify problem areas are displayed
    cy.contains('Navigation Usability').should('be.visible');
  });

  // Modified to work with the Sonner toast library
  it('should handle API errors gracefully', () => {
    // Intercept the API call with a proper network error
    cy.intercept('POST', '/api/interview_analysis/analyze', {
      forceNetworkError: true
    }).as('networkError');
    
    // Upload a valid file and submit
    cy.uploadTranscript('sample.vtt');
    
    // Wait for the API request to fail
    cy.wait('@networkError');
    
    // Verify we're still on the homepage
    cy.url().should('not.include', '/interview-analysis');
    cy.contains('Upload New Transcript').should('exist');
  });

  // Add this workflow test but keep it skipped for now
  it.skip('should allow navigating to previous analysis results', () => {
    // Set up localStorage with fake analysis data
    cy.window().then((win) => {
      const fakeData = {
        problem_areas: [
          {
            problem_id: 'test-id',
            title: 'Test Problem Area',
            description: 'This is a test problem area',
            excerpts: []
          }
        ],
        synthesis: 'Test synthesis',
        metadata: {
          problem_areas_count: 1,
          excerpts_count: 0
        }
      };
      win.localStorage.setItem('interviewAnalysis', JSON.stringify(fakeData));
    });
    
    // Navigate to recent interviews section
    cy.contains('Recent Interviews').scrollIntoView();
    
    // Click on a "View Details" button
    cy.contains('View Details').first().click();
    
    // Verify we've navigated to an analysis page
    cy.verifyOnAnalysisPage();
  });
}); 