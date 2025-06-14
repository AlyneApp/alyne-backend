import { z } from 'zod';

// Request schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(2, 'Username is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordConfirmSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  token: z.string().optional(),
});

export type AuthResponse = {
  user?: {
    id: string;
    email: string;
    username?: string;
  };
  error?: string;
  message?: string;
};

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmRequest = z.infer<typeof resetPasswordConfirmSchema>; 