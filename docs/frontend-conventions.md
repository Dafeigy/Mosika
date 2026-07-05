# Frontend Conventions

This document captures the current Vue 3 frontend organization for Mousika and the conventions to follow when adding or refactoring UI code.

## Directory Layout

Frontend code lives in `apps/desktop/src`.

```text
apps/desktop/src
|-- api/                  API clients and server URL helpers
|-- components/
|   |-- layout/           App shell pieces: titlebar, sidebar, statusbar
|   |-- ui/               Generated shadcn-vue primitives
|   `-- workbench/        Reusable workbench-specific panels/widgets
|-- composables/           Vue Composition API state and workflow logic
|-- data/                 Temporary mock/demo data
|-- lib/                  Shared utilities
|-- pages/                Top-level route/view components
|-- styles/               Feature-level global CSS
|-- types/                Shared TypeScript domain/view types
|-- App.vue               App state coordinator and page composition
`-- main.ts              App bootstrap and global style imports
```

## Component Boundaries

- Keep `App.vue` as a coordinator: app-level state, persistence calls, window commands, and page selection.
- Put top-level screens in `pages/`, for example `HomePage.vue`, `WorkbenchPage.vue`, and `PlaceholderPage.vue`.
- Put shell components in `components/layout/`; they should be driven by props and emit events instead of importing app state directly.
- Put domain-specific reusable panels in `components/workbench/`.
- Keep generated shadcn-vue files in `components/ui/` close to generated style. Prefer wrapping them from feature components instead of editing generated primitives.

## State And Data

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Prefer a single owner for mutable state. Parent components pass state down through props and receive changes via emits or `v-model:*`.
- Put reusable stateful workflows in `composables/`, named as `useXxx.ts`.
- Keep `App.vue` as a composition layer. It may wire composables together, but should not own long workflow implementations such as task event streams or persistence serialization.
- Component-local DOM details, such as textarea autoresize, should stay inside the component that owns the DOM node.
- Keep temporary demo data in `data/`. Move API-shaped data types to `types/` before wiring real backend endpoints.
- Do not make project menu selections navigate unless a feature explicitly requires navigation.

## Styling

- Global design tokens live in `styles.css`.
- Feature-level class styles live in `styles/workbench.css` when they are shared across split components.
- New isolated components may use scoped styles, but avoid duplicating existing workbench class rules.
- Keep the current workbench density: compact controls, restrained colors, stable dimensions, and no marketing-style sections.
- Use `lucide-vue-next` for icons. Add accessible labels or titles for icon-only buttons.

## API And Desktop Integration

- Frontend API helpers belong in `api/`.
- Tauri commands should stay at the app/page boundary unless a component is specifically responsible for that integration.
- When adding a Tauri plugin, update frontend dependencies, Rust dependencies, capabilities, and run the Tauri checks noted in `AGENTS.md`.

## Commit Messages

Use a lightweight Conventional Commits format:

```text
<type>(<scope>): <summary>
```

Common frontend types:

- `feat`: user-visible capability or workflow
- `fix`: bug fix or broken behavior
- `refactor`: structure change without intended behavior change
- `style`: visual/CSS-only adjustment
- `docs`: documentation-only change
- `test`: tests or test fixtures
- `chore`: tooling, dependencies, generated config, or maintenance

Recommended frontend scopes:

- `desktop-ui`: Vue desktop app shell or pages
- `workbench`: task thread, composer, inspector, or sidebar workflow
- `project-menu`: project selector and project tree behavior
- `api`: frontend API client code
- `styles`: shared CSS, theme tokens, layout rules
- `docs`: frontend conventions and developer docs

Examples:

```text
refactor(desktop-ui): split App shell into pages and layout components
fix(project-menu): preserve selected project after registry reload
docs(docs): add frontend commit message convention
```

Keep the summary imperative, concise, and under 72 characters when practical. If a change touches multiple areas, choose the scope that best describes the user-facing or architectural center of the change.

## Verification

Run the relevant command after changes:

```powershell
npm run verify:web
```

For changes that also touch FastAPI or Tauri:

```powershell
npm run verify:server
cd apps/desktop/src-tauri
cargo check
```
