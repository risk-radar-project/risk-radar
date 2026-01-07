# RiskRadar Frontend AGENTS Handbook

This file is the **single source of truth** for every AI Agent and human developer touching the RiskRadar frontend (Next.js 16). Follow it strictly to keep the skeleton consistent, unblock parallel microservice work, and ensure new contributors can become productive immediately.

---

## 0. Purpose

- Define the **complete guidelines, standards, architecture rules, and workflows** for frontend development.
- Guarantee that **AI Agents know exactly how to modify the codebase** without breaking structure.
- Ensure **developers understand where things belong** and how to extend features while backend services remain in flux.
- Maintain a ready-for-integration skeleton built on placeholders, shadcn UI, and session guards.

This document applies to every change under `services/frontend/`.

---

**🔥 Mandatory for all AI Agents**

Before making any change, an agent MUST:

- Read (or re-read) this AGENTS.md.
- Inspect the existing code to find the prevailing pattern.
- Follow the exact design system and file locations already defined.
- Plan to finish with `npm run format`, `npm run lint`, and `npm run build`, fixing issues until they pass.
- Avoid creative liberties—if something is unclear, stop and ask the project owner.

---

## 1. Core Principles

1. **Consistency over creativity** – match existing patterns first.
2. **Never invent new architecture** – extend what exists unless the project owner explicitly requests otherwise.
3. **Honor the design system** – Tailwind + shadcn components + shared primitives only.
4. **Keep it simple** – no unnecessary abstractions; use placeholders when backend logic is missing.
5. **Always keep the build green** – `npm run build` must succeed (Current middleware deprecation warning is acceptable).
6. **Prepare for backend integration** – APIs and guards stay placeholder-driven until the gateway and microservices are online.

---

## 2. Project Structure Rules

```
services/frontend/
├─ app/            # Next.js routes (segmented)
│   ├─ (public)/
│   ├─ (auth)/
│   ├─ (user)/
│   ├─ (admin)/
│   └─ standalone routes (only if explicitly approved by the project owner)
├─ components/
│   ├─ layout/     # AppSidebar, AppFooter, AdminSidebar
│   ├─ providers/  # QueryClientWrapper, ClientSessionHydrator
│   ├─ shared/     # PageHeader, PageTitle, SectionCard, etc.
│   ├─ ui/         # shadcn primitives + wrappers (form primitives, button, dialog...)
│   └─ ui/ux/      # Loader, Spinner, EmptyState, Badge, ModalConfirm, Skeleton
├─ hooks/          # use-session, use-api, guards, etc.
├─ lib/
│   ├─ api/        # Placeholder API clients (auth, user, admin, reports, media, ...)
│   ├─ auth/       # session.ts, load-session.ts, guards/
│   ├─ validation/ # Zod schemas when needed
│   └─ utils.ts
├─ stores/         # Zustand stores (session only for now)
└─ AGENTS.md       # You are here
```

### Structure commandments

- **Do not create new top-level folders** without approval.
- Keep related UI, hooks, and API helpers close together. Large domains may eventually get `features/<domain>/...` once the owner approves, but not before.

---

## 3. Routing & Layout Standards

| Area       | Routes (must exist)                                        | Layout                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------- |
| Public     | `/` (map placeholder)                                      | `app/(public)/layout.tsx`             |
| Auth       | `/login`, `/register`                                      | `app/(auth)/layout.tsx`               |
| User       | `/profile`, `/settings`, `/my-reports`                     | `app/(user)/layout.tsx`               |
| Admin      | `/admin`, `/admin/users`, `/admin/reports`, `/admin/stats` | `app/(admin)/layout.tsx` with sidebar |
| Standalone | `/map`, `/reports` (and future domain-specific routes)     | `app/layout.tsx` defaults             |

Agents MUST NOT rename or relocate these segments without instruction. When adding new pages, pick the correct segment based on access level (public/auth/user/admin).

---

## 4. UI & Design System Rules

