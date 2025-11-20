# Contributing

Thanks for your interest in Sir Fills-A-Lot! Pull requests and issues are welcome.

## Development setup

1. Install Node 20+ and npm.
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`
4. Build for Chrome: `npm run build` (outputs to `dist/`)

## Working on issues

- Please open an issue before large changes. Small fixes/docs are fine without a prior issue.
- Keep PRs focused and small; one feature or bug per PR.
- Add notes to the PR description: what changed, why, and how to verify.

## Coding standards

- TypeScript/React (Vite + CRXJS). Prefer functional components.
- Keep code comments minimal and purposeful.
- Run `npm run build` before pushing to ensure the bundle compiles.

## Testing

There is no automated test suite yet; manual verification steps are fine in PRs. If you add tests or linting, include scripts and instructions.

## Release notes

Before tagging a release:
- Bump the version in `src/manifest.ts`.
- Run `npm run build` and create a zip of `dist/` for the release asset.
- Update README if user-facing behavior changes.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
