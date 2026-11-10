export interface ApiSuccess<TData, TMeta extends Record<string, unknown> = Record<string, never>> {
  success: true;
  data: TData;
  meta: TMeta;
  requestId: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
  requestId: string;
}

export type ApiResponse<TData, TMeta extends Record<string, unknown> = Record<string, never>> =
  | ApiSuccess<TData, TMeta>
  | ApiFailure;

export interface PaginationMeta extends Record<string, unknown> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}