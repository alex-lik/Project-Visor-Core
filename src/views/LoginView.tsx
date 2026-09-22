'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Lock, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

function LoginFormContent() {
  const router = useRouter();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка демо-входа');

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] bg-grid-pattern flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="relative rounded-2xl bg-[#0c121e]/90 border border-slate-800 backdrop-blur-xl shadow-2xl shadow-cyan-500/5 p-8 overflow-hidden">
          <div className="absolute -right-16 -top-16 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-3">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              VISOR <span className="text-cyan-400 text-xs font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/50">CORE</span>
              <span className="text-[10px] font-mono text-cyan-400/90 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60">
                v{APP_VERSION}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">Open-Source Developer Control Plane</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Имя пользователя</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2 rounded-xl bg-[#090d16] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Пароль</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2 rounded-xl bg-[#090d16] border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              <span>{loading ? 'Вход...' : 'Войти в Control Plane'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>

          {/* 1-Click Demo */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              className="w-full py-2 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{demoLoading ? 'Вход в демо...' : 'Демо-вход в 1 клик (usr_admin)'}</span>
            </button>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Локальный логин по умолчанию: </span>
            <span className="font-mono text-slate-400">admin / admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-500 font-mono text-xs">Загрузка...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
