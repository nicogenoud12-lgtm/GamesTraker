import type { ReactNode } from 'react';

export default function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="pt-safe px-5">
      <div className="flex items-end justify-between gap-3 pt-6 pb-4 lg:pt-10 lg:pb-6">
        <div className="min-w-0">
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
