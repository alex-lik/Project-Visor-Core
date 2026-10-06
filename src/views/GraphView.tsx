'use client';

/**
 * GraphView — интерактивная карта архитектуры (Obsidian-style).
 *
 * Раскладка:
 * - Режим «Серверы»: двухуровневый group-aware force-directed layout.
 *   Серверы — это «суперузлы»: отталкиваются друг от друга по радиусам
 *   контейнеров, а рёбра между серверами работают как пружины и стягивают
 *   связанные хосты рядом. Внутри сервера проекты лежат компактной сеткой.
 *   Поэтому связи короткие и почти не пересекают чужие контейнеры.
 * - Режим без серверов: круговая раскладка.
 * - Позиции узлов сохраняются в localStorage: перетаскивание мышью
 *   переживает перезагрузку. Кнопка «Автораскладка» пересчитывает всё
 *   заново; добавление новых проектов аккуратно подселяет новичков,
 *   не трогая ручную раскладку.
 *
 * Рёбра:
 * - Кривые Безье от границы карточки до границы карточки (стрелки не
 *   прячутся под узлами).
 * - Эвристический обход препятствий: контрольная точка кривой
 *   итеративно выталкивается, пока середина ребра не выйдет из чужих
 *   контейнеров/карточек.
 * - Параллельные рёбра между одной парой разводятся веером.
 * - Подписи — в «пилюлях» с solid-подложкой: читаются поверх всего.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Network,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  LayoutGrid,
  Server,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import CreateRelationModal from '@/components/CreateRelationModal';
import {
  STATUS_COLORS,
  fetchCustomRelationTypes,
  mergeRelationLabels,
  type CustomRelationTypeOption,
} from '@/lib/utils';

interface Node {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  priority: string;
  hostName?: string | null;
  hostId?: string | null;
  x?: number;
  y?: number;
}

interface Host {
  id: string;
  name: string;
  ipAddress?: string | null;
  provider?: string | null;
  status?: string;
}

/** Прямоугольник-контейнер сервера: проекты группы рисуются внутри. */
interface ServerContainer {
  key: string;
  hostId: string | null;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dashed: boolean;
}

const SHOW_HOSTS_STORAGE_KEY = 'visor_graph_show_hosts';
const POS_STORAGE_KEY = 'visor_graph_positions_v2';
const LEGEND_STORAGE_KEY = 'visor_graph_legend';
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

interface Edge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  label: string;
  color: string;
  description?: string;
}

const MIN_CANVAS_W = 960;
const MIN_CANVAS_H = 640;

/** Геометрия карточки узла (должна совпадать с рендером ниже). */
const CARD_W = 184;
const CARD_H = 56;
const NODE_HW = CARD_W / 2;
const NODE_HH = CARD_H / 2;

/** Геометрия сетки внутри контейнера сервера. */
const GRID_GAP_X = 28;
const GRID_GAP_Y = 26;
const GRID_PAD_X = 36;
const GRID_HEADER_H = 66;
const GRID_PAD_B = 30;

function getStatusDotColor(status: string) {
  switch (status) {
    case 'production':
    case 'active':
      return '#34d399';
    case 'staging':
      return '#60a5fa';
    case 'in_dev':
      return '#fbbf24';
    case 'paused':
      return '#fb923c';
    case 'archived':
      return '#94a3b8';
    case 'idea':
    default:
      return '#c084fc';
  }
}

/* ------------------------------------------------------------------ */
/* Детерминированный PRNG (стабильная раскладка между перезагрузками)  */
/* ------------------------------------------------------------------ */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Хранилище позиций (ручная раскладка как в Obsidian)                 */
/* ------------------------------------------------------------------ */

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, { x: number; y: number }> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof (v as any).x === 'number' && typeof (v as any).y === 'number') {
        const x = (v as any).x;
        const y = (v as any).y;
        if (Number.isFinite(x) && Number.isFinite(y)) out[k] = { x, y };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persistPositions(nodes: Node[]) {
  try {
    const obj: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      if (typeof n.x === 'number' && typeof n.y === 'number') {
        obj[n.id] = { x: Math.round(n.x), y: Math.round(n.y) };
      }
    }
    window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore quota errors */
  }
}

/* ------------------------------------------------------------------ */
/* Раскладки                                                           */
/* ------------------------------------------------------------------ */

function groupKeyOf(n: Pick<Node, 'hostId'>, hostIds: Set<string>): string {
  return n.hostId && hostIds.has(n.hostId) ? n.hostId : 'none';
}

interface GroupInfo {
  key: string;
  members: Node[];
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
}

function buildGroups(projectNodes: Node[], hostsList: Host[]): { groups: GroupInfo[]; hostIds: Set<string> } {
  const hostIds = new Set(hostsList.map((h) => h.id));
  const byKey = new Map<string, Node[]>();
  for (const n of projectNodes) {
    const key = groupKeyOf(n, hostIds);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(n);
  }
  const orderedKeys = [
    ...hostsList.map((h) => h.id).filter((id) => byKey.has(id)),
    ...(byKey.has('none') ? ['none'] : []),
  ];
  const groups: GroupInfo[] = orderedKeys.map((key) => {
    const members = [...byKey.get(key)!].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const rows = Math.ceil(members.length / cols);
    const innerW = cols * CARD_W + (cols - 1) * GRID_GAP_X;
    const innerH = rows * CARD_H + (rows - 1) * GRID_GAP_Y;
    const w = Math.max(300, innerW + GRID_PAD_X * 2);
    const h = GRID_HEADER_H + innerH + GRID_PAD_B;
    return { key, members, w, h, cx: 0, cy: 0, r: Math.hypot(w, h) / 2 };
  });
  return { groups, hostIds };
}

/**
 * Полная автораскладка: force-directed на уровне групп-серверов.
 * Связанные хосты стягиваются пружинами, все отталкиваются радиусами —
 * контейнеры не налезают друг на друга, а рёбра остаются короткими.
 */
