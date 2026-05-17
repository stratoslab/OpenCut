# OpenCut Migration: Next.js → Vite + React + Cloudflare Pages

## Executive Summary

OpenCut is 95% client-side (editor, WASM, WebGPU, timeline, preview). The Next.js server bundle (11.5 MB) is the reason Cloudflare Workers deployment fails. Migrating to Vite SPA + tiny Cloudflare Workers for APIs solves the problem completely.

**Before:** Next.js monolith → 11.5 MB Worker → ❌ exceeds 3 MB free tier
**After:** Vite SPA (static) + 3 tiny Workers (<100 KB each) → ✅ well within free tier

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Pages (Static SPA)               │
│                                                          │
│  index.html  +  assets/*.js (~2 MB gzipped)             │
│  assets/*.wasm (~3 MB)  +  fonts, images                │
│                                                          │
│  Routes: /, /editor/:id, /projects, /blog, /changelog,  │
│          /privacy, /terms, /roadmap, /sponsors, /brand   │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Sounds Worker   │  │ Feedback Worker │  │ Auth Worker     │
│ (~30 KB)        │  │ (~20 KB)        │  │ (~50 KB)        │
│ Freesound proxy │  │ SQLite storage  │  │ better-auth     │
│ + rate limit    │  │ + rate limit    │  │ + D1 database   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Phase 1: Vite Foundation (1-2 days)

### 1.1 Create new Vite project
```
apps/web-vite/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx
    └── ... (migrate src/ from apps/web)
```

### 1.2 Dependencies to install
```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "zustand": "^5",
    "@radix-ui/*": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "@hugeicons/react": "latest",
    "motion": "latest",
    "sonner": "latest",
    "zod": "latest",
    "nanoid": "latest",
    "opencut-wasm": "^0.2.10",
    "@huggingface/transformers": "latest",
    "wavesurfer.js": "latest",
    "soundtouchjs": "latest",
    "mediabunny": "latest",
    "react-markdown": "latest",
    "react-resizable-panels": "latest",
    "react-window": "latest",
    "embla-carousel-react": "latest",
    "cmdk": "latest",
    "next-themes": "latest",
    "react-hook-form": "latest",
    "feed": "latest",
    "gray-matter": "latest"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "latest",
    "vite": "latest",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "typescript": "latest",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "wrangler": "latest"
  }
}
```

### 1.3 Dependencies to REMOVE
- `next`, `@opennextjs/cloudflare`, `wrangler` (from web app)
- `@content-collections/core`, `@content-collections/next`
- `drizzle-orm`, `postgres`, `pg`
- `better-auth`, `@upstash/redis`, `@upstash/ratelimit`
- `@napi-rs/canvas`, `sharp`

### 1.4 Vite config
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "opencut-wasm": ["opencut-wasm"],
          "transformers": ["@huggingface/transformers"],
          "editor-core": ["./src/core"],
          "ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
  },
});
```

---

## Phase 2: Routing Migration (1 day)

### 2.1 Replace Next.js routing with React Router
```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/changelog" element={<ChangelogIndex />} />
          <Route path="/changelog/:version" element={<ChangelogDetail />} />
          <Route path="/contributors" element={<ContributorsPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/brand" element={<BrandPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

### 2.2 Import replacements (automated via codemod)
| Next.js Import | Replacement |
|---|---|
| `next/link` | `react-router-dom` `<Link>` |
| `next/navigation` `useRouter` | `react-router-dom` `useNavigate` |
| `next/navigation` `useParams` | `react-router-dom` `useParams` |
| `next/navigation` `notFound` | `react-router-dom` `<Navigate to="/_not-found" />` |
| `next/image` | Standard `<img>` with lazy loading |
| `next/font/google` | `@fontsource/inter` CSS import |
| `next/script` | Standard `<script>` or `react-helmet-async` |

---

## Phase 3: Content Migration (1 day)

### 3.1 Changelog: Replace content-collections with gray-matter
```ts
// src/changelog/entries/index.ts
import matter from "gray-matter";

// Import all markdown files as raw strings via Vite glob
const entries = import.meta.glob("./**/*.md", { as: "raw", eager: true });

