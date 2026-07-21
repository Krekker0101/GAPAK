import { apiClient } from "@/shared/api/client";
import type { AcceptedResponse } from "@/shared/types/auth";
import type {
  AddRoomMemberRequest,
  CreateTrustRoomRequest,
  TrustRoomDetailResponse,
  TrustRoomResponse,
} from "@/shared/types/room";

export const roomService = {
  listRooms() {
    return apiClient<TrustRoomResponse[]>({
      path: "/trust-rooms",
    });
  },
  getRoom(roomId: string) {
    return apiClient<TrustRoomDetailResponse>({
      path: `/trust-rooms/${roomId}`,
    });
  },
  create(payload: CreateTrustRoomRequest) {
    return apiClient<TrustRoomResponse>({
      path: "/trust-rooms",
      method: "POST",
      body: payload,
    });
  },
  addMember(roomId: string, payload: AddRoomMemberRequest) {
    return apiClient<AcceptedResponse>({
      path: `/trust-rooms/${roomId}/members`,
      method: "POST",
      body: payload,
    });
  },
};
