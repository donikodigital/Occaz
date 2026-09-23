// mobile/src/types/ratings.types.ts
// [22/09/2026] v+ — GivenRating (« Mes avis »).
export interface CreateRatingPayload {
  score: number;
  comment?: string;
  punctuality?: number;
  respect?: number;
  communication?: number;
  reliability?: number;
  vehicleCondition?: number;
}

export interface Review {
  id: string;
  ratingId: string;
  comment: string | null;
  punctuality: number | null;
  respect: number | null;
  communication: number | null;
  reliability: number | null;
  vehicleCondition: number | null;
}

export interface Rating {
  id: string;
  role: 'CUSTOMER_TO_DRIVER' | 'DRIVER_TO_CUSTOMER';
  fromUserId: string;
  toUserId: string;
  bookingId: string | null;
  shipmentId: string | null;
  score: number;
  review?: Review | null;
  createdAt: string;
}

/** Une notation donnée par l'utilisateur ("Mes avis") — jamais le profil complet noté. */
export interface GivenRating {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  targetName: string;
  targetPhotoUrl: string | null;
  context: { type: 'trip' | 'shipment'; route: string; date: string } | null;
}