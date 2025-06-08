
// Declare global NodeJS ProcessEnv interface for TypeScript
// This allows process.env.API_KEY to be recognized type-safely

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * The API key for accessing the Gemini API.
       * This should be set in the environment.
       */
      readonly API_KEY?: string;
    }
  }
}

// If this file is a module (e.g., has imports/exports), ensure it's treated as such.
// If it's purely for global declarations, this export might not be strictly necessary
// but is good practice to prevent accidental pollution of the global scope
// and to ensure it's picked up as a module by TypeScript.
export {};