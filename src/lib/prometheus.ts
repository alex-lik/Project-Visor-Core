export interface MetricResult {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTimeMs?: number;
  value?: string;
  error?: string;
}

export async function pingHttpEndpoint(url: string, timeoutMs: number = 5000): Promise<MetricResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'User-Agent': 'Project-Visor-HealthCheck/1.0',
      },
    });
    clearTimeout(timer);

    const responseTimeMs = Date.now() - start;

    if (res.ok) {
      return {
        status: responseTimeMs > 2000 ? 'warning' : 'healthy',
        responseTimeMs,
        value: `HTTP ${res.status}`,
      };
    } else {
      return {
        status: res.status >= 500 ? 'critical' : 'warning',
        responseTimeMs,
        value: `HTTP ${res.status} ${res.statusText}`,
      };
    }
  } catch (err: any) {
    return {
      status: 'critical',
      responseTimeMs: Date.now() - start,
      error: err.message || 'Connection failed',
      value: 'Unreachable',
    };
  }
}

export async function queryPrometheus(
  prometheusBaseUrl: string,
  query: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const baseUrl = prometheusBaseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, error: `Prometheus returned HTTP ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to query Prometheus' };
  }
}
