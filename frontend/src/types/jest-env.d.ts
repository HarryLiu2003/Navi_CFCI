/// <reference types="jest" />

declare global {
  var fetch: jest.Mock;
  namespace NodeJS {
    interface Global {
      fetch: jest.Mock;
    }
  }
} 