import { createRouteHandler } from 'uploadthing/next';
import { ourFileRouter } from './core';

/**
 * Uploadthing Route Handler
 * Handles file upload requests at /api/uploadthing
 */
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
