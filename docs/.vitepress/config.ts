import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'local-ai-sdk',
  description: 'Professional V0.0.0 baseline documentation for local-ai-sdk.',
  lang: 'en-US',
  base: '/Local-ai-sdk/',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'API', link: '/api/core-engine' },
      { text: 'Examples', link: '/examples/basic-chat' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Versioning', link: '/versioning' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Core Engine', link: '/api/core-engine' },
          { text: 'Types', link: '/api/types' },
          { text: 'Provider Contracts', link: '/api/providers' },
          { text: 'React Bindings', link: '/api/react' },
          { text: 'Llama Adapter', link: '/api/llama' },
          { text: 'Model Downloads', link: '/api/models' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Basic Chat', link: '/examples/basic-chat' },
          { text: 'Tools with Zod', link: '/examples/tools-zod' },
          { text: 'Model Downloads', link: '/examples/downloads' },
        ],
      },
      {
        text: 'Legacy Docs',
        items: [
          { text: 'Getting Started', link: '/GETTING-STARTED' },
          { text: 'Polyfills', link: '/POLYFILLS' },
          { text: 'Publishing', link: '/PUBLISHING' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Cobi/Local-ai-sdk' }],
  },
});
