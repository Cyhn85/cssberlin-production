import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { CssBerlinAdapter } from '@/lib/auth/adapter';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sendEmail, magicLinkEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

/**
 * How long a JWT may keep serving a cached copy of role / isSuspended.
 *
 * These two fields used to be written once, at sign-in, and never again. A JWT
 * session carries no server-side record, so suspending an account that was
 * already logged in changed nothing: the user's token still said
 * `isSuspended: false` and the middleware waved them through until the token
 * expired - up to 30 days. Same for a revoked ADMIN role.
 *
 * Re-reading on *every* request would put a database round-trip in front of
 * each page load. 60 seconds is the compromise: a ban takes effect within a
 * minute, at roughly one extra query per user per minute.
 */
const CLAIMS_MAX_AGE_MS = 60 * 1000;

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
// Magic-link login only when mail can actually be delivered (Resend). Without it the button sent nothing.
const emailLoginEnabled = Boolean(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
    adapter: CssBerlinAdapter(prisma as any),
    session: {
        strategy: 'jwt',
        // Default updateAge is 24h: the cookie is only re-issued once a day, so
        // the refreshed claims from the jwt callback would sit in memory and
        // never reach the browser. 60s matches CLAIMS_MAX_AGE_MS below.
        updateAge: 60,
    },
    pages: {
        signIn: '/login',
        verifyRequest: '/verify-request',
        // every auth failure lands on the login page with ?error=CODE (shown as a readable message there)
        error: '/login',
    },
    providers: [
        ...(googleEnabled
            ? [
                  GoogleProvider({
                      clientId: process.env.GOOGLE_CLIENT_ID as string,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                      // A user who registered with e-mail + password and later clicks "Mit Google fortfahren"
                      // used to get OAuthAccountNotLinked. Linking by e-mail is safe here ONLY because Google
                      // proves ownership of the address; the signIn callback rejects unverified Google e-mails.
                      allowDangerousEmailAccountLinking: true,
                  }),
              ]
            : []),
        ...(emailLoginEnabled ? [EmailProvider({
            from: process.env.EMAIL_FROM || 'cssberlin.de <noreply@cssberlin.de>',
            maxAge: 24 * 60 * 60,
            // GHSA-7rqj-j65f-68wh (Auth.js homoglyph "@" bypass): next-auth v4 ships an @auth/core that validates the
            // address BEFORE Unicode normalisation. Normalise first and accept only plain ASCII addresses with exactly
            // one "@", so a look-alike address can never be mapped onto someone else's account.
            normalizeIdentifier(identifier: string): string {
                const email = identifier.normalize('NFKC').trim().toLowerCase();
                if (!/^[\x21-\x7e]+$/.test(email) || email.split('@').length !== 2 || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) {
                    throw new Error('Ungültige E-Mail-Adresse.');
                }
                return email;
            },
            // Bypasses nodemailer entirely - reuses the same Resend-backed
            // sendEmail() and branded template every other transactional
            // email on the site already goes through.
            async sendVerificationRequest({ identifier: email, url }) {
                await sendEmail({
                    ...magicLinkEmail(url),
                    to: email,
                });
            },
        })] : []),
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials, req) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Bitte fülle alle Felder aus.');
                }

                // Password login was the one unthrottled entrance left: every
                // other sensitive route goes through rateLimit(), but NextAuth
                // owns this handler so /api/auth/callback/credentials never
                // reached our middleware. Without this, an attacker can try
                // passwords as fast as bcrypt answers. Keyed by IP *and* email
                // so one attacker cannot lock out an unrelated account by
                // burning that account's budget from a different address.
                const forwarded = req?.headers?.['x-forwarded-for'];
                const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
                    || (req?.headers?.['x-real-ip'] as string | undefined)
                    || '127.0.0.1';
                const throttle = await rateLimit(`${ip}:${credentials.email.toLowerCase()}`, 'AUTH');
                if (!throttle.success) {
                    throw new Error('Zu viele Anmeldeversuche. Bitte warte eine Minute.');
                }

                const user = await prisma.user.findFirst({
                    where: { email: { equals: credentials.email.trim(), mode: 'insensitive' } },
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
        async signIn({ user, account, profile }) {
            // Google: only verified addresses may sign in (this is what makes e-mail account linking safe)
            if (account?.provider === 'google' && (profile as any)?.email_verified !== true) {
                return '/login?error=GoogleEmailNotVerified';
            }
            if (!user?.email) return true;
            const existing = await prisma.user.findFirst({
                where: { email: { equals: user.email, mode: 'insensitive' } },
                select: { isSuspended: true },
            });
            if (existing?.isSuspended) return '/login?suspended=1';
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
                token.picture = (user as any).image || (user as any).avatar || token.picture;
                token.claimsAt = Date.now();
                return token;
            }

            if (!token.id) return token;

            const claimsAt = typeof token.claimsAt === 'number' ? token.claimsAt : 0;
            if (Date.now() - claimsAt < CLAIMS_MAX_AGE_MS) return token;

            try {
                const fresh = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { role: true, username: true, isVerified: true, isSuspended: true, avatar: true },
                });

                if (fresh) {
                    token.role = fresh.role;
                    token.username = fresh.username;
                    token.isVerified = fresh.isVerified;
                    token.isSuspended = fresh.isSuspended;
                    // header avatar follows uploads within a minute
                    token.picture = fresh.avatar || token.picture;
                } else {
                    // Account deleted while the token was still valid. Treat it
                    // as suspended rather than trusting stale claims - the
                    // middleware then blocks every protected route.
                    token.isSuspended = true;
                    token.role = 'USER';
                }
                token.claimsAt = Date.now();
                // "zuletzt online" for the seller box - piggybacks on this once-a-minute refresh
                prisma.user.update({ where: { id: token.id as string }, data: { lastSeenAt: new Date() } }).catch(() => {});
            } catch (error) {
                // A database blip must not sign everyone out. Keep the existing
                // claims and retry on the next request; claimsAt is left
                // untouched on purpose so the retry happens immediately.
                console.error('jwt claim refresh failed:', error);
            }

            return token;
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

