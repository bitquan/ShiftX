// Type for rebooking a previous trip
export type RebookPayload = {
  pickup: { lat: number; lng: number; label?: string };
  dropoff: { lat: number; lng: number; label?: string };
  serviceClass?: 'shiftx' | 'shift_lx' | 'shift_black';
  priceCents?: number; // optional, display only
};
