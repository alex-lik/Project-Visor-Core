# Project Visor Core — Extensibility & Embedding Guide

This guide explains how to consume, embed, and extend `@project-visor/core` in custom portals, internal developer platforms, or commercial applications.

---

## 1. Using `@project-visor/core` as a Dependency

You can consume Visor Core in your Next.js application either via an npm registry package or as a Git submodule:

### In `package.json`:
```json
{
  "dependencies": {
    "@project-visor/core": "file:./core"
  }
}
```

### In `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@project-visor/core": ["./core/src/index.ts"],
      "@project-visor/core/*": ["./core/src/*"]
    }
  },
  "exclude": ["node_modules", "core"]
}
```

### In `next.config.mjs`:
```js
const nextConfig = {
  transpilePackages: ['@project-visor/core'],
};
export default nextConfig;
```

---

## 2. Reusable View Components

Visor Core exports all primary dashboard screens as reusable React components:

- `DashboardView`: Focus radar, project health summary, active runs.
- `ProjectsView`: Filterable projects grid and table, search, category chips.
- `ProjectDetailView`: Project tabs (Kanban, Overview & Deploy, Relations, Telemetry, Wiki, Members, OpenCode AI).
- `InfrastructureView`: Server matrix, specs, IP addresses, port usage and conflicts.
- `TasksView`: Unified cross-project Kanban board.
- `GraphView`: Interactive SVG topology graph.
- `ApiKeysView`: Scoped API tokens management.
- `LoginView`: Clean authentication form with demo login.

---

## 3. Extension Slots

To prevent code duplication, Core views provide dedicated UI slots for injecting custom actions, modal triggers, and status banners.

### Slot Reference:

| View | Slot Prop | Purpose / Example Usage |
|---|---|---|
| `ProjectsView` | `actionSlot` | Add custom creation buttons (e.g. AI project generator). |
| `InfrastructureView` | `headerActionSlot` | Add cloud provisioning buttons (e.g. 1-Click AWS/Hetzner). |
| `ProjectDetailView` | `headerActionSlot` | Add custom buttons in Kanban header (e.g. Autopilot trigger). |
| `ProjectDetailView` | `bannerSlot` | Render full-width notifications or active cycle progress strips. |
| `Navigation` | `extraNavItems` | Append additional menu items to the main sidebar and mobile menu. |
| `Navigation` | `actionSlot` | Add quick-action buttons to the bottom of the sidebar. |

### Example: Customizing `ProjectsView`
```tsx
'use client';

import ProjectsView from '@project-visor/core/views/ProjectsView';
import { Sparkles } from 'lucide-react';

export default function MyProjectsPage() {
  return (
    <ProjectsView
      actionSlot={
        <button className="px-3.5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>Generate from Template</span>
        </button>
      }
    />
  );
}
```

---

## 4. Custom Notification Providers

By default, Core's `dispatchNotification()` is a no-op so that it does not mandate specific messaging credentials.

You can register any custom notification provider (Telegram, Discord, Slack, SendGrid, Webhooks) using `registerNotificationProvider()`:

```ts
import {
  registerNotificationProvider,
  VisorNotificationEvent
} from '@project-visor/core/lib/notifications';

class SlackNotificationProvider {
  async dispatch(event: VisorNotificationEvent): Promise<void> {
    await fetch('https://hooks.slack.com/services/...', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${event.title}*\n${event.message}`,
      }),
    });
  }
}

// Register on server bootstrap
registerNotificationProvider(new SlackNotificationProvider());
```

---

## 5. Direct Database & Library Access

You can also import database schemas and utility functions directly from `@project-visor/core`:

```ts
import { db } from '@project-visor/core';
import { projects, hosts } from '@project-visor/core/db/schema';
import { detectHostPortConflicts } from '@project-visor/core/lib/containers';
import { fetchOpenCodeModels } from '@project-visor/core/lib/opencode';
```
