# 🎓 CodeTutor AI

**CodeTutor AI is an interactive web application designed to help users learn programming concepts by leveraging the power of Google Gemini AI.**

It offers a dynamic learning experience where users can upload their code files, paste code directly, or type in a programming concept they wish to understand. The AI provides in-depth analysis, runnable code examples of varying difficulty, practice questions with progressive hints, and a conversational chat for follow-up questions.

---

## 🌟 Overview

Whether you're a beginner grappling with a specific piece of code or a learner eager to master new programming paradigms, CodeTutor AI provides personalized, AI-driven assistance.

**Two Main Views:**

1.  **Dashboard**: A central hub to start a new analysis and view your activity history.
2.  **Analysis View**: An IDE-like interface with a collapsible sidebar for inputs and a main panel for detailed, interactive AI-generated results.

**Four Core Learning Modes (accessible from both views):**

1.  **🐞 Debug My Code (New!)**:
    *   Submit your broken or non-working code.
    *   The AI identifies syntax and logical errors, explains them in a beginner-friendly way, and provides the corrected code with a side-by-side "diff" view to highlight the changes.
2.  **📁 Upload Code File**:
    *   Submit code files in a variety of languages (see "Broad Language Support" below).
    *   The AI analyzes your code to identify and explain the main programming concepts.
3.  **📋 Paste Code Directly**:
    *   Paste your code snippet into the provided editor.
    *   The AI will attempt to auto-detect the language and provide a full analysis.
4.  **✍️ Type a Concept**:
    *   Input any programming concept (e.g., "Python decorators," "JavaScript promises").
    *   Select the relevant programming language for contextual understanding.
    *   The AI delivers detailed explanations and illustrative examples tailored to that concept.

---

## ✨ Key Features

*   **Advanced AI Integration**: Powered by Google's `gemini-2.5-flash` for fast, comprehensive, and insightful analysis.
*   **Modern IDE-like Interface**: An interactive two-column layout with a collapsible sidebar for inputs and a main content area for detailed analysis, providing a focused learning environment.
*   **In-Depth Code Analysis & Debugging**:
    *   **Core Concepts**: High-level explanation of the programming principles in the code.
    *   **Block-by-Block & Line-by-Line Breakdowns**: Collapsible sections that explain your code in logical chunks and individual lines.
    *   **Execution Flow**: A step-by-step description of how the program runs and how data is transformed.
    *   **AI-Powered Debugger**: Get detailed explanations for syntax and logic errors, along with AI-suggested fixes.
    *   **Visual Diff Viewer**: See a side-by-side comparison of your original code and the AI's corrected version, with changes clearly highlighted.
*   **Interactive Conversational Chat**:
    *   Ask follow-up questions directly within the analysis view. The AI maintains the context of your code/concept to provide relevant answers.
*   **Dynamic Example Difficulty**:
    *   The AI provides an initial code example based on your settings.
    *   Instantly request new **Easy**, **Intermediate**, or **Hard** examples on the fly without re-running the entire analysis.
*   **Enhanced Practice Module**:
    *   **AI-Generated Questions**: Get practice problems relevant to the topic.
    *   **Progressive Instructions**: Instead of revealing the whole solution, click "More Instructions" to get increasingly detailed hints from the AI.
    *   **AI Solution Feedback**: Submit your practice solutions and receive AI-powered critiques, including predicted output and an assessment of correctness.
*   **Broad Language Support**:
    *   **File Upload & Paste Analysis**: Automatic language detection for Python, C++, C, Java, Rust, JavaScript, TypeScript, Go, HTML, CSS, JSON, Markdown, Shell Scripts (Bash, SH, ZSH), Lua. Manual override is available.
    *   **Concept Analysis**: The AI can explain concepts for an even wider range of programming languages and technologies.
*   **Robust UI/UX**:
    *   Built with React and styled with Tailwind CSS for a clean, responsive experience.
    *   **Proper Syntax Highlighting**: Accurate, theme-consistent highlighting powered by Prism.js.
    *   **Full-Screen Modals**: View code and chat in an immersive, full-screen view.
    *   **Persistent Activity Log**: Your analysis sessions are saved to local storage and accessible from the dashboard.
