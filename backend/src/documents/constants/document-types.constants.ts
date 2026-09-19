// backend/src/documents/constants/document-types.constants.ts
/**
 * Valeurs conventionnelles pour Document.type (champ texte libre en base —
 * voir le commentaire du modèle Document dans schema.prisma : "ex:
 * national_id, driver_license, vehicle_registration"). Centralisées ici
 * pour que toute vérification côté backend (ex: DriverProfilesService.verify)
 * référence ces constantes plutôt que des chaînes libres.
 *
 * VEHICLE_REGISTRATION et VEHICLE_INSURANCE sont confirmés par des
 * documents réellement envoyés en production (vus dans le back-office).
 * DRIVER_LICENSE et NATIONAL_ID reprennent la convention documentée dans
 * schema.prisma mais n'ont pas encore été confirmés par un envoi réel côté
 * pièces d'identité chauffeur — à vérifier (Prisma Studio, table
 * documents, colonne type) si un chauffeur reste bloqué à tort.
 */
export const DOCUMENT_TYPES = {
  NATIONAL_ID: 'national_id',
  DRIVER_LICENSE: 'driver_license',
  VEHICLE_REGISTRATION: 'vehicle_registration',
  VEHICLE_INSURANCE: 'vehicle_insurance',
} as const;

export type DocumentTypeKey = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];