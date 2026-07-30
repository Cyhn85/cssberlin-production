/**
 * Pusher Real-time Server Instance for cssberlin.de
 *
 * Free tier: 200K messages/day, 100 concurrent connections
 * Used for: real-time messaging, notifications, offer updates
 */

import { CHANNELS, EVENTS } from '@/lib/realtime';

export { CHANNELS, EVENTS } from '@/lib/realtime';

let pusherServer: any = null;

/**
 * Get Pusher server instance (lazy initialization)
 */
export async function getPusher() {
  if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET) {
    return null;
  }

  if (!pusherServer) {
    const Pusher = (await import('pusher')).default;
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || 'eu',
      useTLS: true,
    });
  }

  return pusherServer;
}

export async function triggerEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const pusher = await getPusher();
  if (!pusher) {
    return;
  }

  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.warn('Pusher trigger failed:', error);
  }
}