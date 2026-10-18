import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applySeoToHtml, deriveBase, validateSiteUrl } from './src/seo/index.ts';

export default defineConfig(({ command, mode }) => {
  const siteUrl = command === 'build' ? loadEnv(mode, '.', '').SITE_URL : undefined;
  if (siteUrl) validateSiteUrl(siteUrl);
  return {
    plugins: [
      react(),
      {
        name: 'seo-site-url',
        transformIndexHtml: (html: string) => applySeoToHtml(html, { siteUrl }),
      },
    ],
    ...(siteUrl ? { base: deriveBase(siteUrl) } : {}),
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
