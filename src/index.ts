/**
 * @project-visor/core
 * Main entry point for the Project Visor Open-Source Core package
 */

export * from './db/schema';
export { db, client } from './db/index';
export { ensureDatabaseInitialized } from './db/init';

export {
  normalizeContainers,
  parseLegacyContainers,
  validateContainers,
  getPublicHttpPort,
  detectHostPortConflicts,
} from './lib/containers';
export * from './lib/opencode';
export * from './lib/notifications';
export * from './lib/rbac';
export * from './lib/auth';
export * from './lib/project-access';
export * from './lib/prometheus';
export * from './lib/utils';
export * from './lib/version';

// Components
export { default as Navigation } from './components/Navigation';
export { default as OnboardingWizard } from './components/OnboardingWizard';
export { default as CreateHostModal } from './components/CreateHostModal';
export { default as CreateProjectModal } from './components/CreateProjectModal';
export { default as CreateTaskModal } from './components/CreateTaskModal';
export { default as CreateRelationModal } from './components/CreateRelationModal';
export { default as CreateApiKeyModal } from './components/CreateApiKeyModal';
export { default as ContainerCards } from './components/ContainerCards';
export { default as AddonSpoiler } from './components/AddonSpoiler';

// Views
export { default as DashboardView } from './views/DashboardView';
export { default as ProjectsView } from './views/ProjectsView';
export { default as ProjectDetailView } from './views/ProjectDetailView';
export { default as InfrastructureView } from './views/InfrastructureView';
export { default as TasksView } from './views/TasksView';
export { default as GraphView } from './views/GraphView';
export { default as LoginView } from './views/LoginView';
export { default as ApiKeysView } from './views/ApiKeysView';
