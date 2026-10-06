import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customRelationTypes, projectRelations } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import {
  BUILTIN_RELATION_TYPE_KEYS,
  getCustomRelationTypes,
  getRelationTypesOwner,
} from '@/lib/relation-types';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = '#94a3b8';

function normalizeColor(color: unknown): string | null {
  if (color === undefined || color === null || color === '') return DEFAULT_COLOR;
  if (typeof color !== 'string' || !HEX_COLOR_RE.test(color.trim())) return null;
  return color.trim();
}

/**
 * GET /api/relations/types
 * Пользовательские типы связей текущего пользователя (встроенные — на клиенте).
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const owner = getRelationTypesOwner(auth);
  const types = await getCustomRelationTypes(owner);
  return NextResponse.json({ types });
}

/**
 * POST /api/relations/types
 * Создать свой тип связи: { label, color? }.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const owner = getRelationTypesOwner(auth);
  if (!owner) {
    return NextResponse.json({ error: 'Типы связей доступны только пользователям и API-ключам' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label || label.length > 60) {
      return NextResponse.json({ error: 'Название типа обязательно (до 60 символов)' }, { status: 400 });
    }
    const color = normalizeColor(body.color);
    if (!color) {
      return NextResponse.json({ error: 'Цвет должен быть HEX вида #RRGGBB' }, { status: 400 });
    }

    // Уникальный ключ в пределах владельца
    let key = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `custom_${nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
      if (BUILTIN_RELATION_TYPE_KEYS.includes(candidate)) continue;
      const [exists] = await db
        .select({ id: customRelationTypes.id })
        .from(customRelationTypes)
        .where(and(eq(customRelationTypes.userId, owner), eq(customRelationTypes.key, candidate)))
        .limit(1);
      if (!exists) {
        key = candidate;
        break;
      }
    }
    if (!key) {
      return NextResponse.json({ error: 'Не удалось сгенерировать ключ типа' }, { status: 500 });
    }

    const id = `crt_${nanoid(10)}`;
    await db.insert(customRelationTypes).values({
      id,
      userId: owner,
      key,
      label,
      color,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, type: { id, key, label, color } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания типа связи' }, { status: 500 });
  }
}

/**
 * PATCH /api/relations/types
 * Переименовать/перекрасить свой тип: { id, label?, color? }.
 */
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const owner = getRelationTypesOwner(auth);
  if (!owner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, label, color } = body;
    if (!id) {
      return NextResponse.json({ error: 'ID типа обязателен' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(customRelationTypes)
      .where(and(eq(customRelationTypes.id, id), eq(customRelationTypes.userId, owner)))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Тип связи не найден' }, { status: 404 });
    }

    const patch: Partial<{ label: string; color: string }> = {};
    if (label !== undefined) {
      const nextLabel = typeof label === 'string' ? label.trim() : '';
      if (!nextLabel || nextLabel.length > 60) {
        return NextResponse.json({ error: 'Название типа обязательно (до 60 символов)' }, { status: 400 });
      }
      patch.label = nextLabel;
    }
    if (color !== undefined) {
      const nextColor = normalizeColor(color);
      if (!nextColor) {
        return NextResponse.json({ error: 'Цвет должен быть HEX вида #RRGGBB' }, { status: 400 });
      }
      patch.color = nextColor;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Нечего обновлять' }, { status: 400 });
    }

    await db.update(customRelationTypes).set(patch).where(eq(customRelationTypes.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления типа связи' }, { status: 500 });
  }
}

/**
 * DELETE /api/relations/types?id={id}
 * Удалить свой тип. Если тип используется в связях — 409 с usageCount.
 */
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const owner = getRelationTypesOwner(auth);
  if (!owner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID типа обязателен' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(customRelationTypes)
    .where(and(eq(customRelationTypes.id, id), eq(customRelationTypes.userId, owner)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Тип связи не найден' }, { status: 404 });
  }

  const used = await db
    .select({ id: projectRelations.id })
    .from(projectRelations)
    .where(eq(projectRelations.relationType, existing.key));
  if (used.length > 0) {
    return NextResponse.json(
      { error: `Тип используется в ${used.length} связях — сначала измените их тип`, usageCount: used.length },
      { status: 409 }
    );
  }

  await db.delete(customRelationTypes).where(eq(customRelationTypes.id, id));
  return NextResponse.json({ success: true });
}
