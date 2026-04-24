import { ApiError } from "../api/client";

function serializeError(error: unknown): unknown {
  if (error instanceof ApiError) {
    return {
      type: error.name,
      status: error.status,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return error;
}

export function logWebError(scope: string, error: unknown): void {
  console.error(`[web] ${scope}`, serializeError(error));
}

export function logWebWarning(scope: string, error: unknown): void {
  console.warn(`[web] ${scope}`, serializeError(error));
}
