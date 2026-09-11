// backend/src/common/constants/permissions.constants.ts
/**
 * Catalogue centralisé des clés de permission (table Permission.key).
 * Une seule source de vérité — les modules futurs référencent ces
 * constantes plutôt que des chaînes libres, pour éviter les fautes de
 * frappe et permettre un usage avec @Permissions(...) et le RBAC seed.
 */
export const PERMISSIONS = {
  // Utilisateurs & RBAC
  USER_READ: 'user.read',
  USER_SUSPEND: 'user.suspend',
  USER_DELETE: 'user.delete',
  ROLE_MANAGE: 'role.manage',
  SETTINGS_UPDATE: 'settings.update',
  AUDIT_READ: 'audit.read',
  DASHBOARD_ADMIN_READ: 'dashboard.admin_read',

  // Géographie
  GEOGRAPHY_MANAGE: 'geography.manage',

  // Profils / clients / chauffeurs
  CUSTOMER_READ: 'customer.read',
  DRIVER_READ: 'driver.read',
  DRIVER_VERIFY: 'driver.verify',
  DRIVER_SUSPEND: 'driver.suspend',
  VEHICLE_READ: 'vehicle.read',
  VEHICLE_VERIFY: 'vehicle.verify',
  DOCUMENT_READ: 'document.read',
  DOCUMENT_VERIFY: 'document.verify',

  // Trajets & réservations
  TRIP_READ: 'trip.read',
  TRIP_UPDATE: 'trip.update',
  TRIP_CANCEL: 'trip.cancel',
  BOOKING_READ: 'booking.read',
  BOOKING_CANCEL: 'booking.cancel',

  // Envois
  SHIPMENT_READ: 'shipment.read',
  SHIPMENT_UPDATE: 'shipment.update',
  SHIPMENT_CATEGORY_MANAGE: 'shipment_category.manage',

  // Paiement / finance
  PAYMENT_READ: 'payment.read',
  PAYMENT_PROVIDER_MANAGE: 'payment_provider.manage',
  REFUND_CREATE: 'refund.create',
  WALLET_READ: 'wallet.read',
  WALLET_ADJUST: 'wallet.adjust',
  PAYOUT_MANAGE: 'payout.manage',
  COMMISSION_MANAGE: 'commission.manage',
  CANCELLATION_POLICY_MANAGE: 'cancellation_policy.manage',

  // Litiges
  DISPUTE_READ: 'dispute.read',
  DISPUTE_RESOLVE: 'dispute.resolve',
  DISPUTE_ASSIGN: 'dispute.assign',

  // Communication
  NOTIFICATION_TEMPLATE_MANAGE: 'notification_template.manage',
  CONVERSATION_READ: 'conversation.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
