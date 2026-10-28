# UI/UX and accessibility guidelines

This document records the conventions adopted for the Associae frontend. Read it before changing layouts, forms, shared components, colors, or interactive feedback. It complements `AGENTS.md` and `docs/regras-de-negocio.md`; business rules remain authoritative for behavior.

## Baseline

- Target WCAG 2.2 level AA for applicable criteria.
- Use semantic HTML first. Add ARIA only when native semantics cannot express the behavior.
- Write user-facing copy in Brazilian Portuguese. Keep identifiers, code, comments, and technical documentation in English.
- Preserve the existing visual identity: blue primary, neutral surfaces, rounded corners, restrained borders, and the current landing-page typography.
- Do not use color, sound, motion, or gesture as the only way to convey meaning.
- The server is the authority for authentication, authorization, validation, and business invariants. UI validation improves the experience; it does not replace server validation.

## Design tokens and contrast

The source of truth is `src/app/globals.css`. Use tokens instead of one-off colors.

| Token | Light | Dark | Decision |
| --- | --- | --- | --- |
| `--primary` | `oklch(0.5461 0.2152 262.8809)` | `oklch(0.7137 0.1434 254.624)` | Small primary text and primary buttons reach at least 4.5:1. Dark mode uses a lighter blue with a dark foreground. |
| `--primary-foreground` | white | `oklch(0.2046 0 0)` | Chosen for contrast against the primary fill in each theme. |
| `--destructive` | `oklch(0.505 0.213 27.518)` | `oklch(0.808 0.114 19.571)` | Error text and destructive controls reach at least 4.5:1. |
| `--destructive-foreground` | white | `oklch(0.2046 0 0)` | Used by solid destructive buttons. |
| `--input` | `oklch(0.62 0.021 264.364)` | `oklch(0.55 0 0)` | Control boundaries reach at least 3:1 against adjacent surfaces. |
| `--ring` | primary light | primary dark | Focus rings use the token at full opacity. |

Additional rules:

- `--border` remains a subtle separator token. Interactive boundaries that must be perceivable (inputs, outline buttons, clickable cards) use `--input` or `--primary`.
- Focus indicators are at least 3:1 against adjacent colors. Do not use `ring-ring/50` or `outline-ring/50` for the only focus indicator.
- Prefer `focus-visible`, not `focus`, so pointer users are not distracted.
- Disabled controls are exempt from contrast requirements, but their unavailable state must still be understandable.
- Native controls use `color-scheme` from the theme, so date pickers, selects, and scrollbars follow light/dark mode.
- Test any token change in both themes. The ratios above were calculated from the token values; changing a token invalidates that check.

## Shared components

| Component | Purpose |
| --- | --- |
| `FormMessage` | Server/action feedback with `role="alert"` for errors or `role="status"` for success. Focuses itself when a message appears. Use it instead of ad-hoc alerts in forms. |
| `FormattedInput` | Progressive CPF, CNPJ, and phone formatting with cursor preservation. Sends formatted text; the server normalizes it. |
| `PasswordInput` | Password field with an accessible show/hide toggle and password-manager-compatible autocomplete. |
| `ConfirmSubmitButton` | Two-step confirmation for consequential actions. Moves focus to the confirmation and back to the trigger on cancel. |
| `ErrorPanel` | Shared error boundary content with a retry action. Used by app and landing error boundaries. |
| `AppNav` | Active-section navigation with `aria-current="page"`. Must stay inside a `<Suspense>` boundary because it uses `usePathname()` under Next.js cache components. |

Do not duplicate these patterns locally. Extend the shared component when the same need appears in another flow.

## Forms

### Structure and labels