- Tailwind utility classes only; avoid raw CSS unless absolutely necessary.
- Use shadcn components (`components/ui/*`) and shared primitives (`components/shared/*`).
- Prefer the UX helpers (`components/ui/ux/*`) for loaders, skeletons, empty states, badges, modal confirms.
- Respect the dark theme and spacing conventions already present.
- Use ASCII unless the targeted file already contains diacritics.

**Example UX import**

```ts
import { Loader, Spinner, EmptyState, Badge, ModalConfirm, Skeleton } from "@/components/ui/ux"
```

---

## 5. Global State, Session & Permissions

- Zustand store: `stores/use-session-store.ts` keeps `user` (including `undefined` while hydrating).
- Server session loader: `lib/auth/load-session.ts` (currently returns placeholders) feeds data into `window.__SESSION__` inside `app/layout.tsx`.
- Client hydration: `components/providers/client-session-hydrator.tsx` uses `useHydrateSession` to write into the store.
- Server guards: `lib/auth/guards/require-user.ts` and `require-admin.ts` enforce access inside layout files.
- Client guards: `hooks/use-require-user.ts` and `use-require-admin.ts` watch the store; they must wait for `user !== undefined` before redirecting.
- Middleware: `middleware.ts` is a placeholder for future JWT validation. Do not remove it.

### Session states

- `undefined` → hydration in progress. Guards must wait.
- `null` → no authenticated user. Guards may redirect.
- `User object` → authenticated session. Guards allow access.

### Never do this

- Replace Zustand with another store.
- Bypass hydration (e.g., calling `loadSession()` in a client component).
- Hardcode permissions directly in components – always use guards/stores.

---

## 6. API Client Architecture

- All HTTP calls go through `apiFetch()` (`lib/api/fetcher.ts`). Do not `fetch()` directly in components or hooks.
- API domain files to extend: `lib/api/auth.ts`, `user.ts`, `admin.ts`, `reports.ts`, `media.ts`, etc.
- Placeholder responses are fine; keep them obvious (fake IDs, sample arrays).
- React Query hooks must return `data` only (see `hooks/use-api.ts`). Example:
    ```ts
    export function useCurrentUser() {
        return useQuery({
            queryKey: ["current-user"],
            queryFn: async () => (await getCurrentUser()).data
        })
    }
    ```
- No real endpoint URLs until the API gateway is ready. Prepare for quick swaps by isolating fetch logic inside `lib/api/*`.

**API hooks must flatten responses**

- ✅ Correct: `queryFn: async () => (await apiCall()).data`
- ❌ Incorrect: `queryFn: apiCall` (which returns `{ data, error }`)

---

## 7. Forms & Validation

- Use React Hook Form + Zod + shadcn form primitives.
- Reusable helpers live in `components/ui/form/*` (e.g., `SimpleForm`, `TextField`).
- Schemas go in `lib/validation/` (create files per domain when needed).
- Client-side validation only until backend validators exist.
- Error handling stays visual (e.g., `FormMessage`). Do not add business logic or side effects for errors yet.

Workflow:

1. Define schema (Zod) under `lib/validation/feature.ts`.
2. Use `useForm({ resolver: zodResolver(schema) })`.
3. Compose UI with shared `Form`, `FormField`, `TextField`, etc.

---

## 8. Admin & Domain-specific Guidance

- `(admin)` pages must use `AdminSidebar`, table components (`components/ui/table/*`), and stay mock-driven until real APIs ship.
- `/reports` (public/user) uses skeletons and placeholder cards; keep filters ready but data fake.
- `/map` is an EmptyState until the map-service integration is approved; keep layout ready for controls.
- AI service surfaces are allowed as tabs/side panels but must be marked “AI integration pending.”
- Notification/community/media/monitoring/audit pages can be scaffolded with `SectionCard`, `Badge`, `ModalConfirm`, etc., but do not add business logic beyond placeholders.

---

## 9. Workflow for Agents

1. **Understand the request** – map it to the right route segment/domain.
2. **Inspect existing files** – use `list_dir`, `read_file`, `grep_search`. Never overwrite user work blindly.
3. **Plan** – if the change is multi-step, create TODO entries and tackle them sequentially.
4. **Edit safely** – use `create_file`, `apply_patch`, or notebooks; avoid direct terminal editing of source files.
5. **Follow conventions** – shared components, Tailwind, placeholders, no custom architecture.
6. **Format, lint, build** – every iteration ends with:
7. `npm run format`
8. `npm run lint`
9. `npm run build`

