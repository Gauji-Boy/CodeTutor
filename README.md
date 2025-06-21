
# 🎓 CodeTutor AI

**CodeTutor AI is an interactive web application designed to help users learn programming concepts by leveraging the power of Google Gemini AI.**

It offers a dynamic learning experience where users can upload their code files, paste code directly, or type in a programming concept they wish to understand. The AI provides explanations, runnable code examples of varying difficulty (which can be changed on the fly), practice questions, tools for deeper exploration ("More Explanation", "Ask AI Follow-up"), and constructive feedback on user solutions.

---

## 🌟 Overview

Whether you're a beginner grappling with a specific piece of code or a learner eager to master new programming paradigms, CodeTutor AI provides personalized, AI-driven assistance.

**Three Core Learning Modes:**

1.  **📁 Upload Code File**:
    *   Submit code files in a variety of languages (see "Broad Language Support" below).
    *   The AI analyzes your code to identify and explain the main programming concepts.
2.  **📋 Paste Code Directly**:
    *   Paste your code snippet into the provided editor (with syntax highlighting).
    *   Select the programming language of your pasted code.
    *   The AI analyzes the pasted code similar to an uploaded file.
3.  **✍️ Type a Concept**:
    *   Input any programming concept (e.g., "Python decorators," "JavaScript promises," "C++ RAII").
    *   Select the relevant programming language for contextual understanding.
    *   The AI delivers detailed explanations and illustrative examples tailored to that concept.

**For all input methods, CodeTutor AI delivers:**

*   **Clear Topic Explanations**: Understand the core ideas behind the code or concept.
    *   Click the **"Ask a Follow-up Question"** text area and **"Ask AI"** button to directly ask the AI specific questions about the topic.
*   **Adjustable Code Examples**: View runnable code snippets (**Easy**, **Intermediate**, **Hard**) that you can change on the fly.
*   **Expected Output**: See what the example code should produce.
*   **Practice Questions**: Test your comprehension and apply what you've learned.
*   **Step-by-Step Guidance**: Get instructions on how to tackle the practice questions.
*   **AI Solution Feedback**: Submit your practice solutions (in an editor with syntax highlighting) and receive AI-powered critiques, including predicted output and improvement suggestions.

---

## ✨ Key Features

*   **Triple Input Modes**: Seamlessly switch between **File Upload Analysis**, **Direct Code Paste**, and **Concept Typing Analysis**.
*   **Advanced AI Integration**: Powered by Google Gemini for comprehensive and insightful analysis.
*   **Interactive Explanations**:
    *   Directly ask the AI specific follow-up questions to clarify doubts using the **"Ask AI"** feature.
*   **Customizable Example Difficulty**:
    *   ⚙️ Set a preferred default difficulty (**Easy**, Intermediate, Hard) for AI examples via the **Settings Panel**. The application defaults to "Easy".
    *   🔄 Dynamically request new examples at different difficulty levels post-analysis.
*   **Interactive Learning Loop**: Engages users with examples, practice, and detailed feedback.
*   **Broad Language Support**:
    *   **File Upload, Paste & Analysis**: Python, C++, C, Java, Rust, JavaScript, TypeScript, Go, HTML, CSS, JSON, Markdown, Shell Scripts (Bash, SH, ZSH), Lua.
    *   **Concept Analysis**: The AI can explain concepts for an even wider range of programming languages and technologies.
*   **Modern & Responsive UI**: Built with React and styled with Tailwind CSS for a clean, intuitive experience on all devices.
*   **Syntax Highlighting**: Clear and readable code blocks and input editors (using Prism.js and `react-simple-code-editor`) for all supported languages.
*   **Effortless Code Copying**: One-click copy functionality for all code snippets.
*   **Robust Error Handling**: User-friendly messages for API issues or invalid inputs.
*   **Accessible Settings & Activity Tracking**:
    * Easily customize application behavior through a convenient settings popover.
    * View recent activities on the dashboard or access a comprehensive list via the "Analysis History" modal.
    * Generate a "Detailed Report" summarizing analysis types and language focus.
