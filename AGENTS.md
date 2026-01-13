# Repository Guidelines

## Project Structure & Module Organization
- `README.md` holds the minimal project overview.
- No `src/`, `test/`, or asset directories are present yet. If you add code, prefer `src/` for implementation and `test/` (or `tests/`) for automated checks to keep the layout conventional and discoverable.

## Build, Test, and Development Commands
- No build, run, or test scripts are defined in this repository right now. If you introduce a toolchain, document the exact commands here (for example: `npm run build`, `npm test`, or `make run`) and keep the list short and task-focused.

## Coding Style & Naming Conventions
- No formatting, linting, or style tools are configured. When adding code, choose a formatter/linter appropriate for the language and describe it here (including the command to run it).
- Use clear, descriptive names for files and modules. Keep directories lower-kebab-case (e.g., `game-engine/`) unless a toolchain dictates otherwise.

## Testing Guidelines
- No testing framework is configured. If tests are added, document:
  - The framework and how to run it.
  - Test file naming (e.g., `*.spec.ts`, `test_*.py`).
  - Any coverage expectations.

## Commit & Pull Request Guidelines
- Git history currently shows a single commit (`first commit`), so there is no established commit message convention. If you adopt one (e.g., Conventional Commits), note it here.
- For pull requests, include:
  - A short summary of changes and rationale.
  - Steps to verify (commands and expected outcomes).
  - Screenshots or recordings for UI changes.

## Agent Notes
- Keep instructions in this file concise and current as the project grows.
