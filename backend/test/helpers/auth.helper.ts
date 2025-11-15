import { JwtService } from '@nestjs/jwt';

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(userId: string, email: string): string {
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests-only',
    signOptions: { expiresIn: '1h' },
  });

  return jwtService.sign({
    sub: userId,
    email,
  });
}

/**
 * Get authorization header with test JWT token
 */
export function getAuthHeader(userId: string, email: string): { Authorization: string } {
  const token = generateTestToken(userId, email);
  return {
    Authorization: `Bearer ${token}`,
  };
}
