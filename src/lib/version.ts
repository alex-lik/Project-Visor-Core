/**
 * Project Visor Core Version Information
 * Follows Semantic Versioning 2.0.0 (SemVer)
 */

export const APP_VERSION = '1.0.0';
export const APP_NAME = 'Project Visor Core';
export const RELEASE_NAME = 'Open-Source Core Initial Release';
export const REPOSITORY_URL = 'https://github.com/alex-lik/Project-Visor-Core';

export interface VersionInfo {
  version: string;
  name: string;
  releaseName: string;
  semver: {
    major: number;
    minor: number;
    patch: number;
  };
  environment: string;
}

export function getVersionInfo(): VersionInfo {
  const [major, minor, patch] = APP_VERSION.split('.').map(Number);
  return {
    version: `v${APP_VERSION}`,
    name: APP_NAME,
    releaseName: RELEASE_NAME,
    semver: { major, minor, patch },
    environment: process.env.NODE_ENV || 'production',
  };
}
