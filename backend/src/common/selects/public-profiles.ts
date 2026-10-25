// backend/src/common/selects/public-profiles.ts
//
// [25/10/2026] v1 — Champs d'un profil qu'on peut montrer à l'autre partie d'un trajet ou d'une réservation (et dans les recherches).
// Jamais `driver: true` ni `customer: true` dans une réponse destinée à un utilisateur : la ligne complète d'un profil contient des données
// privées (date de naissance, numéro Mobile Money, référence bancaire du conducteur ; adresse et date de naissance du client).
// Les écrans d'administration qui ont besoin de plus passent par les routes /driver-profiles et /customer-profiles, protégées par permission.
import type { Prisma } from '@prisma/client';

/** Ce que le client voit d'un conducteur : identité affichée, statut, badge et réputation. */
export const PUBLIC_DRIVER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  status: true,
  isVerifiedBadge: true,
  averageRating: true,
  ratingsCount: true,
  completedTripsCount: true,
  completedShipmentsCount: true,
} satisfies Prisma.DriverProfileSelect;

/** Ce que le conducteur voit d'un client : son nom et sa photo — ni adresse, ni date de naissance. */
export const PUBLIC_CUSTOMER_SELECT = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
} satisfies Prisma.CustomerProfileSelect;
