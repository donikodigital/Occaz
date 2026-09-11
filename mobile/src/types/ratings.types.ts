// mobile/src/types/ratings.types.ts
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
