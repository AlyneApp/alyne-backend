import { NextResponse } from 'next/server';
import { AuthResponse } from '../types/auth';

export const createSuccessResponse = (data: Partial<AuthResponse> = {}) => {
  return NextResponse.json({
    ...data,
    success: true,
  });
};

export const createErrorResponse = (error: string, status: number = 400) => {
  return NextResponse.json(
    {
      error,
      success: false,
    },
    { status }
  );
};

export const createValidationError = (error: string) => {
  return createErrorResponse(error, 400);
};

export const createAuthError = (error: string) => {
  return createErrorResponse(error, 401);
};

export const createServerError = (error: string) => {
  return createErrorResponse(error, 500);
}; 