/// <reference types="cypress" />

describe('Main Navigation', () => {
  beforeEach(() => {
    // Visit the home page before each test
    cy.visit('/');
  });

  it('should display the app title and header', () => {
    // Check that the app title contains Navi
    cy.contains('Navi').should('be.visible');
    cy.contains('Product').should('be.visible');
    cy.contains('Force').should('be.visible');
  });

  it('should show project cards on homepage', () => {
    // Verify we can see the project cards
    cy.contains('Total Projects').should('be.visible');
    cy.contains('Across all teams').should('be.visible');
  });

  it('should show the key metrics on the homepage', () => {
    // Check for the presence of key metrics sections
    cy.contains('Total Projects').should('be.visible');
    cy.contains('Pending Interviews').should('be.visible');
    cy.contains('Key Demands').should('be.visible');
    
    // Check for chart sections
    cy.contains('Project Overview').should('be.visible');
    cy.contains('Demand Distribution').should('be.visible');
  });

  it('should show the recent interviews section', () => {
    // Scroll to the recent interviews section
    cy.contains('Recent Interviews').scrollIntoView();
    
    // Check that multiple interview entries are displayed
    cy.contains('Recent Interviews')
      .parent()
      .parent()
      .find('div.space-y-4 > div')
      .should('have.length.at.least', 1);
  });

  it('should open transcript upload dialog', () => {
    // Open the dialog
    cy.contains('button', 'Upload New Transcript').click();
    
    // Verify the dialog elements
    cy.get('#file').should('be.visible');
    cy.get('form').should('be.visible');
    cy.get('form').find('button[type="submit"]').should('be.visible');
    
    // Verify dialog title is visible somehow (with direct text check)
    cy.contains('h2', 'Upload New Transcript').should('be.visible');
  });
}); 