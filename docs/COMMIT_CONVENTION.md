# Стандарт оформления коммитов (Commit Convention Standard)

В репозитории **Project Visor** принята спецификация **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)**. Данное руководство обязательно к соблюдению всеми участниками разработки, а также AI-агентами, коммитящими в репозиторий.

---

## 1. Анатомия сообщения коммита

Каждое сообщение коммита состоит из **заголовка (header)**, опционального **тела (body)** и опционального **футера (footer)**:

```text
<type>(<scope>): <short description>
│       │        │
│       │        └─ Краткое описание в повелительном наклонении (до 72 символов)
│       └────────── Область затронутой кодовой базы (lowercase)
└────────────────── Тип изменения (feat, fix, docs, etc.)

[Пустая строка]

[Тело сообщения (Body): детальное объяснение мотивации, контекста и архитектурных решений]

[Пустая строка]

[Футер (Footer): ссылки на задачи, breaking changes, соавторы]
```

Пример полного коммита:
```text
feat(rbac): introduce granular token scopes for AI agents

Add support for individual token scopes: 'read', 'write_tasks', 'update_status',
and 'manage_deployments'. Token access checks now strictly enforce that agents
cannot access projects outside the token owner's permissible project list.

Closes #42
Co-authored-by: Alex <alex@example.com>
```

---

## 2. Типы изменений (`<type>`)

| Тип | Назначение | Влияние на SemVer |
| :--- | :--- | :--- |
| **`feat`** | Добавление новой функциональности (страница, API, MCP-инструмент) | **MINOR** (или MAJOR при `!`) |
| **`fix`** | Исправление ошибки, бага или уязвимости | **PATCH** |
| **`refactor`**| Изменение кода без изменения внешней логики и добавления фич | Внутренний / PATCH |
| **`perf`** | Оптимизация производительности (скорость, память, SQL-запросы) | **PATCH** |
| **`docs`** | Изменения только в документации, README, wiki, markdown | Внутренний |
| **`style`** | Правки форматирования, отступы, линтинг, кавычки (без изменений логики) | Внутренний |
| **`test`** | Добавление новых тестов или корректировка существующих | Внутренний |
| **`build`** | Изменения в сборке, зависимостях (`package.json`), Dockerfile | Внутренний / PATCH |
| **`ci`** | Настройка пайплайнов GitHub Actions, Docker Compose, скриптов CI | Внутренний |
| **`chore`** | Вспомогательные задачи, подготовка релиза, минорные правки конфигов | Внутренний |
| **`revert`** | Откат предыдущего коммита (`revert: feat(ui): add dark theme`) | Зависит от коммита |

---

## 3. Стандартизированные скоупы (`<scope>`)

Скоуп указывает, какая именно часть системы была затронута:

| Скоуп | Описание |
| :--- | :--- |
| `api` | API-маршруты Next.js (`src/app/api/...`) |
| `mcp` | MCP-сервер, инструменты, схемы, SSE и JSON-RPC транспорты |
| `db` | Схема БД SQLite/LibSQL, миграции Drizzle, сид-скрипты |
| `auth` | Аутентификация пользователей, сессии, JWT, bcrypt |
| `rbac` | Роли пользователей (`owner`, `editor`, `viewer`), проверка прав |
| `ui` | Компоненты интерфейса, дашборд, Tailwind, дизайн-система |
| `kanban` | Логика канбан-доски, перетаскивание задач, фильтры колонок |
| `infra` | Серверы, мониторинг, хосты, Prometheus метрики, детекция коллизий портов |
| `docker` | Dockerfile, docker-compose, окружения запуска |
| `release` | Изменения версий, сборка дистрибутивов, обновление CHANGELOG |
| `deps` | Обновление зависимостей npm |

*Примечание: Скоуп может быть опущен в случаях глобальных изменений (например, `docs: update general repository README`).*

---

## 4. Ломающие изменения (Breaking Changes)

Если изменение нарушает обратную совместимость (удален эндпоинт, изменена сигнатура вызова MCP-инструмента, изменена схема базы без автомиграции):

1. В заголовке перед двоеточием ставится символ `!`:
   ```text
   feat(mcp)!: deprecate visor_execute_command tool in favor of sandboxed agent
   ```
2. В футере коммита обязательно добавляется блок `BREAKING CHANGE:`:
   ```text
   BREAKING CHANGE: The `visor_execute_command` MCP tool has been removed.
   Agents must migrate to using the isolated sandbox agent runner.
   To migrate existing configurations, replace tool invocations with `visor_run_job`.
   ```

---

## 5. Золотые правила Git Hygiene

1. **Атомарность (Atomic Commits)**:
   - Один коммит решает ровно одну логическую задачу.
   - Не смешивайте форматирование кода со сменой бизнес-логики.
   - Не объединяйте исправление багов в аутентификации с добавлением UI-кнопок в одну фиксацию.
2. **Повелительное наклонение (Imperative Mood)**:
   - Пишите `add project sharing support`, а **не** `added` или `adds`.
   - Проверочная фраза: *"If applied, this commit will: **[add project sharing support]**"*.
3. **Регистр и длина**:
   - Первая строка начинается со строчной буквы (после `<type>(<scope>): `).
   - Длина первой строки — не более **72 символов**.
   - В конце заголовка точка **не ставится**.
4. **Связывание с задачами**:
   - Используйте ключевые слова в футере: `Closes #12`, `Fixes #45`, `Refs #89`.
5. **Чистота истории**:
   - Перед слиянием ветки фичи с `main` используйте `rebase` или чистый `squash-merge` с сохранением Conventional Commit сообщения.

---

## 6. Примеры: Как надо и как не надо

### ❌ Плохо:
```text
fixed bug
WIP
update
changes
feat: updated everything in project and fixed 10 bugs and styled button.
```

### ✅ Хорошо:
```text
fix(auth): prevent session expiration on token refresh
feat(ui): add member management modal to project detail view
docs(mcp): document server-sent events transport integration
perf(db): add index on kanban_tasks.project_id
chore(release): v1.1.0
```
