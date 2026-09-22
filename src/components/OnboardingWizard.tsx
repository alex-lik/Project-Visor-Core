'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  FolderGit2,
  Terminal,
  Network,
  Zap,
  CheckCircle2,
  Circle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

interface OnboardingWizardProps {
  hostsCount: number;
  projectsCount: number;
  opencodeHostsCount?: number;
  onOpenCreateHost?: () => void;
  onOpenCreateProject?: () => void;
}

export default function OnboardingWizard({
  hostsCount,
  projectsCount,
  opencodeHostsCount = 0,
  onOpenCreateHost,
  onOpenCreateProject,
}: OnboardingWizardProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('visor_core_onboarding_dismissed');
    if (saved !== 'true') {
      setIsDismissed(false);
    }
  }, []);

  const steps = [
    {
      id: 'step_host',
      title: 'Подключите первый сервер',
      description: 'Добавьте VPS или локальную Homelab-машину в реестр хостов.',
      completed: hostsCount > 0,
      icon: Server,
      action: onOpenCreateHost ? (
        <button
          type="button"
          onClick={onOpenCreateHost}
          className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Server className="w-3.5 h-3.5" /> Добавить сервер
        </button>
      ) : (
        <Link
          href="/infrastructure"
          className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          В Инфраструктуру <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
    {
      id: 'step_project',
      title: 'Создайте проект и контейнеры',
      description: 'Опишите ваш сайт, API или сервис, задайте порты и стек контейнеров.',
      completed: projectsCount > 0,
      icon: FolderGit2,
      action: onOpenCreateProject ? (
        <button
          type="button"
          onClick={onOpenCreateProject}
          className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <FolderGit2 className="w-3.5 h-3.5" /> Создать проект
        </button>
      ) : (
        <Link
          href="/projects"
          className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          В каталог проектов <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
    {
      id: 'step_opencode',
      title: 'Подключите OpenCode Server',
      description: 'Включите OpenCode на хосте для автономного выполнения задач и генерации diff.',
      completed: opencodeHostsCount > 0,
      icon: Terminal,
      action: (
        <Link
          href="/infrastructure"
          className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Terminal className="w-3.5 h-3.5" /> Настроить OpenCode
        </Link>
      ),
    },
    {
      id: 'step_graph',
      title: 'Изучите топологию архитектуры',
      description: 'Связывайте микросервисы зависимостями и визуализируйте сервисный граф.',
      completed: projectsCount > 1,
      icon: Network,
      action: (
        <Link
          href="/graph"
          className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Network className="w-3.5 h-3.5" /> Граф связей
        </Link>
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('visor_core_onboarding_dismissed', 'true');
  };

  if (isDismissed) return null;

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 to-[#0c121e]/95 backdrop-blur-md shadow-xl overflow-hidden mb-8 transition-all">
      {/* Wizard Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-4 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Быстрый старт: 4 шага к полному контролю над инфраструктурой
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-cyan-950 border border-cyan-800 text-cyan-300">
                {progressPercent}% готово
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Инструкция по первичному подключению хостов, сервисов и OpenCode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
            title="Закрыть руководство"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  step.completed
                    ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm shadow-emerald-950/20'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        step.completed
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {step.completed ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Выполнено
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                        <Circle className="w-3 h-3" /> Шаг {idx + 1}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-slate-200 mb-1">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{step.description}</p>
                </div>
                <div>{step.action}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
