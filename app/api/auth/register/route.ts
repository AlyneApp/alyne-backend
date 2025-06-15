import { NextRequest } from 'next/server';
import { withAuth } from '../../common/middleware/auth';
import { registerSchema } from '../../common/types/auth';
import { createSuccessResponse, createValidationError, createServerError } from '../../common/utils/response';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, supabase) => {
    try {
      const body = await req.json();
      
      // Validate request body
      const result = registerSchema.safeParse(body);
      if (!result.success) {
        return createValidationError(result.error.errors[0].message);
      }

      const { email, password, username } = result.data;

      // Create user in Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Registration auth error:', authError);
        return createServerError('Failed to create user account');
      }

      if (!authData.user) {
        return createServerError('User creation failed');
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            username,
            email,
            created_at: new Date().toISOString(),
          },
        ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Attempt to delete the auth user since profile creation failed
        await supabase.auth.admin.deleteUser(authData.user.id);
        return createServerError('Failed to create user profile');
      }

      return createSuccessResponse({
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          username,
        },
        message: 'Registration successful',
      });

    } catch (error) {
      console.error('Unexpected error in registration:', error);
      return createServerError('An unexpected error occurred');
    }
  });
} 