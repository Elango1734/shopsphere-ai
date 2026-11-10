import { z } from 'zod';
import { listQuerySchema } from './common.js';

export const notificationQuerySchema = listQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional()
});
