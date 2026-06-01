export type ApiMeta = {
  requestId?: string;
  pagination?: Record<string, unknown>;
};

export type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiErrorEnvelope = {
  success: false;
  error: ApiErrorPayload;
  meta?: ApiMeta;
};

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(payload: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    requestId?: string;
  }) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = payload.status;
    this.details = payload.details;
    this.requestId = payload.requestId;
  }
}

export type ListQuery = {
  page?: number;
  limit?: number;
};
