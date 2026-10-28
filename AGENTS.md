# Associae — Agent Instructions

## Project Context
Associae is a fullstack application built with Next.js 16.4.3, React 19, TypeScript, pnpm, and Biome. The repository contains the landing page, web app, API, and admin panel.

## Development Guidelines
- Follow existing project patterns and native framework conventions.
- Write simple, readable, maintainable code with clear names and focused responsibilities.
- Prefer straightforward solutions over unnecessary abstractions or premature generalization.
- Avoid comments that merely explain code. Add comments only when necessary to clarify non-obvious behavior.
- Respond in Portuguese. Write all code, identifiers, documentation, and necessary comments in technical English.
- Respect the user's requirements and avoid unrequested scope expansion.
- Inspect relevant code and documentation before modifying existing behavior.
- Run appropriate checks after changes and report results accurately.


## UI and Accessibility
- Read `docs/ui-ux-guidelines.md` before changing layouts, forms, shared UI components, design tokens, or feedback states.
- Preserve the accessibility baseline: semantic HTML, persistent labels, visible focus, minimum contrast, keyboard operation, and reduced-motion support.
- Reuse `FormMessage`, `FormattedInput`, `PasswordInput`, and `ConfirmSubmitButton` instead of duplicating form patterns.

## Business Rules
- Read `docs/regras-de-negocio.md` at the start of each work session before working on the project. Revisit relevant sections when the domain changes.
- Treat this document as the source of confirmed product decisions, not proof of implementation.
- Never restore legacy behavior or turn suggestions and assumptions into requirements.
- Preserve the current `users` and `accounts` schema fields. Explain proposed changes and obtain explicit approval before changing them.
- When code and documented behavior differ, identify the discrepancy before changing business behavior.
- Continue work independent of unresolved decisions. Ask the user only when a pending decision blocks progress.
- Update business rules only when authorized. Keep confirmed decisions distinct from technical recommendations.

## Architecture and Scope
- Preserve the existing project structure and architecture unless a change is necessary for the requested task.
- Before proposing a significant structural or architectural change, explain why it is needed, its benefits, available alternatives, and why the proposed approach is preferred.
- Do not perform changes that require user approval until approval is granted.
- An explicit authorization applies only to the requested scope, not to unrelated changes.

<!-- BEGIN:nextjs-agent-rules -->

## Next.js Documentation
This project uses Next.js 16.4.3. Before writing or changing Next.js code, consult the relevant documentation in `node_modules/next/dist/docs/`, resolved from this file's directory. In monorepos, locate the installed `next` package first. Follow current APIs and heed deprecation notices.

This block is managed by Next.js tooling. Verify its generation behavior in `node_modules/next/dist/server/lib/generate-agent-files.js` before modifying or removing it.

<!-- END:nextjs-agent-rules -->