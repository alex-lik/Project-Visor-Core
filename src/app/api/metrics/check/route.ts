import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { metricTargets, activityLogs } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { pingHttpEndpoint, queryPrometheus } from '@/lib/prometheus';
import { dispatchNotification } from '@/lib/notifications';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { targetId } = await req.json();
    if (!targetId) {
      return NextResponse.json({ error: 'targetId обязателен' }, { status: 400 });
    }

    const [target] = await db.select().from(metricTargets).where(eq(metricTargets.id, targetId)).limit(1);
    if (!target) {
      return NextResponse.json({ error: 'Цель не найдена' }, { status: 404 });
    }

    let resultStatus: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    let responseTimeMs = 0;
    let value = '';

    if (target.checkType === 'http_ping') {
      const res = await pingHttpEndpoint(target.target);
      resultStatus = res.status;
      responseTimeMs = res.responseTimeMs || 0;
      value = res.value || (res.error ? `Error: ${res.error}` : 'OK');
    } else if (target.checkType === 'prometheus_query') {
      const promUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
      const res = await queryPrometheus(promUrl, target.target);
      if (res.success && res.data?.result) {
        resultStatus = 'healthy';
        const val = res.data.result[0]?.value?.[1];
        value = val !== undefined ? String(val) : 'OK';
        responseTimeMs = 25;
      } else {
        resultStatus = 'warning';
        value = res.error || 'No data';
      }
    }

    // Update target
    await db
      .update(metricTargets)
      .set({
        lastStatus: resultStatus,
        lastResponseTimeMs: responseTimeMs,
        lastValue: value,
        lastCheckedAt: Date.now(),
      })
      .where(eq(metricTargets.id, target.id));

    // If status transitioned to critical, record alert in activity log
    if (resultStatus === 'critical' && target.lastStatus !== 'critical') {
      await db.insert(activityLogs).values({
        id: `act_${nanoid(10)}`,
        actorType: 'system',
        actorName: 'Health Monitor',
        action: 'health_alert',
        projectId: target.projectId,
        details: `Внимание: Сервис "${target.name}" недоступен (${value})`,
        createdAt: Date.now(),
      });

      dispatchNotification({
        event: 'infra_alert',
        title: `🚨 Сервис недоступен: "${target.name}"`,
        message: `Мониторинг зафиксировал критический сбой: ${value}.`,
        projectId: target.projectId || undefined,
        data: {
          targetName: target.name,
          checkType: target.checkType,
          value,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      status: resultStatus,
      responseTimeMs,
      value,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка проверки цели' }, { status: 500 });
  }
}
