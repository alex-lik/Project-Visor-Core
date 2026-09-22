# Project Visor Core — REST API Reference

All API routes are served under `/api` and expect JSON payloads with `Content-Type: application/json`.
Authentication can be provided via session cookie or `Authorization: Bearer pv_live_<token>`.

---

## 1. Authentication & System

### `POST /api/auth/login`
Authenticate user credentials and establish a session cookie.
- **Request**:
  ```json
  {
    "username": "admin",
    "password": "your-password"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_admin",
      "username": "admin",
      "role": "admin"
    }
  }
  ```

### `GET /api/auth/me`
Retrieve currently authenticated user and session metadata.
- **Response** (200 OK):
  ```json
  {
    "authenticated": true,
    "user": {
      "id": "usr_admin",
      "username": "admin",
      "role": "admin"
    }
  }
  ```

### `POST /api/auth/logout`
Clears session cookie and logs out.

### `GET /api/version`
Returns the current Core version and environment.
- **Response** (200 OK):
  ```json
  {
    "name": "@project-visor/core",
    "version": "1.0.0",
    "status": "healthy"
  }
  ```

---

## 2. Infrastructure & Hosts

### `GET /api/hosts`
List all registered hosts and their deployed projects.

### `POST /api/hosts`
Register a new host.
- **Request**:
  ```json
  {
    "name": "worker-prod-01",
    "ipAddress": "192.168.1.100",
    "sshAlias": "srv1",
    "sshUser": "root",
    "sshPort": 22,
    "provider": "Hetnzer VPS",
    "osType": "Ubuntu 24.04",
    "specs": "4 vCPU / 8GB RAM",
    "opencodeEnabled": true,
    "opencodeHost": "http://192.168.1.100",
    "opencodePort": 4096,
    "opencodeUseHttps": false
  }
  ```

### `GET /api/hosts/{id}`
Retrieve a specific host by ID.

### `PATCH /api/hosts/{id}`
Update host specifications or OpenCode configuration.

### `DELETE /api/hosts/{id}?force=true`
Delete host. If projects are associated, `force=true` detaches them safely without deleting project data.

### `GET /api/hosts/{id}/opencode/health`
Check connectivity to OpenCode Server on the target host.

### `GET /api/hosts/{id}/opencode/models`
List available AI models configured on the remote OpenCode Server.

### `GET /api/hosts/{id}/opencode/sessions`
List active OpenCode sessions on the host.

---

## 3. Projects & Deployments

### `GET /api/projects`
List all projects. Filterable by category, status, priority.

### `POST /api/projects`
Create a new project with optional containers deployment spec.
- **Request**:
  ```json
  {
    "title": "API Gateway",
    "slug": "api-gateway",
    "category": "api",
    "status": "in_dev",
    "priority": "high",
    "hostId": "host_12345",
    "repoUrl": "https://github.com/my-org/gateway",
    "containers": [
      {
        "id": "c1",
        "name": "gateway",
        "type": "api",
        "containerName": "prod_gateway",
        "port": 8080,
        "portType": "http",
        "isPublic": true
      }
    ]
  }
  ```

### `GET /api/projects/{id}`
Get full project details, tasks, relations, metrics targets, and deployment containers.

### `PATCH /api/projects/{id}`
Update project details, status, or container specs.

### `DELETE /api/projects/{id}`
Delete project and cascade child relations, tasks, and deployment records.

### `GET /api/projects/{id}/members`
List collaborators granted access to the project.

### `POST /api/projects/{id}/members`
Grant project access to a user (`role: 'viewer' | 'editor'`).

### `DELETE /api/projects/{id}/members?userId={userId}`
Revoke user access to the project.

---

## 4. Kanban Tasks

### `GET /api/kanban/tasks?projectId={id}`
Retrieve tasks for a given project or across all accessible projects.

### `POST /api/kanban/tasks`
Create a Kanban task.
- **Request**:
  ```json
  {
    "projectId": "proj_123",
    "title": "Migrate database schema to v2",
    "description": "Add missing foreign keys and indexes",
    "column": "todo",
    "priority": "high"
  }
  ```

### `PATCH /api/kanban/tasks/{id}`
Update task details or shift columns (`backlog | todo | in_progress | review | done`).

### `DELETE /api/kanban/tasks/{id}`
Delete a task.

---

## 5. OpenCode Task Runs

### `GET /api/opencode/runs?projectId={id}`
List runs and execution diffs for a project.

### `POST /api/opencode/runs`
Submit a prompt to OpenCode Server for execution.
- **Request**:
  ```json
  {
    "projectId": "proj_123",
    "hostId": "host_456",
    "taskId": "task_789",
    "prompt": "Fix typo in Dockerfile and expose port 8080",
    "model": "claude-3-5-sonnet",
    "directory": "/home/docker/my-app"
  }
  ```

### `GET /api/opencode/runs/{id}`
Get run logs, Git diff, execution time, and status (`completed | failed`).

---

## 6. Architecture Relations

### `POST /api/relations`
Define a relationship edge between two projects.
- **Request**:
  ```json
  {
    "sourceId": "proj_frontend",
    "targetId": "proj_backend",
    "relationType": "api_calls",
    "label": "REST API /api/v1",
    "port": 8000
  }
  ```

### `DELETE /api/relations?id={id}`
Delete relationship edge.

---

## 7. Scoped API Keys

### `GET /api/api-keys`
List active API keys created by the current user.

### `POST /api/api-keys`
Issue a new scoped API token.
- **Request**:
  ```json
  {
    "name": "CI/CD Token",
    "roleScope": "scoped_projects",
    "allowedProjectIds": ["proj_frontend", "proj_backend"],
    "canWriteKanban": true,
    "canUpdateStatus": true,
    "canViewInfra": false
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "id": "key_123",
    "name": "CI/CD Token",
    "rawKey": "pv_live_38294a8d81728394...",
    "keyPrefix": "pv_live_3829"
  }
  ```
  *(Note: `rawKey` is only returned once upon creation and stored hashed with SHA-256).*
