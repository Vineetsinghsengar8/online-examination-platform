// Global declarations to help TypeScript with non-TS imports and third-party module shims

declare module '*.css';

declare module 'prismjs/components/prism-core' {
  // highlight can be called with two args (code, grammar) or three args (code, grammar, language)
  export function highlight(code: string, grammarOrLanguage?: any, language?: string): string;
  export const languages: any;
}
