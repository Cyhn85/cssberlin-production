import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters';
import type { PrismaClient, User } from '@/generated/prisma';

/**
 * Adapter between NextAuth's standard user shape and our own `User` model.
 *
 * Why this exists (2026-10-20): Google sign-in never worked. On the first OAuth
 * login NextAuth asks the adapter to create a user with `{ name, email, image,
 * emailVerified }`. Our schema stores the picture in `avatar` and verification in
 * `isVerified` and has neither `image` nor `emailVerified`, so Prisma rejected the
 * insert and the callback failed - the Account table stayed empty. Password login
 * kept working because it never touches the adapter.
 *
 * Mapping:   image <-> avatar,   emailVerified (Date) <-> isVerified (boolean).
 * Emails are stored and looked up lower-cased, so "Anna@X.de" from Google finds the
 * account registered as "anna@x.de" instead of creating a duplicate.
 */
function toAdapterUser(u: User | null): AdapterUser | null {
    if (!u) return null;
    return {
        ...(u as any),
        id: u.id,
        email: u.email,
        name: u.name,
        image: u.avatar,
        emailVerified: u.isVerified ? u.updatedAt ?? new Date() : null,
    };
}

function toDbData(data: Partial<AdapterUser> & Record<string, any>) {
    const { image, emailVerified, id: _id, ...rest } = data;
    const out: Record<string, any> = {};
    if (rest.name !== undefined) out.name = rest.name;
    if (rest.email !== undefined && rest.email !== null) out.email = String(rest.email).trim().toLowerCase();
    if (image !== undefined) out.avatar = image;
    if (emailVerified) out.isVerified = true;
    return out;
}

export function CssBerlinAdapter(prisma: PrismaClient): Adapter {
    const base = PrismaAdapter(prisma as any) as unknown as Adapter;
    return {
        ...base,
        async createUser(data: AdapterUser) {
            const user = await prisma.user.create({ data: toDbData(data as any) as any });
            return toAdapterUser(user) as AdapterUser;
        },
        async linkAccount(account: AdapterAccount) {
            // Providers return token fields our Account model does not have (Google: refresh_token_expires_in,
            // sometimes others). Passing them through made Prisma reject the insert; keep only schema columns.
            const a = account as Record<string, any>;
            await prisma.account.create({
                data: {
                    userId: a.userId, type: a.type, provider: a.provider, providerAccountId: a.providerAccountId,
                    refresh_token: a.refresh_token ?? null, access_token: a.access_token ?? null,
                    expires_at: typeof a.expires_at === 'number' ? Math.floor(a.expires_at) : null,
                    token_type: a.token_type ?? null, scope: a.scope ?? null, id_token: a.id_token ?? null,
                    session_state: a.session_state != null ? String(a.session_state) : null,
                },
            });
            return account;
        },
        async getUser(id) {
            return toAdapterUser(await prisma.user.findUnique({ where: { id } }));
        },
        async getUserByEmail(email) {
            const user = await prisma.user.findFirst({
                where: { email: { equals: email.trim(), mode: 'insensitive' } },
            });
            return toAdapterUser(user);
        },
        async getUserByAccount({ provider, providerAccountId }) {
            const account = await prisma.account.findUnique({
                where: { provider_providerAccountId: { provider, providerAccountId } },
                include: { user: true },
            });
            return toAdapterUser(account?.user ?? null);
        },
        async updateUser(data) {
            const { id } = data as { id: string };
            // never let a provider profile overwrite an avatar the user chose; only fill an empty one
            const current = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
            const patch = toDbData(data as any);
            if (current?.avatar) delete patch.avatar;
            const user = await prisma.user.update({ where: { id }, data: patch as any });
            return toAdapterUser(user) as AdapterUser;
        },
    };
}
