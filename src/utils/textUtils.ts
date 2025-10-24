
// src/utils/textUtils.ts
export const escapeHtml = (unsafe: string): string => {
    if (typeof unsafe !== 'string') return ''; // Handle non-string inputs gracefully
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};
