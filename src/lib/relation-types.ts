import { db } from '@/db';
import { customRelationTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { AuthContext } from './rbac';

/** Встроенные типы связей (ключи RELATION_LABELS из lib/utils). */
export const BUILTIN_RELATION_TYPE_KEYS = [
  'depends_on',
  'api_calls',
  'database_shared',
  'webhook_events',
  'auth_provider',
  'submodule',
  'promotes_to_staging',
  'promotes_to_production',
  'env_pair',
];

export interface CustomRelationType {
  id: string;
  key: string;
  label: string;
  color: string;
}

/**
 * Владелец пользовательских типов: пользователь сессии либо API-ключ.
 * null — анонимный вызов без привязки (только встроенные типы).
 */
export function getRelationTypesOwner(auth: AuthContext): string | null {
  if (auth.userId) return auth.userId;
  if (auth.apiKeyId) return `apikey:${auth.apiKeyId}`;
  return null;
}

/** Все доступные владельцу ключи типов: встроенные + его собственные. */
export async function getAllowedRelationTypeKeys(owner: string | null): Promise<Set<string>> {
  const allowed = new Set<string>(BUILTIN_RELATION_TYPE_KEYS);
  if (!owner) return allowed;
  try {
    const customs = await db
      .select({ key: customRelationTypes.key })
      .from(customRelationTypes)
      .where(eq(customRelationTypes.userId, owner));
    for (const c of customs) allowed.add(c.key);
  } catch {
    // Таблица может отсутствовать на старых БД до рестарта — только встроенные
  }
  return allowed;
}

/** Пользовательские типы владельца (для мержа подписей на клиенте). */
export async function getCustomRelationTypes(owner: string | null): Promise<CustomRelationType[]> {
  if (!owner) return [];
  try {
    const rows = await db
      .select()
      .from(customRelationTypes)
      .where(eq(customRelationTypes.userId, owner));
    return rows.map((r) => ({ id: r.id, key: r.key, label: r.label, color: r.color }));
  } catch {
    return [];
  }
}
