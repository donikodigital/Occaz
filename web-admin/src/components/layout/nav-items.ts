// web-admin/src/components/layout/nav-items.ts
// [22/09/2026] v+ — getQuickLinks() retiré : la barre du bas mobile a été supprimée, toute la navigation mobile passe par le tiroir de la Sidebar.
import {
  IconAlertTriangle,
  IconBooks,
  IconCash,
  IconCreditCard,
  IconDiscount2,
  IconGift,
  IconHistory,
  IconLayoutDashboard,
  IconMapPin,
  IconMessage,
  IconPackage,
  IconSettings,
  IconShieldLock,
  IconSpeakerphone,
  IconSteeringWheel,
  IconTicket,
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
 * et la MobileTopBar (mobile, via son tiroir de navigation), pour ne
 * jamais avoir des listes qui divergent.
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
    title: 'Promotions',
    items: [
      { href: '/promo-codes', label: 'Codes promo', icon: IconDiscount2 },
      { href: '/deals', label: 'Bons plans', icon: IconTicket },
      { href: '/articles', label: 'Actualités', icon: IconSpeakerphone },
      { href: '/referrals', label: 'Parrainage', icon: IconGift },
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