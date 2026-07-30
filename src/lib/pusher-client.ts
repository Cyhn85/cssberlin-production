'use client';

import Pusher from 'pusher-js';

let pusherClient: Pusher | null | undefined;

export function getPusherClient() {
  if (pusherClient !== undefined) {
    return pusherClient;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) {
    pusherClient = null;
    return pusherClient;
  }

  pusherClient = new Pusher(key, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'eu',
    forceTLS: true,
    channelAuthorization: {
      endpoint: '/api/pusher/auth',
      transport: 'ajax',
    },
  });

  return pusherClient;
}