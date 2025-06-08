
# 🎓 CodeTutor AI

**CodeTutor AI is an interactive web application designed to help users learn programming concepts by leveraging the power of Google Gemini AI.**

It offers a dynamic learning experience where users can either upload their code files for in-depth analysis or type in a programming concept they wish to understand. The AI provides explanations, runnable code examples of varying difficulty, practice questions, and constructive feedback on user solutions.

---

## 🌟 Overview

Whether you're a beginner grappling with a specific piece of code or a learner eager to master new programming paradigms, CodeTutor AI provides personalized, AI-driven assistance.

**Two Core Learning Modes:**

1.  **📁 Upload Code File**:
    *   Submit code files in Python, C++, C, Java, or Rust.
    *   The AI analyzes your code to identify and explain the main programming concepts.
2.  **✍️ Type a Concept**:
    *   Input any programming concept (e.g., "Python decorators," "JavaScript promises," "C++ RAII").
    *   Select the relevant programming language for contextual understanding.
    *   The AI delivers detailed explanations and illustrative examples tailored to that concept.

**For both input methods, CodeTutor AI delivers:**

*   **Clear Topic Explanations**: Understand the core ideas behind the code or concept.
*   **Adjustable Code Examples**: View runnable code snippets (Easy, Intermediate, Hard) that you can change on the fly.
*   **Expected Output**: See what the example code should produce.
*   **Practice Questions**: Test your comprehension and apply what you've learned.
*   **Step-by-Step Guidance**: Get instructions on how to tackle the practice questions.
*   **AI Solution Feedback**: Submit your practice solutions and receive AI-powered critiques, including predicted output and improvement suggestions.

---

## ✨ Key Features

*   **Dual Input Modes**: Seamlessly switch between **File Upload Analysis** and **Concept Typing Analysis**.
*   **Advanced AI Integration**: Powered by Google Gemini for comprehensive and insightful analysis.
*   **Customizable Example Difficulty**:
    *   ⚙️ Set a preferred default difficulty (Easy, Intermediate, Hard) for AI examples via the **Settings Panel**.
    *   🔄 Dynamically request new examples at different difficulty levels post-analysis.
*   **Interactive Learning Loop**: Engages users with examples, practice, and detailed feedback.
*   **Broad Language Support**: Current support for **Python, C++, C, Java, and Rust**.
*   **Modern & Responsive UI**: Built with React and styled with Tailwind CSS for a clean, intuitive experience on all devices.
*   **Syntax Highlighting**: Clear and readable code blocks using Prism.js.
*   **Effortless Code Copying**: One-click copy functionality for all code snippets.
*   **Robust Error Handling**: User-friendly messages for API issues or invalid inputs.
*   **Accessible Settings**: Easily customize application behavior through a convenient settings popover.
*   **Focused Dark Theme**: A consistent, modern dark blue interface designed for concentration.

---

## 🛠️ Technologies Used

*   **Frontend**: React, TypeScript
*   **Styling**: Tailwind CSS
*   **AI Model**: Google Gemini (via `@google/genai` SDK)
*   **Syntax Highlighting**: Prism.js
*   **Build Tool & Dev Server**: Vite
*   **UI Notifications**: `react-hot-toast`
*   **Global State**: React Context API (for settings)

---

## 📋 Prerequisites

Before you start, ensure you have the following installed on your system:

