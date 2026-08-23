import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Automatic suspension for volume abuse.
 *
 * Two deliberate design choices, both learned the hard way:
 *
 * 1. The counter is the shared rateLimit() store (Upstash Redis when
 *    configured), not a module-level Map. A Map lives inside one Node process:
 *    it empties on every container restart and a second app instance counts
 *    separately, so an attacker only has to spread requests across replicas to
 *    stay under any threshold. Redis is the only place the count means
 *    something.
 *
 * 2. Thresholds are set where no human being can reach them, and only for
 *    *authenticated, volume* actions. A false positive here locks a paying
 *    customer out of their account, and the only way back in is an admin
 *    flipping the switch by hand. Failed logins deliberately do NOT feed this:
 *    banning an account because someone else guessed its password wrong is an
 *    account-lockout attack handed to the attacker for free. Brute force is
 *    handled where it belongs, by the AUTH rate limit on the login handler.
 *
 * Every automatic suspension is written to the server log with the reason. The
 * admin panel's user list is the reversal path (Sperren / Entsperren).
 */

/** Which rate-limit tier holds the ceiling for each tracked action. */
const ABUSE_TIERS = {
  message: 'ABUSE_MESSAGE',
  offer: 'ABUSE_OFFER',
} as const;

export type AbuseAction = keyof typeof ABUSE_TIERS;

export async function suspendUser(userId: string, reason: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true, role: true },
    });

    // An admin must never be locked out by an automated rule, and re-suspending
    // an already suspended account is a pointless write.
    if (!user || user.isSuspended || user.role === 'ADMIN') return false;

    await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
    console.warn(`[ABUSE_MONITOR] auto-suspended ${userId}: ${reason}`);
    return true;
  } catch (error) {
    console.error('[ABUSE_MONITOR] suspend failed:', error);
    return false;
  }
}

/**
 * Records one action and suspends the account once the hourly ceiling is
 * crossed. Returns true when this call caused the suspension.
 *
 * Counting failures must never block a legitimate action, so any error here is
 * swallowed - the request continues, we just lose one tick.
 */
export async function recordAction(userId: string, action: AbuseAction): Promise<boolean> {
  try {
    // rateLimit() reports success while the count is at or below the ceiling,
    // so the first `false` is exactly the moment the ceiling was crossed.
    const result = await rateLimit(`abuse:${action}:${userId}`, ABUSE_TIERS[action]);
    if (result.success) return false;

    return await suspendUser(
      userId,
      `more than ${result.limit} ${action} actions within an hour`
    );
  } catch (error) {
    console.error('[ABUSE_MONITOR] recordAction failed:', error);
    return false;
  }
}