- Every field has a persistent `<label>`. A placeholder is never the only label.
- Required fields use the native `required` attribute. When a form is fully required, add the visible note "Todos os campos são obrigatórios." instead of asterisks.
- Help text is linked with `aria-describedby`. Error messages also have stable ids.
- Use `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, and `FieldSet`/`FieldLegend` as the field skeleton.
- Group related controls in a `fieldset` with a meaningful legend.

### Input attributes and masks

- Use `inputMode="numeric"` (or `"tel"` for phone) with masks.
- Keep the correct `autoComplete`: `username` for CPF login, `current-password` for login, `new-password` for password creation, `name`, `email`, `tel-national`, `bday`.
- Masks format progressively and preserve leading zeros. They never block paste, password managers, or digits already entered.
- Masks are presentation only. The server schema remains responsible for normalization and validation.
- Native date inputs are used for dates; do not invent custom date pickers.
- Never disable paste on CPF, password, or confirmation fields.

### Validation and error recovery

- Validate on blur for fields where an error is actionable, and on submit for the complete form.
- On invalid submit, focus the first invalid field. Use `focusFirstInvalidField` from `@/lib/focus`.
- After a server error, show a `FormMessage` and focus it. Keep the message specific and explain how to recover.
- Preserve entered data when an action fails. For `useActionState` forms with uncontrolled fields, React 19 resets the form when the action returns. Intercept submit with `event.preventDefault()` and call `formAction(new FormData(event.currentTarget))`; this preserves values and still performs native validation before the submit event.
- Avoid duplicate submissions: disable the submit button while pending and show a spinner plus a context-specific pending label.
- Do not show success before the action returns success.
- Use the two-step confirmation pattern for irreversible or high-consequence operations (revocation, activation, approval, rejection). The confirmation description must state what will happen.

### Feedback states

- Idle: no message. The form should be understandable without prior interaction.
- Pending: button is disabled, spinner is visible, `aria-busy` is set on the form.
- Success: `FormMessage` with success status, confirmation of what happened, and the next useful link when applicable.
- Error: `FormMessage` with destructive styling, an actionable message, and preserved data.
- Empty: explain what is missing and how to proceed. Link to the relevant action.

## Navigation and layout

- Each page has one `<h1>`. Do not skip heading levels for visual reasons.
- The app shell provides a skip link, a `<header>`, a labeled navigation, a `<main>` region, and a footer only where it exists on the page.
- Navigation links use `aria-current="page"` for the current section.
- Internal navigation uses `next/link`. Downloads/streamed documents may use `<a>`.
- Preserve the destination when it is already handled by the flow (for example, invite acceptance passes `next` to login).
- The app content owns horizontal padding and vertical rhythm. Individual auth pages must not add another `px-* py-*` wrapper inside the app shell.
- Invalid routes must render a styled 404 with navigation. The root `src/app/not-found.tsx` wraps the shared landing 404; `src/app/(application)/app/not-found.tsx` handles `notFound()` inside the app segment.
- Unknown app URLs render the global 404. Do not add catch-all routes that depend on client hydration for the error page.

## Responsiveness and interaction targets

- Layouts must reflow at 320 CSS pixels without horizontal scrolling. Avoid hiding required content on small screens.
- Interactive targets are at least 24 × 24 CSS pixels. Prefer 32–44 px for primary touch actions.
- Full-card click targets only when the whole card is the action. Otherwise keep an explicit link/button.
- Buttons use button semantics; navigation uses links. Do not make a `div` clickable.
- Destructive actions are visually distinct and never adjacent to an unintended primary action without spacing.

## Motion and performance

- Respect `prefers-reduced-motion`; the global stylesheet reduces transitions and animations but keeps loading spinners functional.
- Use motion only for state continuity (disclosure, reveal, dialog entry). No decorative loops or artificial delays.
- Avoid adding dependencies for simple UI behavior. Prefer native `<details>` for FAQ-style disclosures.
- Keep the landing page smooth-scroll behavior behind the reduced-motion check.

## Accessibility verification

Required after UI changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Also verify manually:

- Keyboard traversal: skip link, header, form, actions, footer, and return path.
- Visible focus on every control, including icon-only buttons and links.
- Zoom to 200% and reflow at 320 px.
- Light and dark themes.
- Screen-reader labels and error announcements for the changed forms.
- No horizontal overflow with long names, emails, file names, and invite URLs.

Automated browser tooling (Playwright/axe) is not currently installed. Do not claim full WCAG conformance based on static analysis. Record any manual checks that were not performed.

## Current limitations

- The browser-based accessibility sweep was not automated because no Playwright/axe/lighthouse infrastructure is installed in the repository.
- PostgreSQL integration tests are skipped unless `RUN_DATABASE_TESTS=1` and `TEST_DATABASE_URL` are configured.
- The display timezone for human-readable dates is the server environment timezone. A product decision is still needed if dates must be shown in a specific Brazilian timezone.
- Unknown URLs under `/app` use the global 404; `notFound()` inside a matched app route uses the app 404.
