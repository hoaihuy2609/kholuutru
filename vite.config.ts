import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_GITHUB_TOKEN': JSON.stringify(env.VITE_GITHUB_TOKEN),
      'process.env.VITE_GITHUB_REPO': JSON.stringify(env.VITE_GITHUB_REPO),
      'process.env.VITE_GITHUB_BRANCH': JSON.stringify(env.VITE_GITHUB_BRANCH),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React — cached long-term, rarely changes
            'vendor-react': ['react', 'react-dom'],
            // Charts — only loaded by StatsPanel, ContactBook, ExamResult
            'vendor-recharts': ['recharts'],
            // Math rendering — only loaded by BlogDetail, LessonView
            'vendor-katex': ['katex', 'rehype-katex', 'remark-math', 'rehype-raw'],
            // Markdown — only loaded by Blog, Chatbot
            'vendor-markdown': ['react-markdown'],
            // Cloud/DB — loaded by useCloudStorage
            'vendor-supabase': ['@supabase/supabase-js'],
            // Utils — loaded by useCloudStorage
            'vendor-utils': ['jszip', 'crypto-js'],
          },
        },
      },
    },
  };
});
