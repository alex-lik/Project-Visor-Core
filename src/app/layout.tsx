import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Project Visor Core — Open-Source Developer Control Plane',
  description:
    'Self-hosted open-source control plane for projects, infrastructure matrix, ports, kanban and OpenCode server.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased bg-[#090d16] min-h-screen text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <Navigation>{children}</Navigation>
      </body>
    </html>
  );
}