*   **Focused Dark Theme**: A consistent, modern dark blue interface designed for concentration.

---

## 🛠️ Technologies Used

*   **Frontend**: React, TypeScript
*   **Styling**: Tailwind CSS (via CDN)
*   **AI Model**: Google Gemini (via `@google/genai` SDK)
*   **Code Editor Component**: `react-simple-code-editor`
*   **Syntax Highlighting**: Prism.js (via CDN)
*   **Build Tool & Dev Server**: Vite
*   **UI Notifications**: `react-hot-toast`
*   **Global State & Activity Log**: Custom React Hooks (`useGlobalSettings`) with `localStorage` persistence.

---

## 📋 Prerequisites

Before you start, ensure you have the following installed on your system:

*   **Node.js**: Version 18.x or later (includes npm). Download from [nodejs.org](https://nodejs.org/).
*   **Git**: For cloning the repository (if applicable). Download from [git-scm.com](https://git-scm.com/).
*   **Google Gemini API Key**: Obtain this from [Google AI Studio](https://aistudio.google.com/app/apikey). This is crucial for the AI features to work.

---

## 🚀 Getting Started & Local Setup

Follow these steps to set up and run CodeTutor AI locally using **Vite**.

**1. Obtain Project Files**

   Clone the repository (if available) or download/create the project files. Ensure you have `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `tsconfig.node.json`, and the `src` directory in your project root.
   ```bash
   # If cloning:
   # git clone <your-repository-url>
   # cd <project-directory-name>
   ```

**2. Install Dependencies**

   Open your terminal in the project's root directory and run:
   ```bash
   npm install
   ```
   This will install all dependencies listed in `package.json` (React, Gemini SDK, Vite, etc.) into a `node_modules` folder.

**3. Configure API Key (Critical!)**

   The AI functionalities depend on your Google Gemini API Key.

   *   **Create `.env` File**: In the **root directory** of your project (same level as `package.json`), create a file named exactly `.env`.
   *   **Add API Key**: Open `.env` and add your key:
       ```env
       API_KEY="YOUR_GEMINI_API_KEY_GOES_HERE"
       ```
       Replace `YOUR_GEMINI_API_KEY_GOES_HERE` with your actual key.
   *   **Git Ignore**: Ensure `.env` is listed in your `.gitignore` file (a provided `.gitignore` file should already include this). This prevents your API key from being committed to version control.

   > **Note**: The `vite.config.ts` (provided) is set up to load this `API_KEY`. If the development server is running, **restart it** after creating or modifying the `.env` file for the key to be recognized.

**4. Check `index.html`**

   Ensure your `index.html` file (in the project root) **does not contain a `<script type="importmap">...</script>` block.** Vite handles module resolution from `node_modules` when you use `npm install`. The importmap is for CDN-based module loading without a build step and will conflict with Vite.
   The script tag loading your application should be:
   ```html
   <script type="module" src="/src/index.tsx"></script>
   ```

**5. (Review) Project Configuration Files**
   The project should include:
   *   `package.json`: Manages dependencies and scripts (e.g., `npm run dev`).
   *   `vite.config.ts`: Configures the Vite build tool, including how `process.env.API_KEY` is handled.
   *   `tsconfig.json` & `tsconfig.node.json`: TypeScript compiler configurations.
   *   `src/env.d.ts`: Provides TypeScript definitions for environment variables like `process.env.API_KEY`.

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

1.  **Dashboard View**:
    *   Choose an input method: **Upload File**, **Explain Concept**, or **Paste Code**.
    *   Provide the necessary input (file, concept description, or pasted code).
    *   Click the "Analyze" or "Explain" button. This will navigate you to the Analysis View.
    *   View **Recent Activity** and **Analysis Summary**.
    *   Access **All Activity** or **Detailed Report** via modals.
    *   Access **Settings** (⚙️ icon) to change default example difficulty and manage data.

2.  **Analysis View (after submitting from Dashboard or loading an activity)**:
    *   **Input Method Selection**: Switch between **File Upload**, **Concept Typing**, and **Paste Code** using the sidebar tabs.
    *   **If "File" mode is selected**:
        *   Click **"Choose File"** or drag & drop. Language detection is automatic; override if needed.
    *   **If "Concept" mode is selected**:
        *   Enter the concept and select the language context.
    *   **If "Paste" mode is selected**:
        *   Paste code into the editor and select its language.
    *   Click the main **"Analyze..."** button at the bottom of the sidebar.
    *   **Review AI Analysis** in the main panel:
        *   **Topic Explanation**: Read the AI's explanation.
            *   Use the **"Ask a Follow-up Question"** text area and **"Ask AI"** button for clarifications.
        *   **Example Code**:
            *   Adjust difficulty (**Easy, Intermediate, Hard**) to get new examples.
            *   Click **"Show Output"** to view expected output.
        *   **Practice Question** & **Instructions**: Test your understanding.
    *   **Engage with Practice**:
        *   Write your solution in the **"Your Solution"** editor.
        *   Click **"Check Solution"** for AI feedback.
    *   Use the **header navigation** (back arrow) to return to the Dashboard.
    *   Access **Settings** (⚙️ icon) from the header.

---

## 📁 Project Structure

The project follows a typical React/TypeScript structure, organized within the `src` directory:

```
<project-root>/
├── public/                # Static assets (if any, Vite serves index.html from root)
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks (useGlobalSettings, useTheme - if used)
│   ├── pages/             # Top-level page components (HomePage, DashboardPage)
│   ├── services/          # AI service integration (geminiService.ts)
│   ├── styles/            # Global styles (theme.css - minimal, Tailwind handles most)
│   ├── types.ts           # Core TypeScript type definitions and enums
│   ├── App.tsx            # Main application component (routing, global state management)
│   ├── index.tsx          # React DOM entry point (mounts App to root)
│   └── env.d.ts           # TypeScript declarations for environment variables
├── .env                   # Environment variables (API_KEY) - **DO NOT COMMIT**
├── .gitignore             # Files and folders ignored by Git
├── index.html             # Main HTML entry point for the browser
├── vite.config.ts         # Vite build and development server configuration
├── package.json           # Project metadata, dependencies, and npm scripts
├── tsconfig.json          # TypeScript compiler configuration for the project
├── tsconfig.node.json     # TypeScript compiler configuration for Node.js files (e.g., vite.config.ts)
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

*   **"Failed to resolve import..." (e.g., for `react`, `@google/genai`)**:
    *   This usually means the package is not installed correctly in `node_modules` or `npm install` was missed.
    *   **Solution**: Stop the dev server. Run `npm install`. Then restart the dev server (`npm run dev`).

*   **"Script error." (often a blank page or console error with no details)**:
    *   This can be caused by a conflict if an `<script type="importmap">` is still present in your `index.html`.
    *   **Solution**: **REMOVE the entire `<script type="importmap">` block from `index.html`**. Vite handles these dependencies when installed via npm.

*   **Type Errors / Build Failures (`npm run build`)**:
    *   Ensure all `@types/...` packages (like `@types/react`) are installed as dev dependencies (they should be in the provided `package.json`).
    *   Run `npx tsc --noEmit` from your project root in the terminal to get detailed TypeScript error messages. This command checks types without actually building.
    *   Ensure `tsconfig.json` and `tsconfig.node.json` are correctly configured.

*   **Syntax Highlighting Issues (Prism.js)**:
    *   Verify `index.html` correctly loads Prism.js CSS (`prism-okaidia.min.css`) and JavaScript files (`prism-core.min.js`, `prism-autoloader.min.js`). These are loaded via CDN.
    *   Ensure internet connectivity for Prism.js to auto-load grammars if not pre-loaded.
    *   Check browser console for Prism.js related errors.

---

Happy Learning with CodeTutor AI!
If you encounter any issues not covered here, please check your browser's developer console for more detailed error messages.
