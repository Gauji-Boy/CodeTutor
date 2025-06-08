// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  // process.cwd() is the project root.
  // The third argument '' loads all env variables without needing VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Make process.env.API_KEY available in client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    // If your index.html is in the root and your entry script is src/index.tsx,
    // Vite will pick it up automatically.
    // If you have specific server options, add them here.
    // server: {
    //   port: 3000, // example
    // },
  };
});
