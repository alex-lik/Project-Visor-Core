'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface AddonSpoilerProps {
  /** Иконка слева (эмодзи или компонент) */
  icon: React.ReactNode;
  /** Заголовок кнопки */
  title: string;
  /** Подсказка под заголовком */
  hint?: string;
  /** Есть ли заполненные данные — влияет на бейдж и авто-раскрытие */
  hasData?: boolean;
  /** Текст бейджа когда hasData === true */
  activeLabel?: string;
  /** Явно задать начальное состояние (иначе — раскрыто если hasData) */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Кнопка-спойлер для «полезного обвеса» (бэкапы, S3/R2, FTP, Sentry).
 * По умолчанию свёрнуто, если туда ничего не забито (hasData === false).
 * Автоматически раскрывается, когда данные появляются.
 */
export default function AddonSpoiler({
  icon,
  title,
  hint,
  hasData = false,
  activeLabel = 'Настроено',
  defaultOpen,
  children,
}: AddonSpoilerProps) {
  const [open, setOpen] = useState(defaultOpen ?? hasData);
  const prevHad = useRef(hasData);

  useEffect(() => {
    if (hasData && !prevHad.current) setOpen(true);
    prevHad.current = hasData;
  }, [hasData]);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        open
          ? 'bg-slate-900/60 border-slate-700'
          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="shrink-0 text-base leading-none">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-white truncate">{title}</span>
          {hint && <span className="block text-[11px] text-slate-500 truncate">{hint}</span>}
        </span>
        <span
          className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border ${
            hasData
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}
        >
          {hasData ? activeLabel : 'Не настроено'}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2.5 border-t border-slate-800/70 space-y-3">{children}</div>
      )}
    </div>
  );
}
