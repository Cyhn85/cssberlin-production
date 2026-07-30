/**
 * Uploadthing Client Configuration for cssberlin.de
 *
 * Provides React hooks for file uploads
 * Free tier: 2GB storage, 2GB bandwidth/month
 */

import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/app/api/uploadthing/core';

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();
