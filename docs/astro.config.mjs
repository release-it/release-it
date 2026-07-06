import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightGithubAlerts from 'starlight-github-alerts';
import starlightLinksValidator from 'starlight-links-validator';
import starlightSidebarTopics from 'starlight-sidebar-topics';

// https://astro.build/config
export default defineConfig({
  site: 'https://release-it.github.io',
  base: '/release-it',
  integrations: [
    starlight({
      title: 'Release It! 🚀',
      description: 'Generic CLI tool to automate versioning and package publishing-related tasks.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/global.css'],
      lastUpdated: true,
      credits: true,
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/release-it/release-it'
        },
        {
          icon: 'blueSky',
          label: 'BlueSky',
          href: 'https://bsky.app/profile/webpro.nl'
        }
      ],
      editLink: {
        baseUrl: 'https://github.com/release-it/release-it/edit/main/'
      },
      lastUpdated: true,
      components: {
        TableOfContents: './src/components/TableOfContents.astro'
      },
      plugins: [
        starlightSidebarTopics(
          [
            {
              label: 'Start',
              link: '/start/overview/',
              icon: 'rocket',
              id: 'start',
              items: [
                { label: 'What is Release It?', slug: 'start/overview' },
                { label: 'Installation', slug: 'start/installation' },
                { label: 'Your first release', slug: 'start/first-release' },
                { label: 'Automating in CI', slug: 'start/automating-in-ci' }
              ]
            },
            {
              label: 'Explanations',
              link: '/explanations/how-it-works/',
              icon: 'puzzle',
              id: 'explanations',
              items: [
                { label: 'How release-it works', slug: 'explanations/how-it-works' },
                { label: 'Version detection', slug: 'explanations/version-detection' },
                { label: 'Interactive vs CI mode', slug: 'explanations/interactive-vs-ci' },
                { label: 'Updating a release', slug: 'explanations/updating-a-release' },
                { label: 'Execution order', slug: 'explanations/execution-order' },
                { label: 'Plugin architecture', slug: 'explanations/plugin-architecture' }
              ]
            },
            {
              label: 'Guides',
              link: '/guides/core-workflow/configuration/',
              icon: 'open-book',
              id: 'guides',
              items: [
                {
                  label: 'Core workflow',
                  items: [
                    { label: 'Configuration', slug: 'guides/core-workflow/configuration' },
                    { label: 'Hooks', slug: 'guides/core-workflow/hooks' },
                    { label: 'Environment variables', slug: 'guides/core-workflow/environment-variables' },
                    { label: 'Dry runs', slug: 'guides/core-workflow/dry-runs' },
                    { label: 'Pre-releases', slug: 'guides/core-workflow/pre-releases' },
                    { label: 'Changelog', slug: 'guides/core-workflow/changelog' }
                  ]
                },
                {
                  label: 'Publishing',
                  items: [
                    { label: 'Git', slug: 'guides/publishing/git' },
                    { label: 'npm', slug: 'guides/publishing/npm' },
                    { label: 'GitHub Releases', slug: 'guides/publishing/github-releases' },
                    { label: 'GitLab Releases', slug: 'guides/publishing/gitlab-releases' }
                  ]
                },
                {
                  label: 'Continuous Integration',
                  items: [{ label: 'CI environments', slug: 'guides/ci/environments' }]
                },
                {
                  label: 'Recipes',
                  items: [{ autogenerate: { directory: 'guides/recipes' } }]
                }
              ]
            },
            {
              label: 'Reference',
              link: '/reference/configuration-options/',
              icon: 'information',
              id: 'reference',
              items: [
                {
                  label: 'Configuration options',
                  items: [
                    { label: 'Overview', slug: 'reference/configuration-options' },
                    { label: 'Git', slug: 'reference/configuration-options/git' },
                    { label: 'npm', slug: 'reference/configuration-options/npm' },
                    { label: 'GitHub', slug: 'reference/configuration-options/github' },
                    { label: 'GitLab', slug: 'reference/configuration-options/gitlab' }
                  ]
                },
                { label: 'Plugin API', slug: 'reference/plugin-api' },
                { label: 'Hook names', slug: 'reference/hook-names' },
                { label: 'Template variables', slug: 'reference/template-variables' },
                { label: 'Community plugins', slug: 'reference/community-plugins' }
              ]
            }
          ],
          {
            exclude: ['/']
          }
        ),
        starlightLinksValidator(),
        starlightGithubAlerts()
      ]
    })
  ]
});