export const allChangelogs = Object.entries(entries).map(([path, content]) => {
  const { data } = matter(content);
  return {
    ...data,
    slug: path.replace("./", "").replace(".md", ""),
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
```

### 3.2 Blog: Keep Marble CMS fetch, move to client
```ts
// src/blog/query.ts (already framework-agnostic)
// Just add loading states and error boundaries for client-side rendering
```

### 3.3 Static files: Generate at build time
- `robots.txt` → `public/robots.txt`
- `sitemap.xml` → Vite plugin generates at build
- `rss.xml` → Vite plugin generates at build

---

## Phase 4: API Routes → Cloudflare Workers (2 days)

### 4.1 Sounds Search Worker (`workers/sounds-search/`)
```ts
// workers/sounds-search/src/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/sounds/search") return new Response("Not found", { status: 404 });

    // Simple rate limiting via KV
    const key = `rate:${url.searchParams.get("ip")}`;
    const count = await env.RATE_LIMIT.get(key);
    if (count && parseInt(count) > 100) return new Response("Rate limited", { status: 429 });

    const response = await fetch(`https://freesound.org/apiv2/search/text/?${url.searchParams}`, {
      headers: { Authorization: `Token ${env.FREESOUND_API_KEY}` },
    });
    return new Response(response.body, {
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
```

### 4.2 Feedback Worker (`workers/feedback/`)
```ts
// Uses D1 (SQLite) instead of PostgreSQL
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await request.json();
    await env.DB.prepare(
      "INSERT INTO feedback (type, message, created_at) VALUES (?, ?, datetime('now'))"
    ).bind(body.type, body.message).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
} satisfies ExportedHandler<Env>;
```

### 4.3 Auth Worker (optional, deferred)
- Use better-auth with Hono adapter
- D1 database for users/sessions
- KV for rate limiting

---

## Phase 5: Editor & Core (already client-side, 0-1 day)

The editor is already 100% client-side. Minimal changes needed:
- Replace `next/image` → `<img>` in project thumbnails
- Replace `next/link` → `<Link>` in project navigation
- Replace `useRouter` → `useNavigate` in project creation flow
- WASM loading already dynamic (from previous fix)

---

## Phase 6: Deployment (1 day)

### 6.1 Cloudflare Pages (static SPA)
```json
// package.json scripts
{
  "build": "vite build",
  "preview": "vite preview",
  "deploy": "wrangler pages deploy dist --project-name=opencut"
}
```

### 6.2 Workers (APIs)
```json
// workers/sounds-search/package.json
{
  "scripts": {
    "deploy": "wrangler deploy"
  }
}
```

### 6.3 Root package.json
```json
{
  "scripts": {
    "dev": "cd apps/web-vite && vite",
    "build": "cd apps/web-vite && vite build",
    "deploy:pages": "cd apps/web-vite && wrangler pages deploy dist --project-name=opencut",
    "deploy:workers": "wrangler deploy --config workers/sounds-search/wrangler.jsonc && wrangler deploy --config workers/feedback/wrangler.jsonc",
    "deploy": "npm run build && npm run deploy:pages && npm run deploy:workers"
  }
}
```

---

## File Migration Map

### Copy as-is (no changes needed)
```
src/core/              → src/core/
src/timeline/          → src/timeline/
src/preview/           → src/preview/
src/properties/        → src/properties/
src/assets/            → src/assets/
src/commands/          → src/commands/
src/export/            → src/export/
src/services/          → src/services/
src/wasm/              → src/wasm/
src/components/ui/     → src/components/ui/
src/stickers/          → src/stickers/
src/fps/               → src/fps/
src/project/           → src/project/
src/editor/            → src/editor/
src/utils/             → src/utils/
src/hooks/             → src/hooks/
src/types/             → src/types/
```

### Need routing updates
```
src/app/page.tsx       → src/pages/LandingPage.tsx
src/app/projects/      → src/pages/ProjectsPage.tsx
src/app/editor/        → src/pages/EditorPage.tsx
src/app/blog/          → src/pages/BlogPages.tsx
src/app/changelog/     → src/pages/ChangelogPages.tsx
src/app/contributors/  → src/pages/ContributorsPage.tsx
src/app/roadmap/       → src/pages/RoadmapPage.tsx
src/app/sponsors/      → src/pages/SponsorsPage.tsx
src/app/brand/         → src/pages/BrandPage.tsx
src/app/privacy/       → src/pages/PrivacyPage.tsx
src/app/terms/         → src/pages/TermsPage.tsx
```

### Need API replacement
```
src/app/api/           → workers/ (separate Cloudflare Workers)
src/db/                → D1 schema in workers/
src/auth/              → workers/auth/ (deferred)
```

---

## Expected Bundle Size After Migration

| Asset | Size (uncompressed) | Size (gzipped) |
|---|---|---|
| React + Router + UI libs | ~400 KB | ~120 KB |
| Editor core + timeline | ~200 KB | ~60 KB |
| WASM binary | ~3 MB | ~1 MB |
| Transformers (AI) | ~10 MB | ~3 MB |
| Fonts + images | ~500 KB | ~200 KB |
| **Total** | **~14 MB** | **~4.4 MB** |

**Key point:** Cloudflare Pages has **no size limit** for static files. The 3 MB limit only applies to Workers. The SPA goes on Pages (unlimited), and the API Workers are <100 KB each.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| React Router vs Next.js routing | Medium | Next.js App Router → React Router is well-documented |
| Blog SSR → CSR | Low | Marble CMS is just fetch calls, add loading states |
| Image optimization loss | Low | Use `loading="lazy"` + `decoding="async"` |
| SEO impact | Medium | Add `react-helmet-async` for meta tags, prerender key pages |
| Auth migration | Low | Auth is scaffolded but not used, defer entirely |

---

## Timeline Estimate

| Phase | Duration | Complexity |
|---|---|---|
| 1. Vite Foundation | 1-2 days | Low |
| 2. Routing Migration | 1 day | Medium |
| 3. Content Migration | 1 day | Low |
| 4. API Workers | 2 days | Medium |
| 5. Editor Updates | 0-1 day | Low |
| 6. Deployment Setup | 1 day | Low |
| **Total** | **6-8 days** | |

---

## Decision Points

1. **Auth system**: Defer entirely (not used) or migrate to Workers? → **Recommend: defer**
2. **Blog SSR**: Keep client-side fetch or add prerendering? → **Recommend: client-side + prerender key pages**
3. **Database**: Move feedback to D1 (SQLite) or keep PostgreSQL? → **Recommend: D1 (simpler, free tier)**
4. **Rate limiting**: Cloudflare KV or remove? → **Recommend: KV (free tier, 100K reads/day)**
