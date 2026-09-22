# Changelog

All notable changes to the **Project Visor Core** (@project-visor/core) open-source project will be documented in this file.

The format is based on **[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)**,
and this project adheres to **[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

---

## [1.0.2] - 2026-09-22

### Security & Hardening
- **Demo Authentication**: Disabled production demo login by default (`ENABLE_DEMO_LOGIN=true`), issued restricted `viewer` session instead of `admin`.
- **Project Detail Saves**: Added response error checking (`if (!res.ok)`) and error alerts on deployment and wiki note saves (`handleSaveDeployment`, `handleSaveWiki`).
- **Dashboard Accessibility & Feedback**: Added loading spinner and disabled state to task completion button (`completingTaskId`), and added accessible `aria-label="Завершить задачу"`.
- **Loading Skeletons**: Added `animate-pulse` placeholder cards on initial data load in `DashboardView`.

---

## [1.0.1] - 2026-09-22

### Fixed
- Resolved QA defects F-01 through F-12 (RBAC project management checks, `canViewInfra` isolation, Cyrillic transliteration, clipboard copy fallback, favicon, and user admin).

---

## [1.0.0] - 2026-09-22

### Added
- Initial standalone open-source release of **Project Visor Core** (`@project-visor/core`).
- Core SQLite schema, multi-container management, port conflict detection, OpenCode integration, Kanban board, system graph, Prometheus health checks, and extensibility slots.
