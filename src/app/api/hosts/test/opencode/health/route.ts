import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/rbac';
import { checkOpenCodeHealth, normalizeOpenCodePortInput } from '@/lib/opencode';

/**
 * Явный endpoint для проверки связи из формы добавления/редактирования сервера.
 * (Ранее фронт дёргал /api/hosts/test/opencode/health, который резолвился
 * в [id]-роут с id='test' — теперь маршрут существует напрямую.)
 *
 * Принимает { opencodeHost, ipAddress, opencodePort (optional|null),
 * opencodeUsername, opencodePassword } и выполняет АВТО-обнаружение:
 * - порт указан → пробуем http+https на этом порту;
 * - порт пуст → пробуем https://host (443), http://host (80), затем legacy 4096.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await checkOpenCodeHealth({
      opencodeHost: body.opencodeHost ?? null,
      ipAddress: body.ipAddress ?? null,
      opencodePort: normalizeOpenCodePortInput(body.opencodePort),
      opencodeUsername: body.opencodeUsername ?? null,
      opencodePassword: body.opencodePassword ?? null,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ healthy: false, error: err.message }, { status: 400 });
  }
}
