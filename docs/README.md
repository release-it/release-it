# release-it docs

Documentation site for [release-it](https://github.com/release-it/release-it), built with
[Astro Starlight](https://starlight.astro.build).

## Commands

All commands are run from this folder (`docs/`):

| Command          | Action                                      |
| :--------------- | :------------------------------------------ |
| `npm install`    | Install dependencies                        |
| `npm run dev`    | Start local dev server at `localhost:4321`  |
| `npm run build`  | Build the production site to `./dist/`      |
| `npm run preview`| Preview the build locally, before deploying |
| `npm run astro`  | Run any Astro CLI command                   |

From the repository root you can also run:

| Command                | Action                    |
| :--------------------- | :------------------------ |
| `npm run docs:dev`     | Start the docs dev server |
| `npm run docs:build`   | Build the docs            |
| `npm run docs:preview` | Preview the built docs    |

## Deployment

The site is deployed to GitHub Pages via
[`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml) on every push to
`main`.

## Content

Docs live in [`src/content/docs/`](./src/content/docs/). Assets referenced from within the docs
live in [`src/assets/`](./src/assets/). See
[Astro's content collections docs](https://docs.astro.build/en/guides/content-collections/) for
authoring guidance.
