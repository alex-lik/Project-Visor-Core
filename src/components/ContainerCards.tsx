'use client';

import React from 'react';
import { Plus, Trash2, Box } from 'lucide-react';
import {
  ProjectContainer,
  ContainerServiceType,
  CONTAINER_TYPES,
  PORT_PROTOCOLS,
} from '@/lib/containers';

const PRESETS: Array<{ label: string; textClass: string; preset: Partial<ProjectContainer> }> = [
  { label: '+ ⚙️ API (8080)', textClass: 'text-emerald-300', preset: { name: 'api', type: 'api', port: 8080, portType: 'http' } },
  { label: '+ 🗄️ Postgres (5432)', textClass: 'text-indigo-300', preset: { name: 'postgres', type: 'database', port: 5432, portType: 'tcp' } },
  { label: '+ ⚡ Redis (6379)', textClass: 'text-amber-300', preset: { name: 'redis', type: 'cache', port: 6379, portType: 'tcp' } },
  { label: '+ 👷 Worker', textClass: 'text-purple-300', preset: { name: 'worker', type: 'worker', port: null, portType: undefined } },
  { label: '+ 🛡️ Proxy (80)', textClass: 'text-sky-300', preset: { name: 'nginx', type: 'proxy', port: 80, portType: 'http' } },
];

interface ContainerCardsProps {
  containers: ProjectContainer[];
  onAdd: (preset?: Partial<ProjectContainer>) => void;
  onUpdate: (id: string, field: keyof ProjectContainer, val: any) => void;
  onRemove: (id: string) => void;
  title?: string;
  description?: string;
  addLabel?: string;
  /** Прятать крестик удаления, когда контейнеров <= minCount (create-форма: 1) */
  minCount?: number;
}

const inputCls =
  'px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-500';

/**
 * Компактные карточки контейнеров: сетка небольших блоков (1–3 в ряд),
 * а не полноширинные панели. Тот же функционал: имя, тип, порт, протокол.
 */
export default function ContainerCards({
  containers,
  onAdd,
  onUpdate,
  onRemove,
  title = 'Контейнеры и открытые порты',
  description = 'Управляйте микросервисами, базами данных, очередями и открытыми портами проекта с выбором сетевого протокола.',
  addLabel = 'Добавить сервис',
  minCount = 0,
}: ContainerCardsProps) {
  const handleTypeChange = (c: ProjectContainer, newType: ContainerServiceType) => {
    const meta = CONTAINER_TYPES[newType];
    onUpdate(c.id, 'type', newType);
    if (meta?.defaultPort && !c.port) {
      onUpdate(c.id, 'port', meta.defaultPort);
    }
    if (meta?.defaultPortType) {
      onUpdate(c.id, 'portType', meta.defaultPortType);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-200">
            {title} ({containers.length})
          </label>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd()}
          className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 font-mono transition-colors self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-900/50 p-2 rounded-lg border border-slate-800/80">
        <span className="text-slate-500 mr-1">Быстрый шаблон:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onAdd(p.preset)}
            className={`px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 ${p.textClass} border border-slate-700 transition-colors`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {containers.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
          <Box className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-xs text-slate-400">Нет добавленных контейнеров или сервисов.</div>
          <button
            type="button"
            onClick={() => onAdd({ name: 'app', type: 'web', port: 3000, portType: 'http' })}
            className="px-3 py-1 text-xs rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono"
          >
            + Добавить основной сервис (3000)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {containers.map((c, idx) => {
            const meta = CONTAINER_TYPES[c.type];
            const color = meta?.color || '#94a3b8';
            return (
              <div
                key={c.id}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-600 transition-colors space-y-2"
              >
                {/* Header: icon + name + port badge + delete */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: `${color}1f`, color }}
                    title={meta?.label || c.type}
                  >
                    {meta?.icon || '📦'}
                  </span>
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => onUpdate(c.id, 'name', e.target.value)}
                    placeholder="api, web, db"
                    title={`Сервис #${idx + 1} — имя`}
                    className={`flex-1 min-w-0 ${inputCls} text-xs`}
                  />
                  {c.port ? (
                    <span
                      className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-cyan-300"
                      title={`Порт ${c.port} (${c.portType || 'http'})`}
                    >
                      :{c.port}
                    </span>
                  ) : null}
                  {containers.length > minCount && (
                    <button
                      type="button"
                      onClick={() => onRemove(c.id)}
                      className="shrink-0 text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Удалить контейнер"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Type + port/protocol */}
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={c.type}
                    onChange={(e) => handleTypeChange(c, e.target.value as ContainerServiceType)}
                    title="Тип сервиса"
                    className={`w-full min-w-0 ${inputCls} text-[11px]`}
                  >
                    {Object.entries(CONTAINER_TYPES).map(([typeKey, m]) => (
                      <option key={typeKey} value={typeKey}>
                        {m.icon} {m.shortLabel}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5 min-w-0">
                    <input
                      type="number"
                      value={c.port !== undefined && c.port !== null ? c.port : ''}
                      onChange={(e) =>
                        onUpdate(c.id, 'port', e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder="порт"
                      title="Порт (пусто — без порта, например worker)"
                      className={`w-16 shrink-0 ${inputCls} text-[11px]`}
                    />
                    <select
                      value={c.portType || 'http'}
                      onChange={(e) => onUpdate(c.id, 'portType', e.target.value)}
                      disabled={!c.port}
                      title="Сетевой протокол"
                      className={`flex-1 min-w-0 ${inputCls} text-[11px] disabled:opacity-40`}
                    >
                      {Object.entries(PORT_PROTOCOLS).map(([protoKey, pMeta]) => (
                        <option key={protoKey} value={protoKey}>
                          {pMeta.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Docker container name */}
                <input
                  type="text"
                  value={c.containerName || ''}
                  onChange={(e) => onUpdate(c.id, 'containerName', e.target.value)}
                  placeholder="Docker-имя (необязательно)"
                  title="Имя Docker-контейнера"
                  className={`w-full ${inputCls} text-[11px] placeholder-slate-600 border-slate-800 bg-slate-950/60 text-slate-300`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