function autoLayoutGroups(
  projectNodes: Node[],
  hostsList: Host[],
  edgeList: Edge[]
): { nodes: Node[]; width: number; height: number } {
  if (projectNodes.length === 0) return { nodes: [], width: MIN_CANVAS_W, height: MIN_CANVAS_H };
  const { groups } = buildGroups(projectNodes, hostsList);
  if (groups.length === 1 && groups[0].members.length === 1) {
    const only = groups[0].members[0];
    const nodes = [{ ...only, x: 480, y: 320 }];
    return { nodes, width: MIN_CANVAS_W, height: MIN_CANVAS_H };
  }

  const nodeById = new Map(projectNodes.map((n) => [n.id, n]));
  const groupOfNode = new Map<string, string>();
  for (const g of groups) for (const m of g.members) groupOfNode.set(m.id, g.key);

  // Сила пружин между группами (число рёбер между ними)
  const linkStrength = new Map<string, number>();
  for (const e of edgeList) {
    const a = nodeById.get(e.source);
    const b = nodeById.get(e.target);
    if (!a || !b) continue;
    const ga = groupOfNode.get(a.id)!;
    const gb = groupOfNode.get(b.id)!;
    if (ga === gb) continue;
    const k = ga < gb ? `${ga}|${gb}` : `${gb}|${ga}`;
    linkStrength.set(k, (linkStrength.get(k) || 0) + 1);
  }
  const links = [...linkStrength.entries()].map(([k, count]) => {
    const [a, b] = k.split('|');
    return { a, b, count };
  });
  const byKey = new Map(groups.map((g) => [g.key, g]));

  // Детерминированный старт по кругу
  const rand = mulberry32(20260930);
  const sumD = groups.reduce((s, g) => s + g.r * 2, 0);
  const R0 = Math.max(480, (sumD + groups.length * 220) / (2 * Math.PI));
  groups.forEach((g, i) => {
    const ang = (i / groups.length) * 2 * Math.PI - Math.PI / 2;
    g.cx = Math.cos(ang) * R0 + (rand() - 0.5) * 8;
    g.cy = Math.sin(ang) * R0 * 0.72 + (rand() - 0.5) * 8;
  });

  const ITER = 300;
  for (let it = 0; it < ITER; it++) {
    const t = 1 - (it / ITER) * 0.97; // охлаждение
    // Отталкивание групп (жёсткое при налезании, слабое на дистанции)
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const A = groups[i];
        const B = groups[j];
        let dx = B.cx - A.cx;
        let dy = B.cy - A.cy;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          d = Math.hypot(dx, dy) || 1;
        }
        const minD = A.r + B.r + 110;
        let f = 0;
        if (d < minD) f = (minD - d) * 0.55;
        else if (d < minD * 2.2) f = -((minD * 2.2 - d) * 0.012);
        if (f !== 0) {
          f = Math.max(-50, Math.min(120, f)) * t;
          const ux = dx / d;
          const uy = dy / d;
          A.cx -= (ux * f) / 2;
          A.cy -= (uy * f) / 2;
          B.cx += (ux * f) / 2;
          B.cy += (uy * f) / 2;
        }
      }
    }
    // Пружины по рёбрам между группами
    for (const l of links) {
      const A = byKey.get(l.a)!;
      const B = byKey.get(l.b)!;
      const dx = B.cx - A.cx;
      const dy = B.cy - A.cy;
      const d = Math.hypot(dx, dy) || 1;
      const desired = A.r + B.r + 170;
      let f = ((d - desired) * 0.028 * Math.min(l.count, 4)) * t;
      f = Math.max(-60, Math.min(60, f));
      const ux = dx / d;
      const uy = dy / d;
      A.cx += (ux * f) / 2;
      A.cy += (uy * f) / 2;
      B.cx -= (ux * f) / 2;
      B.cy -= (uy * f) / 2;
    }
    // Слабая гравитация к центру, чтобы граф не улетал
    for (const g of groups) {
      g.cx -= g.cx * 0.012 * t;
      g.cy -= g.cy * 0.012 * t;
    }
  }

  // Проекты — сеткой внутри своего контейнера
  const positioned: Node[] = [];
  for (const g of groups) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(g.members.length)));
    const innerW = cols * CARD_W + (cols - 1) * GRID_GAP_X;
    const startX = g.cx - innerW / 2 + CARD_W / 2;
    const startY = g.cy - g.h / 2 + GRID_HEADER_H + CARD_H / 2 - 6;
    g.members.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positioned.push({
        ...m,
        x: Math.round(startX + col * (CARD_W + GRID_GAP_X)),
        y: Math.round(startY + row * (CARD_H + GRID_GAP_Y)),
      });
    });
  }
  const box = bboxOf(positioned, true);
  return {
    nodes: positioned,
    width: Math.max(MIN_CANVAS_W, Math.ceil(box.w + 240)),
    height: Math.max(MIN_CANVAS_H, Math.ceil(box.h + 220)),
  };
}

