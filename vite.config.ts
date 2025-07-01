import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production)
  // The second argument specifies the directory to look for .env files (project root)
  // The third argument '' ensures all env variables are loaded, not just VITE_ prefixed ones
  const env = loadEnv(mode, '.', ''); 

  return {
    plugins: [react()],
    define: {
      // Make API_KEY available as process.env.API_KEY in the client-side code
      // Vite statically replaces these during build.
      // This 'process.env.API_KEY' is a string key and should not be changed.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // You can define other environment variables here if needed
      // 'process.env.NODE_ENV': JSON.stringify(mode),
    },
    // Optional: server configuration
    // server: {
    //   port: 3000, // Default is 5173 for Vite 2+, 3000 for Vite 1
    //   open: true, // Automatically open in browser
    // },
  };
});