*   **Node.js**: Version 18.x or later (includes npm). Download from [nodejs.org](https://nodejs.org/).
*   **Git**: For cloning the repository. Download from [git-scm.com](https://git-scm.com/).
*   **Google Gemini API Key**: Obtain this from [Google AI Studio](https://aistudio.google.com/app/apikey). This is crucial for the AI features to work.

---

## 🚀 Getting Started & Local Setup

Follow these steps to set up and run CodeTutor AI locally using **Vite**.

**1. Obtain Project Files**

   Clone the repository (if available) or download the project files:
   ```bash
   git clone <your-repository-url>
   cd <project-directory-name>  # e.g., codetutor-ai
   ```
   If you don't have a repository, simply create a project folder and place all provided files (`index.html`, `src/`, etc.) into it.

**2. Initialize Project & Install Dependencies**

   Open your terminal in the project's root directory.

   *   **Initialize `package.json`** (if it doesn't exist):
       ```bash
       npm init -y
       ```
   *   **Install Application Dependencies**:
       ```bash
       npm install react react-dom @google/genai react-hot-toast
       ```
   *   **Install Development Dependencies**:
       ```bash
       npm install --save-dev vite @vitejs/plugin-react typescript @types/react @types/react-dom
       ```

**3. Configure Vite (`vite.config.ts`)**

   Create or update `vite.config.ts` in your project root. This file is essential for Vite's functionality and for managing environment variables like your API key.

   ```typescript
   // vite.config.ts
   import { defineConfig, loadEnv } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig(({ mode }) => {
     // Load .env file variables from the project root
     const env = loadEnv(mode, process.cwd(), '');

     return {
       plugins: [react()],
       // Define global constants. These are statically replaced during build.
       define: {
         'process.env.API_KEY': JSON.stringify(env.API_KEY),
         // 'process.env.NODE_ENV': JSON.stringify(mode), // Optional: if you need mode in your app
       },
       // Optional: Configure server port if needed
       // server: {
       //   port: 3000,
       // },
     };
   });
   ```
   > **Important**: If you modify `vite.config.ts` while the dev server is running, you'll need to restart it.

**4. Set Up `package.json` Scripts**

   Add the following scripts to your `package.json` for convenient Vite commands:
   ```json
   // package.json
   {
     "name": "codetutor-ai",
     "private": true,
     "version": "1.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",                // Starts the development server
       "build": "tsc && vite build", // Type-checks and builds for production
       "preview": "vite preview"     // Locally previews the production build
     }
     // ... ensure dependencies and devDependencies from step 2 are listed here
   }
   ```

**5. Configure API Key (Critical!)**

   The AI functionalities depend on your Google Gemini API Key.

   *   **Create `.env` File**: In the **root directory** of your project (same level as `package.json`), create a file named exactly `.env`.
   *   **Add API Key**: Open `.env` and add your key:
       ```env
       API_KEY="YOUR_GEMINI_API_KEY_GOES_HERE"
       ```
       Replace `YOUR_GEMINI_API_KEY_GOES_HERE` with your actual key.
   *   **Git Ignore**: **Crucially**, add `.env` to your `.gitignore` file to prevent your API key from being committed to version control:
       ```
       # .gitignore
       .env
       node_modules/
       dist/
       ```
   > **Note**: The `vite.config.ts` you set up in Step 3 will load this `API_KEY`. **Restart your Vite development server** after creating or modifying the `.env` file for the key to be recognized.

**6. Prepare HTML & TypeScript Definitions**

   *   **`index.html`**:
       *   Ensure it's in your project root.
       *   It should load your React app: `<script type="module" src="/src/index.tsx" defer></script>`.
       *   It includes CDN links for Tailwind CSS, Google Fonts, and Prism.js (for syntax highlighting).
       *   **Important**: If you're using Vite with locally installed dependencies (as per Step 2), **remove any `<script type="importmap">...</script>` block** from `index.html`. Vite handles dependency bundling from your `node_modules`.

   *   **`src/env.d.ts`**:
       *   This file provides TypeScript definitions for environment variables like `process.env.API_KEY`, enabling type-safe access in your application code. Make sure it's present in the `src` directory.

---

## 🖥️ Running the Application Locally

Once setup is complete:

1.  **Start the development server**:
    ```bash
    npm run dev
    ```
2.  **Open in browser**: Vite will typically output a local URL (e.g., `http://localhost:5173`). Open this URL in your web browser.

---

## 💡 How to Use CodeTutor AI

Upon launching the application:

1.  **Select Input Method**:
    *   **Upload Code File**: Choose this to analyze an existing code file.
    *   **Type a Concept**: Opt for this to explore a programming concept by name.

2.  **If "Upload Code File"**:
    *   Click **"Choose File"** or drag & drop a supported file (`.py`, `.cpp`, `.c`, `.java`, `.rs`).
    *   The app attempts language detection. You can override this using the **"Language (Override if needed)"** dropdown.
    *   Your code content will appear in a viewer.
    *   Click **"Analyze Code"**.

3.  **If "Type a Concept"**:
    *   Enter the concept in the **"Programming Concept"** field (e.g., "Binary Search Tree").
    *   Select the relevant language from the **"Language Context"** dropdown.
    *   Click **"Analyze Concept"**.

4.  **Adjust Settings (Optional)**:
    *   Click the **settings icon** (⚙️) in the header.
    *   Select your **"Default Example Difficulty"** (Easy, Intermediate, Hard). This impacts the initial AI-generated example.

5.  **Review AI Analysis**:
    The results panel will display:
    *   **Topic Explanation**: A detailed description.
    *   **Example Code**: A runnable snippet.
        *   Use the **"Easy," "Intermediate," "Hard"** buttons above the code to get new examples of different complexities.
    *   **Example Output**: Click **"Show Example Output"** to view.
    *   **Practice Question**: A challenge to test your understanding.
    *   **Instructions to Solve**: Guidance for the practice question.

6.  **Engage with Practice (Optional)**:
    *   Write your solution in the **"Your Solution"** area.
    *   Click **"Check My Solution"**.
    *   The AI provides feedback, predicted output, and potential correctness assessment.

---

## 📁 Project Structure

The project follows a typical React/TypeScript structure, organized within the `src` directory:

```
<project-root>/
├── public/                # Static assets (Vite serves index.html from root by default)
├── src/
│   ├── components/        # Reusable UI components (e.g., Card, FileUpload, CodeBlock)
│   ├── hooks/             # Custom React hooks (e.g., useGlobalSettings)
│   ├── pages/             # Top-level page components (e.g., HomePage)
│   ├── services/          # AI service integration (geminiService.ts)
│   ├── styles/            # Global styles and themes (theme.css)
│   ├── types.ts           # Core TypeScript type definitions and enums
│   ├── App.tsx            # Main application component (routes, global layout)
│   ├── index.tsx          # React DOM entry point (mounts App)
│   └── env.d.ts           # TypeScript declarations for environment variables
├── .env                   # Environment variables (API_KEY) - **DO NOT COMMIT**
├── .gitignore             # Files and folders ignored by Git
├── index.html             # Main HTML entry point for the browser
├── vite.config.ts         # Vite build and development server configuration
├── package.json           # Project metadata, dependencies, and npm scripts
├── tsconfig.json          # TypeScript compiler configuration
└── README.md              # This file - project documentation
```

---

## 🔍 Troubleshooting

*   **API Key Errors**:
    *   *"Critical Setup Error: The API_KEY environment variable is missing..."*
    *   *"Action Required: The API_KEY environment variable is not configured..."*
    *   *"Invalid API Key..."* / *"API key not valid..."*
    *   *"API quota exceeded..."*

    **Solutions**:
    1.  Ensure `.env` is in the **project root** (not `src/`) and named correctly.
    2.  Verify `API_KEY="YOUR_KEY"` is correctly set in `.env`.
    3.  Confirm your `vite.config.ts` correctly defines `process.env.API_KEY`.
    4.  Check your Google AI Studio dashboard for key validity and quota status.
    5.  **Always restart your development server (`npm run dev`)** after changes to `.env` or `vite.config.ts`.

*   **Type Errors / Build Failures**:
    *   Run `npm install` to ensure all dependencies are present.
    *   Execute `npx tsc --noEmit` (or `npm run build`) to check for TypeScript errors.

*   **File Read Errors**:
    *   *"Error: Failed to read the selected file."* - Check file integrity and browser permissions. Try a different file.

*   **Syntax Highlighting Issues**:
    *   Verify `index.html` correctly loads Prism.js CSS and `prism-autoloader.min.js`.
    *   Ensure internet connectivity for Prism.js to auto-load grammars if not pre-loaded.
    *   Check browser console for Prism.js errors.

---

Happy Learning with CodeTutor AI!
If you encounter any issues not covered here, please check your browser's developer console for more detailed error messages.