function bboxOf(nodes: Node[], includeCards: boolean) {
  if (nodes.length === 0) return { x0: 0, y0: 0, x1: MIN_CANVAS_W, y1: MIN_CANVAS_H, w: MIN_CANVAS_W, h: MIN_CANVAS_H };
  const padX = includeCards ? NODE_HW + 60 : 60;
  const padY = includeCards ? NODE_HH + 90 : 90;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    const x = n.x ?? 480;
    const y = n.y ?? 320;
    x0 = Math.min(x0, x - padX);
    y0 = Math.min(y0, y - padY);
    x1 = Math.max(x1, x + padX);
    y1 = Math.max(y1, y + padY);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Подселение новичков: неизвестные узлы устраиваются рядом со своей
 * группой, закреплённые (ручная раскладка) не двигаются.
 */
function settleNewNodes(
  allNodes: Node[],
  pinned: Record<string, { x: number; y: number }>,
  hostsList: Host[],
  edgeList: Edge[]
): Node[] {
  const hostIds = new Set(hostsList.map((h) => h.id));
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const pinnedIds = new Set(Object.keys(pinned).filter((id) => nodeById.has(id)));
  const newcomers = allNodes.filter((n) => !pinnedIds.has(n.id));

  // Центроиды групп по закреплённым соседям
  const groupCentroids = new Map<string, { x: number; y: number; n: number }>();
  for (const id of pinnedIds) {
    const n = nodeById.get(id)!;
    const key = groupKeyOf(n, hostIds);
    const c = groupCentroids.get(key) || { x: 0, y: 0, n: 0 };
    c.x += pinned[id].x;
    c.y += pinned[id].y;
    c.n += 1;
    groupCentroids.set(key, c);
  }
  const rand = mulberry32(777);
  const pos = new Map<string, { x: number; y: number }>();
  for (const id of pinnedIds) pos.set(id, { ...pinned[id] });
  newcomers.forEach((n, i) => {
    const key = groupKeyOf(n, hostIds);
    const c = groupCentroids.get(key);
    if (c && c.n > 0) {
      const ang = ((i / Math.max(1, newcomers.length)) * 2 * Math.PI + rand() * 0.6) % (2 * Math.PI);
      pos.set(n.id, {
        x: c.x / c.n + Math.cos(ang) * (160 + rand() * 80),
        y: c.y / c.n + Math.sin(ang) * (120 + rand() * 60),
      });
    } else {
      pos.set(n.id, { x: 480 + (rand() - 0.5) * 200, y: 320 + (rand() - 0.5) * 160 });
    }
  });

  const adj = new Map<string, string[]>();
  for (const e of edgeList) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }

  // Лёгкая релаксация: двигаются только новички
  for (let it = 0; it < 90; it++) {
    const t = 1 - (it / 90) * 0.9;
    for (const n of newcomers) {
      const p = pos.get(n.id)!;
      let fx = 0;
      let fy = 0;
      for (const [oid, op] of pos) {
        if (oid === n.id) continue;
        const dx = p.x - op.x;
        const dy = p.y - op.y;
        const d = Math.hypot(dx, dy) || 1;
        const minD = 250;
        if (d < minD) {
          const f = ((minD - d) * 0.45 * t) / d;
          fx += dx * f;
          fy += dy * f;
        }
      }
      for (const oid of adj.get(n.id) || []) {
        const op = pos.get(oid);
        if (!op) continue;
        const dx = op.x - p.x;
        const dy = op.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = Math.max(-40, Math.min(40, (d - 280) * 0.05 * t)) / d;
        fx += dx * f;
        fy += dy * f;
      }
      fx += (480 - p.x) * 0.004 * t;
      fy += (320 - p.y) * 0.004 * t;
      p.x += Math.max(-60, Math.min(60, fx));
      p.y += Math.max(-60, Math.min(60, fy));
    }
  }

  return allNodes.map((n) => ({ ...n, ...(pos.get(n.id) || { x: 480, y: 320 }) }));
}

