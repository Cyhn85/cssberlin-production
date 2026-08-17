import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sendEmail, magicLinkEmail } from '@/lib/email';

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as any,
    session: {
        strategy: 'jwt',
    },
    pages: {
        signIn: '/login',
        verifyRequest: '/verify-request',
    },
    providers: [
        ...(googleEnabled
            ? [
                  GoogleProvider({
                      clientId: process.env.GOOGLE_CLIENT_ID as string,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                  }),
              ]
            : []),
        EmailProvider({
            from: process.env.EMAIL_FROM || 'cssberlin.de <noreply@cssberlin.de>',
            maxAge: 24 * 60 * 60,
            // Bypasses nodemailer entirely - reuses the same Resend-backed
            // sendEmail() and branded template every other transactional
            // email on the site already goes through.
            async sendVerificationRequest({ identifier: email, url }) {
                await sendEmail({
                    ...magicLinkEmail(url),
                    to: email,
                });
            },
        }),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Bitte fülle alle Felder aus.');
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !user.passwordHash) {
                    throw new Error('E-Mail oder Passwort ist falsch.');
                }

                const isPasswordCorrect = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                );

                if (!isPasswordCorrect) {
                    throw new Error('E-Mail oder Passwort ist falsch.');
                }

                if (user.isSuspended) {
                    throw new Error('Dieses Konto wurde gesperrt. Kontaktiere den Support, falls du Fragen hast.');
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.avatar,
                    role: user.role,
                    username: user.username,
                    isVerified: user.isVerified,
                    isSuspended: user.isSuspended,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            if (!user?.email) return true;
            const existing = await prisma.user.findUnique({
                where: { email: user.email },
                select: { isSuspended: true },
            });
            if (existing?.isSuspended) return false;
            return true;
        },
        async session({ token, session }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.username = token.username as string | null;
                session.user.isVerified = token.isVerified as boolean;
                session.user.isSuspended = token.isSuspended as boolean;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role || 'USER';
                token.username = (user as any).username || null;
                token.isVerified = (user as any).isVerified || false;
                token.isSuspended = (user as any).isSuspended || false;
            }
            return token;
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
