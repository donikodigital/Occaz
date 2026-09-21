// web-admin/src/components/layout/nav-items.ts
import {
  IconAlertTriangle,
  IconBooks,
  IconCash,
  IconCreditCard,
  IconHistory,
  IconLayoutDashboard,
  IconMapPin,
  IconMessage,
  IconPackage,
  IconSettings,
  IconShieldLock,
  IconSteeringWheel,
  IconTruckDelivery,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import type React from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Source unique de la navigation, partagée par la Sidebar (desktop), la
 * MobileTopBar et la BottomNavBar (mobile), pour ne jamais avoir des
 * listes qui divergent.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Opérations',
    items: [
      { href: '/dashboard', label: 'Tableau de bord', icon: IconLayoutDashboard },
      { href: '/users', label: 'Utilisateurs', icon: IconUsers },
      { href: '/drivers', label: 'Chauffeurs', icon: IconSteeringWheel },
      { href: '/shipments', label: 'Envois', icon: IconTruckDelivery },
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

export function getActiveNavItem(pathname: string): NavItem | undefined {
  for (const section of NAV_SECTIONS) {
    const match = section.items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    if (match) return match;
  }
  return undefined;
}

// Les 4 liens les plus utilisés au quotidien, affichés dans la barre du
// bas sur mobile. Le reste de la navigation passe par le menu burger.
const QUICK_LINK_HREFS = ['/dashboard', '/users', '/drivers', '/disputes'];

export function getQuickLinks(): NavItem[] {
  const allItems = NAV_SECTIONS.flatMap((section) => section.items);
  return QUICK_LINK_HREFS.map((href) => allItems.find((item) => item.href === href)).filter(
    (item): item is NavItem => Boolean(item)
  );
}