function circleLayout(rawNodes: Node[]): Node[] {
  const count = rawNodes.length;
  if (count === 0) return [];
  if (count === 1) return [{ ...rawNodes[0], x: 480, y: 320 }];
  const centerX = 480;
  const centerY = 320;
  const radius = Math.min(240, Math.max(150, count * 45));
  return rawNodes.map((node, idx) => {
    const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
    return {
      ...node,
      x: Math.round(centerX + radius * Math.cos(angle)),
      y: Math.round(centerY + radius * Math.sin(angle)),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Геометрия рёбер: от границы до границы + обход препятствий          */
/* ------------------------------------------------------------------ */

interface Obstacle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function borderPoint(cx: number, cy: number, dx: number, dy: number): { x: number; y: number } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const t = Math.min(ax < 1e-9 ? Infinity : NODE_HW / ax, ay < 1e-9 ? Infinity : NODE_HH / ay);
  const s = Number.isFinite(t) ? t : 0;
  return { x: cx + dx * s, y: cy + dy * s };
}

function pointInObstacle(x: number, y: number, o: Obstacle): boolean {
  return x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1;
}

/** Ближайшая точка снаружи прямоугольника + небольшой запас. */
function pushOut(x: number, y: number, o: Obstacle, margin: number): { x: number; y: number } {
  const dl = x - (o.x0 - margin);
  const dr = o.x1 + margin - x;
  const dt = y - (o.y0 - margin);
  const db = o.y1 + margin - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: o.x0 - margin, y };
  if (m === dr) return { x: o.x1 + margin, y };
  if (m === dt) return { x, y: o.y0 - margin };
  return { x, y: o.y1 + margin };
}

interface EdgeGeom {
  d: string;
  lx: number;
  ly: number;
  loop: boolean;
}

function computeEdgeGeom(
  src: Node,
  tgt: Node,
  pairIdx: number,
  pairTotal: number,
  obstacles: Obstacle[],
  edgeId: string
): EdgeGeom {
  const sx = src.x ?? 480;
  const sy = src.y ?? 320;
  const tx = tgt.x ?? 480;
  const ty = tgt.y ?? 320;

  // Петля на себя — аккуратное кольцо над карточкой
  if (src.id === tgt.id) {
    const d = `M ${sx - 26} ${sy - NODE_HH} C ${sx - 26} ${sy - 92}, ${sx + 26} ${sy - 92}, ${sx + 26} ${sy - NODE_HH}`;
    return { d, lx: sx, ly: sy - 98, loop: true };
  }

  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const p0 = borderPoint(sx, sy, dx, dy);
  let p3 = borderPoint(tx, ty, -dx, -dy);
  // Чуть укорачиваем конец, чтобы наконечник стрелки не тонул в карточке
  p3 = { x: p3.x - (dx / len) * 4, y: p3.y - (dy / len) * 4 };

  const nx = -dy / len;
  const ny = dx / len;
  // Базовый изгиб + веер для параллельных рёбер одной пары
  const side = hashStr(edgeId) % 2 === 0 ? 1 : -1;
  const bow = Math.max(24, Math.min(120, len * 0.16)) * side;
  const offIdx = pairIdx - (pairTotal - 1) / 2;
  const fan = pairTotal > 1 ? offIdx * 52 : 0;
  const mid = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
  const C = { x: mid.x + nx * (bow + fan), y: mid.y + ny * (bow + fan) };

  // Обход препятствий: выталкиваем середину кривой из чужих боксов
  for (let it = 0; it < 12; it++) {
    const mx = (p0.x + 2 * C.x + p3.x) / 4;
    const my = (p0.y + 2 * C.y + p3.y) / 4;
    const hit = obstacles.find((o) => pointInObstacle(mx, my, o));
    if (!hit) break;
    const out = pushOut(mx, my, hit, 18);
    C.x += (out.x - mx) * 2;
    C.y += (out.y - my) * 2;
    // Лёгкий перпендикулярный дрейф против зацикливания
    C.x += nx * 3;
    C.y += ny * 3;
  }

  const lx = (p0.x + 2 * C.x + p3.x) / 4;
  const ly = (p0.y + 2 * C.y + p3.y) / 4;
  return { d: `M ${p0.x} ${p0.y} Q ${C.x} ${C.y} ${p3.x} ${p3.y}`, lx, ly, loop: false };
}

function HostDrawerPanel({
  host,
  fallbackTitle,
  projects,
}: {
  host?: Host;
  fallbackTitle: string;
  projects: Node[];
}) {
  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="text-[10px] font-mono uppercase text-sky-400 flex items-center gap-1">
          <Server className="w-3 h-3" /> Сервер
        </div>
        <div className="text-base font-bold text-white mt-0.5">{host?.name || fallbackTitle}</div>
        {host?.ipAddress && <div className="text-slate-400 font-mono mt-0.5">{host.ipAddress}</div>}
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Провайдер</div>
          <div className="font-semibold text-white mt-0.5">{host?.provider || '—'}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <div className="text-slate-400 text-[10px]">Статус</div>
          <div className="font-semibold text-emerald-400 mt-0.5">{host?.status || 'unknown'}</div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
          Проекты на сервере ({projects.length})
        </div>
        {projects.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-2">Нет видимых проектов</div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span className="truncate">{p.title}</span>
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  className="text-slate-500 hover:text-cyan-400 p-1 shrink-0"
                  title="Открыть проект"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArchitectureGraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<Edge | null>(null);
  const [showHosts, setShowHosts] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SHOW_HOSTS_STORAGE_KEY) === '1';
  });
  const [legendOpen, setLegendOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(LEGEND_STORAGE_KEY) !== '0';
  });
  const [customTypes, setCustomTypes] = useState<CustomRelationTypeOption[]>([]);
  const relationLabels = useMemo(() => mergeRelationLabels(customTypes), [customTypes]);
  // Подписи/цвета рёбер с учётом пользовательских типов (API знает только встроенные)
  const displayEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        const meta = relationLabels[e.relationType];
        if (!meta) return e;
        return { ...e, label: meta.label, color: meta.color };
      }),
    [edges, relationLabels]
  );
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [canvasW, setCanvasW] = useState(MIN_CANVAS_W);
  const [canvasH, setCanvasH] = useState(MIN_CANVAS_H);

  // Сырые узлы из API — нужны для перераскладок без повторной загрузки
  const rawNodesRef = useRef<Node[]>([]);
  const hostsRef = useRef<Host[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  edgesRef.current = edges;

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan & zoom state (x/y — сдвиг в единицах viewBox, k — масштаб)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  const updateView = useCallback((v: { x: number; y: number; k: number }) => {
    viewRef.current = v;
    setView(v);
  }, []);
  const [panning, setPanning] = useState(false);
  const panLast = useRef({ x: 0, y: 0 });
  // Клик, завершающий drag/pan, не должен сбрасывать выделение
  const suppressClick = useRef(false);

  /** Полная автораскладка текущего режима + сохранение позиций. */
  const runAutoLayout = useCallback(
    (projectNodes: Node[], hostsList: Host[], edgeList: Edge[], withHosts: boolean) => {
      if (projectNodes.length === 0) {
        setNodes([]);
        setCanvasW(MIN_CANVAS_W);
        setCanvasH(MIN_CANVAS_H);
        return;
      }
      if (withHosts) {
        const { nodes: positioned, width, height } = autoLayoutGroups(projectNodes, hostsList, edgeList);
        setNodes(positioned);
        setCanvasW(width);
        setCanvasH(height);
        persistPositions(positioned);
      } else {
        const positioned = circleLayout(projectNodes);
        setNodes(positioned);
        setCanvasW(MIN_CANVAS_W);
        setCanvasH(MIN_CANVAS_H);
        persistPositions(positioned);
      }
    },
    []
  );

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/relations');
      if (!res.ok) {
        throw new Error(`Ошибка загрузки данных (${res.status})`);
      }
      const data = await res.json();
      const loadedHosts: Host[] = Array.isArray(data.hosts) ? data.hosts : [];
      const loadedEdges: Edge[] = Array.isArray(data.edges) ? data.edges : [];
      const loadedNodes: Node[] = Array.isArray(data.nodes) ? data.nodes : [];
      setHosts(loadedHosts);
      hostsRef.current = loadedHosts;
      setEdges(loadedEdges);
      rawNodesRef.current = loadedNodes;

      // Восстанавливаем ручную раскладку; новичков подселяем аккуратно
      const saved = loadSavedPositions();
      const allKnown = loadedNodes.length > 0 && loadedNodes.every((n) => saved[n.id]);
      const someKnown = loadedNodes.some((n) => saved[n.id]);
      const useHosts =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(SHOW_HOSTS_STORAGE_KEY) === '1'
          : showHosts;
      if (allKnown) {
        const positioned = loadedNodes.map((n) => ({ ...n, ...saved[n.id] }));
        setNodes(positioned);
        const box = bboxOf(positioned, true);
        setCanvasW(Math.max(MIN_CANVAS_W, Math.ceil(box.w + 240)));
        setCanvasH(Math.max(MIN_CANVAS_H, Math.ceil(box.h + 220)));
      } else if (someKnown && useHosts) {
        const positioned = settleNewNodes(loadedNodes, saved, loadedHosts, loadedEdges);
        setNodes(positioned);
        const box = bboxOf(positioned, true);
        setCanvasW(Math.max(MIN_CANVAS_W, Math.ceil(box.w + 240)));
        setCanvasH(Math.max(MIN_CANVAS_H, Math.ceil(box.h + 220)));
        persistPositions(positioned);
      } else {
        runAutoLayout(loadedNodes, loadedHosts, loadedEdges, useHosts);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Не удалось загрузить данные графа');
    } finally {
      setLoading(false);
    }
  };

  // Контейнеры серверов из текущих позиций узлов: следуют за перетаскиванием
  const containers = useMemo<ServerContainer[]>(() => {
    if (!showHosts) return [];
    const hostIds = new Set(hosts.map((h) => h.id));
    const groups = new Map<string, Node[]>();
    for (const n of nodes) {
      const key = groupKeyOf(n, hostIds);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(n);
    }
    const PAD = 30;
    const HEADER = 48;
    const list: ServerContainer[] = [];
    for (const [key, members] of groups) {
      if (members.length === 0) continue;
      const xs = members.map((m) => m.x ?? 480);
      const ys = members.map((m) => m.y ?? 320);
      const minX = Math.min(...xs) - NODE_HW;
      const maxX = Math.max(...xs) + NODE_HW;
      const minY = Math.min(...ys) - NODE_HH;
      const maxY = Math.max(...ys) + NODE_HH;
      const host = key === 'none' ? undefined : hosts.find((h) => h.id === key);
      list.push({
        key,
        hostId: key === 'none' ? null : key,
        title: host ? host.name : 'Без сервера',
        subtitle:
          host && host.ipAddress
            ? `${host.ipAddress} • проектов: ${members.length}`
            : `проектов: ${members.length}`,
        x: minX - PAD,
        y: minY - PAD - HEADER,
        w: Math.max(260, maxX - minX + PAD * 2),
        h: maxY - minY + PAD * 2 + HEADER,
        dashed: key === 'none',
      });
    }
    return list;
  }, [nodes, hosts, showHosts]);

  // Пары параллельных рёбер (для веера) — стабильный порядок по id
  const edgePairs = useMemo(() => {
    const byPair = new Map<string, Edge[]>();
    for (const e of displayEdges) {
      const k = [e.source, e.target].sort().join('|');
      if (!byPair.has(k)) byPair.set(k, []);
      byPair.get(k)!.push(e);
    }
    const idx = new Map<string, { idx: number; total: number }>();
    for (const list of byPair.values()) {
      const sorted = [...list].sort((a, b) => (a.id < b.id ? -1 : 1));
      sorted.forEach((e, i) => idx.set(e.id, { idx: i, total: sorted.length }));
    }
    return idx;
  }, [displayEdges]);

  // Геометрия всех рёбер (препятствия — чужие контейнеры/карточки — учитываются внутри)
  const edgeGeoms = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const hostIds = new Set(hosts.map((h) => h.id));
    const out = new Map<string, EdgeGeom>();
    for (const e of displayEdges) {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) continue;
      const pair = edgePairs.get(e.id) || { idx: 0, total: 1 };
      let obs: Obstacle[];
      if (showHosts) {
        const gs = groupKeyOf(src, hostIds);
        const gt = groupKeyOf(tgt, hostIds);
        obs = containers
          .filter((c) => c.key !== gs && c.key !== gt)
          .map((c) => ({ x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h }));
      } else {
        obs = nodes
          .filter((n) => n.id !== src.id && n.id !== tgt.id)
          .map((n) => ({
            x0: (n.x ?? 480) - NODE_HW - 12,
            y0: (n.y ?? 320) - NODE_HH - 12,
            x1: (n.x ?? 480) + NODE_HW + 12,
            y1: (n.y ?? 320) + NODE_HH + 12,
          }));
      }
      out.set(e.id, computeEdgeGeom(src, tgt, pair.idx, pair.total, obs, e.id));
    }
    return out;
  }, [displayEdges, nodes, hosts, containers, showHosts, edgePairs]);

  const handleToggleHosts = () => {
    const next = !showHosts;
    setShowHosts(next);
    try {
      window.localStorage.setItem(SHOW_HOSTS_STORAGE_KEY, next ? '1' : '0');
    } catch {}
    setSelectedNode(null);
    setSelectedHost(null);
    setSelectedEdgeId(null);
    runAutoLayout(rawNodesRef.current, hostsRef.current, edgesRef.current, next);
  };

  const handleToggleLegend = () => {
    const next = !legendOpen;
    setLegendOpen(next);
    try {
      window.localStorage.setItem(LEGEND_STORAGE_KEY, next ? '1' : '0');
    } catch {}
  };

  useEffect(() => {
    fetchGraphData();
    fetchCustomRelationTypes().then(setCustomTypes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to convert mouse client coordinates to exact SVG viewBox coordinates
  const getSvgCoordinates = (e: React.MouseEvent | WheelEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  // viewBox-координаты → координаты контента (с учётом пана и зума)
  const toContentCoords = (vb: { x: number; y: number }) => {
    const v = viewRef.current;
    return { x: (vb.x - v.x) / v.k, y: (vb.y - v.y) / v.k };
  };

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      if (!svgRef.current) return;
      const vb = getSvgCoordinates({ clientX, clientY } as React.MouseEvent);
      const v = viewRef.current;
      const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      if (newK === v.k) return;
      // Курсор остаётся над той же точкой контента: vb = t + k*c
      const cx = (vb.x - v.x) / v.k;
      const cy = (vb.y - v.y) / v.k;
      updateView({ k: newK, x: vb.x - cx * newK, y: vb.y - cy * newK });
    },
    [updateView]
  );

  const zoomStep = useCallback(
    (factor: number) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt]
  );

  /** Вписать весь граф в экран. */
  const fitView = useCallback(() => {
    const box = bboxOf(nodes, true);
    const pad = 80;
    const bw = Math.max(1, box.w + pad * 2);
    const bh = Math.max(1, box.h + pad * 2);
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvasW / bw, canvasH / bh)));
    const ccx = (box.x0 + box.x1) / 2;
    const ccy = (box.y0 + box.y1) / 2;
    updateView({ k, x: canvasW / 2 - ccx * k, y: canvasH / 2 - ccy * k });
  }, [nodes, canvasW, canvasH, updateView]);

  // Колесо мыши — зум к курсору (нативный слушатель, чтобы preventDefault работал)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const vb = getSvgCoordinates(e);
      const v = viewRef.current;
      const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
      if (newK === v.k) return;
      const cx = (vb.x - v.x) / v.k;
      const cy = (vb.y - v.y) / v.k;
      updateView({ k: newK, x: vb.x - cx * newK, y: vb.y - cy * newK });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [updateView]);

  const handleNodeMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    suppressClick.current = false;
    setDraggingNodeId(node.id);
    setSelectedNode(node);
    setSelectedHost(null);
    setSelectedEdgeId(null);
    const c = toContentCoords(getSvgCoordinates(e));
    setDragOffset({
      x: c.x - (node.x ?? 480),
      y: c.y - (node.y ?? 320),
    });
  };

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    setPanning(true);
    panLast.current = { x: e.clientX, y: e.clientY };
  };

  const handleBackgroundClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSelectedNode(null);
    setSelectedHost(null);
    setSelectedEdgeId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panning && svgRef.current) {
      // Пан: перевод экранного сдвига в единицы viewBox через CTM
      const ctm = svgRef.current.getScreenCTM();
      const scale = ctm && ctm.a !== 0 ? ctm.a : 1;
      const dx = (e.clientX - panLast.current.x) / scale;
      const dy = (e.clientY - panLast.current.y) / scale;
      if (dx !== 0 || dy !== 0) suppressClick.current = true;
      panLast.current = { x: e.clientX, y: e.clientY };
      const v = viewRef.current;
      updateView({ ...v, x: v.x + dx, y: v.y + dy });
      return;
    }
    if (!draggingNodeId || !svgRef.current) return;
    const c = toContentCoords(getSvgCoordinates(e));
    const newX = Math.round(c.x - dragOffset.x);
    const newY = Math.round(c.y - dragOffset.y);
    suppressClick.current = true;

    setNodes((prev) => prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)));
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      // Ручная раскладка сохраняется между перезагрузками
      setNodes((prev) => {
        persistPositions(prev);
        return prev;
      });
    }
    setDraggingNodeId(null);
    setPanning(false);
  };

  const handleContainerMouseDown = (e: React.MouseEvent, hostId: string | null) => {
    e.stopPropagation();
    setSelectedNode(null);
    setSelectedEdgeId(null);
    setSelectedHost(hostId ? hosts.find((h) => h.id === hostId) || null : null);
  };

  const handleEdgeMouseDown = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNode(null);
    setSelectedHost(null);
  };

  const handleResetLayout = () => {
    setSelectedNode(null);
    setSelectedHost(null);
    setSelectedEdgeId(null);
    runAutoLayout(rawNodesRef.current, hostsRef.current, edgesRef.current, showHosts);
  };

  const handleResetView = () => {
    updateView({ x: 0, y: 0, k: 1 });
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('Удалить эту связь?')) return;
    try {
      const res = await fetch(`/api/relations?id=${relationId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedEdgeId(null);
        fetchGraphData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Не удалось удалить связь');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditRelation = (edge: Edge) => {
    setEditingRelation(edge);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRelation(null);
  };

  const selectedEdge = selectedEdgeId ? displayEdges.find((e) => e.id === selectedEdgeId) || null : null;
  const selectedEdgeSource = selectedEdge ? nodes.find((n) => n.id === selectedEdge.source) || null : null;
  const selectedEdgeTarget = selectedEdge ? nodes.find((n) => n.id === selectedEdge.target) || null : null;

  const svgHeight = Math.min(Math.max(canvasH, 640), 1200);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Network className="w-7 h-7 text-cyan-400" /> Граф связей и архитектуры
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Связанные проекты притягиваются, остальные расталкиваются. Перетаскивайте узлы — раскладка
            сохраняется. Колесо — масштаб, фон — панорама.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleHosts}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showHosts
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-md shadow-cyan-950/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Показать или скрыть серверы на графе"
          >
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">Серверы</span>
            <span
              className={`w-7 h-4 rounded-full relative transition-colors ${
                showHosts ? 'bg-cyan-500/60' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  showHosts ? 'left-3.5' : 'left-0.5'
                }`}
              />
            </span>
          </button>
          <div className="flex items-center rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
            <button
              onClick={() => zoomStep(1.25)}
              className="p-2 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Приблизить"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="px-2 py-2 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-[11px] font-mono min-w-[3rem]"
              title="Сбросить масштаб и позицию"
            >
              {Math.round(view.k * 100)}%
            </button>
            <button
              onClick={() => zoomStep(1 / 1.25)}
              className="p-2 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Отдалить"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={fitView}
              className="p-2 hover:bg-slate-700 text-slate-300 transition-colors border-l border-slate-700"
              title="Вписать граф в экран"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleResetLayout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Автораскладка: связанные рядом, чужие врозь (ручные позиции будут пересчитаны)"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={fetchGraphData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Обновить схему"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setEditingRelation(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Добавить связь
          </button>
        </div>
      </div>

      {/* Main Canvas + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* SVG Interactive Canvas */}
        <div
          className="lg:col-span-3 rounded-2xl bg-[#0b101c] border border-slate-800 overflow-hidden relative shadow-2xl select-none"
          style={{ minHeight: '640px' }}
        >
          {/* Background grid */}
          <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

          {/* Legend (collapsible, чтобы не закрывать граф) */}
          <div className="absolute top-4 left-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg z-10 overflow-hidden">
            <button
              onClick={handleToggleLegend}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
              title={legendOpen ? 'Скрыть легенду' : 'Показать легенду'}
            >
              {legendOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="font-bold uppercase text-[10px] text-slate-400">Типы связей</span>
              <span className="text-slate-600">
                {nodes.length} уз. • {displayEdges.length} св.
              </span>
            </button>
            {legendOpen && (
              <div className="px-3 pb-3 pt-1 space-y-1.5 text-[11px] font-mono max-h-64 overflow-y-auto">
                {Object.entries(relationLabels).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="w-3 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: val.color }}
                    />
                    <span className="text-slate-300 whitespace-nowrap">{val.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zoom hint */}
          <div className="absolute bottom-3 left-4 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-500 z-10 pointer-events-none">
            Колесо — масштаб • Фон — панорама • Узел — перетаскивание (сохраняется)
          </div>

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-[#0b101c]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <div className="text-xs font-mono text-slate-300">Загрузка графа связей...</div>
            </div>
          )}

          {/* Error overlay */}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono max-w-md">
                {error}
              </div>
              <button
                onClick={fetchGraphData}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
              >
                Повторить попытку
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
                <Network className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Проекты не найдены</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Для визуализации графа связей создайте хотя бы один проект в панели управления.
              </p>
              <Link
                href="/projects"
                className="mt-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md shadow-cyan-600/20"
              >
                Перейти к проектам
              </Link>
            </div>
          )}

          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleBackgroundMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleBackgroundClick}
            className={`w-full block ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ width: '100%', height: `${svgHeight}px` }}
          >
            <defs>
              {/* Arrowhead markers */}
              {displayEdges.map((e) => (
                <marker
                  key={`marker-${e.id}`}
                  id={`arrow-${e.id}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={e.color || '#94a3b8'} />
                </marker>
              ))}
            </defs>

            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {/* Server containers (behind edges and nodes) */}
              {containers.map((c) => (
                <g
                  key={c.key}
                  onMouseDown={(e) => handleContainerMouseDown(e, c.hostId)}
                  className="cursor-pointer"
                >
                  <rect
                    x={c.x}
                    y={c.y}
                    width={c.w}
                    height={c.h}
                    rx="16"
                    fill={c.dashed ? 'transparent' : 'rgba(12, 26, 46, 0.55)'}
                    stroke={c.dashed ? '#334155' : '#1d4e6e'}
                    strokeWidth="1.5"
                    strokeDasharray={c.dashed ? '8 5' : undefined}
                  />
                  <text
                    x={c.x + 20}
                    y={c.y + 24}
                    fill={c.dashed ? '#64748b' : '#7dd3fc'}
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                    className="select-none pointer-events-none"
                  >
                    {c.dashed ? '▢ ' : '🖥 '}
                    {c.title.length > 34 ? `${c.title.slice(0, 33)}…` : c.title}
                  </text>
                  <text
                    x={c.x + 20}
                    y={c.y + 40}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                    className="select-none pointer-events-none"
                  >
                    {c.subtitle}
                  </text>
                </g>
              ))}

              {/* Edges: routed curves, border-to-border, with readable pill labels */}
              {displayEdges.map((edge) => {
                const geom = edgeGeoms.get(edge.id);
                if (!geom) return null;
                const isSelected = selectedEdgeId === edge.id;
                const label = edge.label || '';
                const short = label.length > 26 ? `${label.slice(0, 25)}…` : label;
                const pillW = Math.max(28, short.length * 6.4 + 20);
                const pillH = 20;
                return (
                  <g key={edge.id} className="group">
                    {/* Широкая невидимая зона клика */}
                    <path
                      d={geom.d}
                      stroke="transparent"
                      strokeWidth="16"
                      fill="none"
                      className="cursor-pointer"
                      onMouseDown={(e) => handleEdgeMouseDown(e, edge.id)}
                    >
                      <title>{label}</title>
                    </path>
                    {/* Видимая линия */}
                    <path
                      d={geom.d}
                      stroke={isSelected ? '#22d3ee' : edge.color || '#94a3b8'}
                      strokeWidth={isSelected ? 3 : 2}
                      fill="none"
                      strokeDasharray={isSelected ? undefined : '5 3'}
                      markerEnd={`url(#arrow-${edge.id})`}
                      className="opacity-80 group-hover:opacity-100 transition-all pointer-events-none"
                      style={isSelected ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.7))' } : undefined}
                    />
                    {/* Подложка-подпись: читается даже поверх контейнеров */}
                    <g
                      className="cursor-pointer"
                      onMouseDown={(e) => handleEdgeMouseDown(e, edge.id)}
                    >
                      <title>{label}</title>
                      <rect
                        x={geom.lx - pillW / 2}
                        y={geom.ly - pillH / 2}
                        width={pillW}
                        height={pillH}
                        rx={pillH / 2}
                        fill={isSelected ? '#164e63' : '#0b101c'}
                        stroke={isSelected ? '#22d3ee' : edge.color || '#94a3b8'}
                        strokeWidth="1.2"
                        className="pointer-events-none"
                      />
                      <text
                        x={geom.lx}
                        y={geom.ly + 3.5}
                        fill={isSelected ? '#ffffff' : edge.color || '#94a3b8'}
                        fontSize="10"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="select-none pointer-events-none"
                      >
                        {short}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const dotColor = getStatusDotColor(node.status);
                const nx = node.x ?? 480;
                const ny = node.y ?? 320;
                const title = node.title.length > 22 ? `${node.title.slice(0, 21)}…` : node.title;
                const sub = `${node.category}${node.hostName ? ` • ${node.hostName}` : ''}`;
                const shortSub = sub.length > 28 ? `${sub.slice(0, 27)}…` : sub;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${nx}, ${ny})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    className="cursor-grab active:cursor-grabbing transition-transform"
                  >
                    <title>{`${node.title}\n${node.category}${node.hostName ? ` • ${node.hostName}` : ''}`}</title>
                    {/* Outer glow for selected */}
                    {isSelected && (
                      <rect
                        x={-NODE_HW - 5}
                        y={-NODE_HH - 5}
                        width={CARD_W + 10}
                        height={CARD_H + 10}
                        rx="16"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        className="animate-pulse"
                      />
                    )}

                    {/* Node container card */}
                    <rect
                      x={-NODE_HW}
                      y={-NODE_HH}
                      width={CARD_W}
                      height={CARD_H}
                      rx="12"
                      fill="#0f172a"
                      stroke={isSelected ? '#06b6d4' : '#1e293b'}
                      strokeWidth="1.5"
                      className="filter drop-shadow-lg"
                    />

                    {/* Status dot */}
                    <circle cx={-NODE_HW + 18} cy="-2" r="4.5" fill={dotColor} />

                    {/* Title */}
                    <text
                      x={-NODE_HW + 30}
                      y="2"
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="start"
                      className="pointer-events-none select-none"
                    >
                      {title}
                    </text>

                    {/* Category & Host subtitle */}
                    <text
                      x={-NODE_HW + 30}
                      y="17"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="start"
                      className="pointer-events-none select-none"
                    >
                      {shortSub}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Node Side Drawer */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              {selectedEdge ? 'Информация о связи' : 'Информация об узле'}
            </h3>
            {selectedNode && (
              <Link
                href={`/projects/${selectedNode.id}`}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                Открыть <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {selectedEdge && (
              <button
                onClick={() => setSelectedEdgeId(null)}
                className="text-slate-500 hover:text-white p-1"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedEdge ? (
            <div className="space-y-4 text-xs">
              <div>
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border"
                  style={{
                    color: selectedEdge.color,
                    borderColor: selectedEdge.color,
                    backgroundColor: '#0b101c',
                  }}
                >
                  {selectedEdge.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="truncate">{selectedEdgeSource?.title || '…'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" style={{ color: selectedEdge.color }} />
                <span className="truncate">{selectedEdgeTarget?.title || '…'}</span>
              </div>
              {selectedEdge.description && (
                <div className="text-slate-400 text-xs leading-relaxed">{selectedEdge.description}</div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleEditRelation(selectedEdge)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Редактировать
                </button>
                <button
                  onClick={() => handleDeleteRelation(selectedEdge.id)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Удалить
                </button>
              </div>
            </div>
          ) : selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">Проект</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedNode.title}</div>
                <div className="text-slate-400 font-mono mt-0.5">{selectedNode.slug}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Категория</div>
                  <div className="font-semibold text-white mt-0.5 uppercase">{selectedNode.category}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Статус</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">
                    {STATUS_COLORS[selectedNode.status]?.label || selectedNode.status}
                  </div>
                </div>
              </div>

              {selectedNode.hostName &&
                (() => {
                  const host = selectedNode.hostId
                    ? hosts.find((h) => h.id === selectedNode.hostId)
                    : undefined;
                  if (host && showHosts) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNode(null);
                          setSelectedHost(host);
                        }}
                        className="w-full text-left p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 font-mono hover:border-indigo-500/60 transition-colors"
                      >
                        <div className="text-indigo-400 text-[10px]">Сервер размещения</div>
                        <div className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-indigo-400" /> {selectedNode.hostName}
                        </div>
                      </button>
                    );
                  }
                  return (
                    <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 font-mono">
                      <div className="text-indigo-400 text-[10px]">Сервер размещения</div>
                      <div className="font-semibold text-white mt-0.5">{selectedNode.hostName}</div>
                    </div>
                  );
                })()}

              {/* Connected edges */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                  Связи этого проекта
                </div>
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => {
                    const isSource = e.source === selectedNode.id;
                    const otherNode = nodes.find((n) => n.id === (isSource ? e.target : e.source));
                    return (
                      <div
                        key={e.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-medium text-white flex items-center gap-1.5">
                            {isSource ? (
                              <>
                                <span>Вызывает</span> <ArrowRight className="w-3 h-3 text-cyan-400" />
                                <span className="text-cyan-300">{otherNode?.title}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-indigo-300">{otherNode?.title}</span>
                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                <span>Вызывает этот сервис</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{e.label}</div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditRelation(e)}
                            className="text-slate-500 hover:text-cyan-400 p-1"
                            title="Редактировать"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRelation(e.id)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : selectedHost ? (
            <HostDrawerPanel
              host={selectedHost}
              fallbackTitle={selectedHost.name}
              projects={nodes.filter((n) => n.hostId === selectedHost.id)}
            />
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              Кликните на узел или связь на графе для детального просмотра.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <CreateRelationModal
        isOpen={isModalOpen}
        editingRelation={
          editingRelation
            ? {
                id: editingRelation.id,
                sourceProjectId: editingRelation.source,
                targetProjectId: editingRelation.target,
                relationType: editingRelation.relationType,
                description: editingRelation.description,
              }
            : null
        }
        onClose={handleCloseModal}
        onCreated={() => {
          fetchGraphData();
          fetchCustomRelationTypes().then(setCustomTypes).catch(() => {});
        }}
      />
    </div>
  );
}
