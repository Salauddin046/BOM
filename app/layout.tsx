'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard/mrp', label: 'Run MRP', icon: '⚙️' },
  { href: '/dashboard/projection', label: 'Projection', icon: '📊' },
  { href: '/dashboard/product', label: 'Product', icon: '📦' },
  { href: '/dashboard/device', label: 'Device', icon: '🔧' },
  { href: '/dashboard/harness', label: 'Harness', icon: '🔌' },
  { href: '/dashboard/pcba', label: 'PCBA', icon: '🖥️' },
  { href: '/dashboard/raw-material', label: 'Raw Material', icon: '🪨' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold tracking-tight text-white">MRP Tool</h1>
          <p className="text-xs text-gray-400 mt-0.5">Material Requirements</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            ← Home
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}