'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  FolderGit2,
  Kanban,
  Network,
  Server,
  KeyRound,
  LogOut,
  Radio,
  Menu,
  X,
} from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

export interface NavItemConfig {
  href: string;
  label: string;
  icon: any;
}

const DEFAULT_CORE_NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'Радар фокуса', icon: Compass },
  { href: '/projects', label: 'Проекты', icon: FolderGit2 },
  { href: '/tasks', label: 'Канбан доски', icon: Kanban },
  { href: '/graph', label: 'Граф связей', icon: Network },
  { href: '/infrastructure', label: 'Инфраструктура', icon: Server },
  { href: '/settings/api-keys', label: 'API-ключи & Доступ', icon: KeyRound },
];

export interface NavigationProps {
  children: React.ReactNode;
  extraNavItems?: NavItemConfig[];
  actionSlot?: React.ReactNode;
}

export default function Navigation({
  children,
  extraNavItems = [],
  actionSlot,
}: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If on login page, render children directly without dashboard shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const navItems = [...DEFAULT_CORE_NAV_ITEMS, ...extraNavItems];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#090d16] bg-grid-pattern text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800/80 bg-[#0c121e]/90 backdrop-blur-md sticky top-0 h-screen z-30">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white flex items-center gap-1.5 text-base">
                VISOR <span className="text-cyan-400 text-xs font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/50">CORE</span>
                <span className="text-[10px] font-mono text-cyan-400/90 bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700/60">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-wide">Developer Control</p>
            </div>
          </Link>
        </div>

        {/* System Pulse */}
        <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-900/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Active
            </span>
            <span className="font-mono text-[11px] text-emerald-400/90 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              OpenCode
            </span>
          </div>
        </div>

        {/* Optional Action Slot (e.g. AI Architect in commercial layer) */}
        {actionSlot && <div className="px-3 pt-3 pb-1">{actionSlot}</div>}

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
            Навигация
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
              AD
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Admin</div>
              <div className="text-[10px] text-slate-500 font-mono">Control Plane</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Выйти"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-[#0c121e]/90 backdrop-blur-md sticky top-0 z-40">
          <Link href="/" className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-white text-sm">VISOR CORE</span>
            <span className="text-[10px] font-mono text-cyan-400/90 bg-slate-800 px-1 rounded">v{APP_VERSION}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-[65px] bg-[#0c121e] z-30 p-4 flex flex-col">
            {actionSlot && <div className="mb-4">{actionSlot}</div>}
            <nav className="space-y-1 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      isActive ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-auto flex items-center gap-2 text-sm text-rose-400 py-3 border-t border-slate-800"
            >
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
