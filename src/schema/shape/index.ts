import { z } from 'zod';
import { ShapeComponentSchema } from './components';
import { ShapeTypeEnum } from './enums';

export * from './components';
export * from './enums';

export const CreateShapeInputSchema = z.object({
    identifier: z.string().optional(),
    name: z.string().min(1),
    tenantId: z.string().min(1),
    type: ShapeTypeEnum,
    meta: z.record(z.string()).optional(),
    components: z.array(ShapeComponentSchema).optional(),
});

export const UpdateShapeInputSchema = z.object({
    name: z.string(),
    meta: z.record(z.string()).optional(),
    components: z.array(ShapeComponentSchema).optional(),
});

export type CreateShapeInput = z.infer<typeof CreateShapeInputSchema>;
export type UpdateShapeInput = z.infer<typeof UpdateShapeInputSchema>;