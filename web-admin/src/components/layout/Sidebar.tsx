// web-admin/src/components/layout/Sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconAlertTriangle,
  IconBooks,
  IconCash,
  IconCreditCard,
  IconHistory,
  IconLayoutDashboard,
  IconLogout,
  IconMapPin,
  IconMessage,
  IconPackage,
  IconSettings,
  IconShieldLock,
  IconSteeringWheel,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Opérations',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: IconLayoutDashboard },
      { href: '/users', label: 'Utilisateurs', icon: IconUsers },
      { href: '/drivers', label: 'Chauffeurs', icon: IconSteeringWheel },
      { href: '/disputes', label: 'Litiges', icon: IconAlertTriangle },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/payment-providers', label: 'Moyens de paiement', icon: IconCreditCard },
      { href: '/payouts', label: 'Retraits', icon: IconWallet },
      { href: '/pricing', label: 'Tarification', icon: IconCash },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/shipment-categories', label: "Catégories d'envoi", icon: IconPackage },
      { href: '/geography', label: 'Géographie', icon: IconMapPin },
      { href: '/notification-templates', label: 'Modèles de notification', icon: IconMessage },
      { href: '/translations', label: 'Traductions', icon: IconBooks },
    ],
  },
  {
    title: 'Système',
    items: [
      { href: '/roles', label: 'Rôles', icon: IconShieldLock },
      { href: '/settings', label: 'Paramètres', icon: IconSettings },
      { href: '/audit-logs', label: "Journal d'audit", icon: IconHistory },
    ],
  },
];

/**
 * Toujours une barre latérale fixe — contrairement à l'app mobile, ce
 * back-office est un outil interne à usage desktop en priorité, pas
 * besoin d'une bascule vers une barre basse sur petit écran.
 */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-6">
        <p className="text-lg font-bold text-primary">Back-office</p>
        <p className="text-xs text-text-secondary">Transport Partagé</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-xs font-semibold text-text-muted">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-text-primary hover:bg-surface-muted'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-sm font-medium text-text-primary">{user?.email ?? user?.phone}</p>
        <button
          onClick={handleLogout}
          className="mt-2 flex items-center gap-2 text-sm text-danger hover:underline"
        >
          <IconLogout size={16} />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