Fix issues and rerun until all three succeed (the known middleware warning during build is acceptable). No change is complete without these steps. 7. **Report clearly** – describe changes, list tests (format/lint/build), mention warnings, and outline next steps if needed.

---

## 10. Coding Standards & Tooling

- **Formatting**: Prettier defaults (4 spaces, double quotes, no semicolons). Keep files ASCII unless they already use diacritics.
- **ESLint**: Keep the project clear of new warnings. Adhere to Next.js + Prettier configs.
- **Comments**: Only when intent isn’t obvious. Avoid noise such as “sets the state”.
- **Imports**: Prefer absolute aliases (`@/components/...`). Avoid unused imports (lint will fail the build).

---

## 11. Behavioral Rules for AI Agents

- ✅ Always check for an existing pattern before implementing a feature.
- ✅ Use mock data and placeholders where backend calls are undefined.
- ✅ Keep new features scoped to the request; do not refactor tangential code.
- ✅ When adding navigation links, immediately create placeholder routes if they do not exist.

- ❌ Do not restructure directories or rename files without permission.
- ❌ Do not remove or alter global providers, middleware, or session logic.
- ❌ Do not implement backend logic on the client.
- ❌ Do not introduce third-party UI libs or map widgets without approval.
- ❌ Do not delete or rewrite placeholder comments—they mark unfinished backend integrations.

---

## 12. Adding a New Feature (Checklist)

1. **Pick the right segment**: public/auth/user/admin.
2. **Create UI** using shared components, Tailwind, and shadcn primitives.
3. **Add validation** (if a form) via Zod + React Hook Form.
4. **Add/update API client** in `lib/api/<domain>.ts` (placeholder-friendly).
5. **Expose hooks** in `hooks/` using React Query returning pure `data`.
6. **Wire up navigation** (AppSidebar, AdminSidebar) if a new route is user-facing.
7. **Mind SSR vs CSR**: server components for layouts/data loading, client components for interactive parts.
8. **Run build** and fix any issues.

---

## 13. Common Pitfalls

- Creating new routes without updating navigation (or vice versa).
- Returning `{ data }` objects from hooks, forcing components to double unwrap.
- Introducing inline fetch calls or mutation logic in components.
- Forgetting to guard admin/user areas on both server and client.
- Removing placeholder warnings or comments that future devs rely on.

---

## 14. Future Enhancements (Need Approval)

The following may happen later—do **not** implement without explicit direction:

1. Introduce `features/<domain>` folders to colocate routes/hooks/api per microservice.
2. Add env-driven API base URLs and integrate with the API Gateway.
3. Replace placeholder session loading with real `/auth/me` calls.
4. Upgrade middleware to real JWT validation.
5. Integrate real map components, media uploaders, AI widgets.
6. Expand authz-driven UI (role/permission editing) once backend endpoints exist.

### ❌ ABSOLUTELY FORBIDDEN FOR AI AGENTS

- Creating new map experiences or adding map libraries without approval.
- Implementing authentication (JWT parsing, token handling) on the frontend.
- Calling microservices directly and bypassing the future API Gateway.
- Introducing new design tokens, colors, or typography outside the current system.
- Adding animations (e.g., framer-motion) or other visual flourishes without sign-off.

---

## 15. Contact & Escalation

- Architectural changes, new folders, or redesigns require approval from the **Project Owner / Lead Developer**.
- When in doubt (conflicts, unclear instructions, major risks), stop and request guidance before proceeding.

---

## 16. Need More Context?

- High-level rules: `style_guide.md`, `zalozenia_projektowe.md` at repo root.
- Microservice specs: `docs/docs/<service>/index.md`.
- Existing UI behavior: inspect `components/`, `app/`, and `lib/api/` for patterns before adding new logic.

---

Stay consistent, keep placeholders clear, and leave every feature ready for the next person (or agent) to continue without rework. This handbook is binding—comply with it for every frontend change.
