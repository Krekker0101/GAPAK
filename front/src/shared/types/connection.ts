export type ConnectionResponse = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  acceptedAt?: string | null;
  trustedByCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};
