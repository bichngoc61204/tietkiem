import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  if (mode === 'qa' && command !== 'serve') throw new Error('QA mode is only available in the local dev server.');
  const localFile = (name: string) => new URL(`./tests/${name}`, import.meta.url).pathname;
  return {
    plugins: [react(), tailwindcss()],
    build: { rollupOptions: { output: { manualChunks: {
      'firebase-auth': ['firebase/auth'],
      'firebase-store': ['firebase/firestore'],
      'react': ['react', 'react-dom'],
    } } } },
    resolve: { alias: mode === 'qa' ? [
      { find: 'firebase/firestore', replacement: localFile('fakeFirestore.ts') },
      { find: 'firebase/auth', replacement: localFile('fakeAuth.ts') },
      { find: /.*\/lib\/firebase$/, replacement: localFile('fakeFirebase.ts') },
    ] : [] },
  };
});
