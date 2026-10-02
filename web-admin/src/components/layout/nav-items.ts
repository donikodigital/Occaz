// web-admin/src/components/layout/nav-items.ts
// [22/09/2026] v+ — getQuickLinks() retiré : la barre du bas mobile a été supprimée, toute la navigation mobile passe par le tiroir de la Sidebar.
// [02/10/2026] v+ — Chaque entrée déclare la permission (une parmi plusieurs) qui y donne accès : le menu et
// les pages ne montrent plus que ce que le compte connecté a le droit d'utiliser (un Support ne voit plus
// la finance, la configuration ni le système sans le rôle qui va avec). Pas de `permissions` = ouvert à tous.
import {
  IconAlertTriangle,
  IconArrowsExchange,
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
  IconRoute,
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
import { PERMISSIONS, type PermissionKey } from '@/utils/permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Accès si le compte a AU MOINS UNE de ces permissions (le SuperAdmin passe toujours). */
  permissions?: PermissionKey[];
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
      { href: '/users', label: 'Utilisateurs', icon: IconUsers, permissions: [PERMISSIONS.USER_READ] },
      { href: '/drivers', label: 'Chauffeurs', icon: IconSteeringWheel, permissions: [PERMISSIONS.DRIVER_READ] },
      { href: '/trips', label: 'Trajets', icon: IconRoute, permissions: [PERMISSIONS.TRIP_READ] },
      { href: '/shipments', label: 'Envois', icon: IconTruckDelivery, permissions: [PERMISSIONS.SHIPMENT_READ] },
      { href: '/disputes', label: 'Litiges', icon: IconAlertTriangle, permissions: [PERMISSIONS.DISPUTE_READ] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/payment-providers', label: 'Moyens de paiement', icon: IconCreditCard, permissions: [PERMISSIONS.PAYMENT_PROVIDER_MANAGE] },
      { href: '/payouts', label: 'Retraits', icon: IconWallet, permissions: [PERMISSIONS.PAYOUT_MANAGE] },
      { href: '/pricing', label: 'Tarification', icon: IconCash, permissions: [PERMISSIONS.COMMISSION_MANAGE, PERMISSIONS.CANCELLATION_POLICY_MANAGE] },
      { href: '/exchange-rates', label: 'Taux de change', icon: IconArrowsExchange, permissions: [PERMISSIONS.SETTINGS_UPDATE] },
    ],
  },
  {
    title: 'Promotions',
    items: [
      { href: '/promo-codes', label: 'Codes promo', icon: IconDiscount2, permissions: [PERMISSIONS.PROMOTION_MANAGE] },
      { href: '/deals', label: 'Bons plans', icon: IconTicket, permissions: [PERMISSIONS.PROMOTION_MANAGE] },
      { href: '/articles', label: 'Actualités', icon: IconSpeakerphone, permissions: [PERMISSIONS.PROMOTION_MANAGE] },
      { href: '/referrals', label: 'Parrainage', icon: IconGift, permissions: [PERMISSIONS.PROMOTION_MANAGE] },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/shipment-categories', label: "Catégories d'envoi", icon: IconPackage, permissions: [PERMISSIONS.SHIPMENT_CATEGORY_MANAGE] },
      { href: '/geography', label: 'Géographie', icon: IconMapPin, permissions: [PERMISSIONS.GEOGRAPHY_MANAGE] },
      { href: '/notification-templates', label: 'Modèles de notification', icon: IconMessage, permissions: [PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE] },
      { href: '/translations', label: 'Traductions', icon: IconBooks, permissions: [PERMISSIONS.SETTINGS_UPDATE] },
    ],
  },
  {
    title: 'Système',
    items: [
      { href: '/roles', label: 'Rôles', icon: IconShieldLock, permissions: [PERMISSIONS.ROLE_MANAGE] },
      { href: '/settings', label: 'Paramètres', icon: IconSettings, permissions: [PERMISSIONS.SETTINGS_UPDATE] },
      { href: '/audit-logs', label: "Journal d'audit", icon: IconHistory, permissions: [PERMISSIONS.AUDIT_READ] },
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

/** Vrai si le compte peut ouvrir cette entrée du menu. `can` vient de usePermissions(). */
export function canSeeNavItem(item: NavItem, can: (...required: PermissionKey[]) => boolean): boolean {
  return !item.permissions || can(...item.permissions);
}

/** Sections du menu réduites à ce que le compte a le droit d'utiliser (une section vide disparaît). */
export function getVisibleSections(can: (...required: PermissionKey[]) => boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canSeeNavItem(item, can)),
  })).filter((section) => section.items.length > 0);
}