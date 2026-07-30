import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

/**
 * NextAuth Type Augmentation for cssberlin.de
 * Extends the default session/token to include user ID and role
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      username?: string | null;
      isVerified?: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    username?: string | null;
    isVerified?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    username?: string | null;
    isVerified?: boolean;
  }
}
