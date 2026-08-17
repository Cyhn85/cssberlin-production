import prisma from '@/lib/db';

/**
 * Persona (pool) seller accounts are real User rows nobody logs into directly
 * (passwordHash is always null, no OAuth account linked). Every action taken
 * "as" a persona is actually performed by its managing real user, authorized
 * here. This never allows automated/unattended replies — it only decides
 * whether the currently signed-in human is allowed to act as targetUserId.
 */
export type ActingIdentityResult =
  | { allowed: true; actingId: string; isPersona: boolean }
  | { allowed: false; actingId: null; isPersona: false };

export async function resolveActingIdentity(
  sessionUserId: string,
  targetUserId: string
): Promise<ActingIdentityResult> {
  if (sessionUserId === targetUserId) {
    return { allowed: true, actingId: targetUserId, isPersona: false };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPersonaAccount: true, managedByUserId: true },
  });

  if (target?.isPersonaAccount && target.managedByUserId === sessionUserId) {
    return { allowed: true, actingId: targetUserId, isPersona: true };
  }

  return { allowed: false, actingId: null, isPersona: false };
}

/**
 * Loads a persona and verifies sessionUserId manages it. Returns null if not
 * a persona or not managed by this user.
 */
export async function requireManagedPersona(sessionUserId: string, personaId: string) {
  const persona = await prisma.user.findUnique({
    where: { id: personaId },
    select: { id: true, name: true, avatar: true, username: true, isPersonaAccount: true, managedByUserId: true },
  });

  if (!persona?.isPersonaAccount || persona.managedByUserId !== sessionUserId) {
    return null;
  }

  return persona;
}
