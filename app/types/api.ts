export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  count: number;
  total: number;
  limit: number;
  offset: number;
}

export interface SingleResponse<T> {
  success: boolean;
  data: T;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
