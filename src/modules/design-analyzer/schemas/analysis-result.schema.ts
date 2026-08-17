import { z } from 'zod';

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const SectionStylesSchema = z
  .object({
    background_color: z.string().optional(),
    text_color: z.string().optional(),
    primary_color: z.string().optional(),
    secondary_color: z.string().optional(),
  })
  .optional();

export const LayoutSectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  order: z.number().int().optional(),
  bounds: BoundsSchema,
  styles: SectionStylesSchema,
});

export const LayoutDataSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  sections: z.array(LayoutSectionSchema),
});

export const PlaceholderSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'image', 'link', 'button']),
  role: z.string().min(1),
  section_id: z.string().min(1),
  bounds: BoundsSchema,
  content_hint: z.string().optional(),
});

export const PlaceholdersDataSchema = z.array(PlaceholderSchema);

export const AnalysisResultSchema = z.object({
  layout: LayoutDataSchema,
  placeholders: PlaceholdersDataSchema,
});

export type Bounds = z.infer<typeof BoundsSchema>;
export type LayoutSection = z.infer<typeof LayoutSectionSchema>;
export type LayoutData = z.infer<typeof LayoutDataSchema>;
export type Placeholder = z.infer<typeof PlaceholderSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