*   **Comprehensive Settings**:
    *   Customize default difficulties for examples and practice.
    *   Toggle the visibility of different analysis sections to tailor the UI to your needs.

---

## 🛠️ Technologies Used

*   **Frontend**: React, TypeScript
*   **Styling**: Tailwind CSS (with JIT via CDN), custom dark theme
*   **AI Model**: Google Gemini (`gemini-2.5-flash` via `@google/genai` SDK)
*   **Code Editor Component**: `react-simple-code-editor`
*   **Syntax Highlighting**: Prism.js (via CDN)
*   **Build Tool & Dev Server**: Vite
*   **UI Notifications**: `react-hot-toast`
*   **Global State & Persistence**: Custom React Hooks (`useGlobalSettings`) with `localStorage`.

---

## 🚀 Getting Started & Local Setup

**1. Prerequisites**
*   **Node.js**: Version 18.x or later.
*   **Google Gemini API Key**: Obtain from [Google AI Studio](https://aistudio.google.com/app/apikey).

**2. Installation**
```bash
npm install
```

**3. Configure API Key (Critical!)**
*   Create a `.env` file in the project's **root directory**.
*   Add your API key to it:
    ```env
    API_KEY="YOUR_GEMINI_API_KEY_GOES_HERE"
    ```
*   **Important**: If your development server is already running, **you must restart it** for the new key to take effect.

---

## 🖥️ Running the Application Locally

1.  **Start the development server**:
    ```bash
    npm run dev
    ```
2.  **Open in browser**: Navigate to the local URL provided by Vite (e.g., `http://localhost:5173`).

---

## 💡 How to Use the New Features

1.  **Dashboard View**:
    *   The dashboard is now your central hub. Choose an input method, provide the content, and click **"Analyze"**. This will take you to the dedicated Analysis View.
    *   You can also click on any item in your **"Recent Activity"** list to load that session directly into the Analysis View.

2.  **Analysis View**:
    *   **Collapsible Sidebar**: The left panel contains all input methods. You can collapse it by clicking the `menu_open` icon to focus on the analysis results.
    *   **Switching Inputs**: You can switch input methods (File, Concept, Paste, Debug) in the sidebar at any time to start a new analysis session.
    *   **Topic Explanation**:
        *   The explanation is now broken into collapsible sections: **Core Concepts**, **Block-by-Block**, **Line-by-Line**, and **Execution Flow**. Click any title to expand it.
        *   Below these, you'll find the **Conversational Chat** section. Type a question and hit "Send" to ask the AI for clarification.
    *   **Example Code**:
        *   Use the **Easy**, **Intermediate**, and **Hard** buttons to instantly fetch a new code example from the AI without losing your main analysis.
    *   **Practice Section**:
        *   After reviewing the question, you can now toggle between two instruction formats: **Conceptual** (high-level steps) and **Line-by-Line** (granular code construction hints).
        *   In "Conceptual" mode, if you're stuck, click the **"More Instructions"** button. The AI will provide a new, more detailed set of hints for the next level.
        *   When you're ready, write your code in the editor and click **"Check Solution"** for AI feedback.

---

## 📁 Project Structure

The project is organized entirely within the `src` directory for clarity and modern tooling compatibility.

```
<project-root>/
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks (useGlobalSettings)
│   ├── pages/             # Top-level page components (HomePage, DashboardPage)
│   ├── services/          # AI service integration (geminiService.ts)
│   ├── styles/            # Global styles (theme.css)
│   ├── utils/             # Utility functions (textUtils.ts)
│   ├── types.ts           # Core TypeScript type definitions
│   ├── App.tsx            # Main application component (routing, global state)
│   ├── index.tsx          # React DOM entry point
│   └── env.d.ts           # TS declarations for environment variables
├── .env                   # Environment variables (API_KEY) - **DO NOT COMMIT**
├── index.html             # Main HTML entry point
├── vite.config.ts         # Vite build configuration
└── ... other config files
```