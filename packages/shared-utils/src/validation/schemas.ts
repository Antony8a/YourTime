// Zod Schemas
import { z } from 'zod';

export const emailSchema = z.string().email('Email inválido').min(1).max(255);

export const phoneSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Formato de teléfono inválido (use +5491123456789)')
  .max(20);

export const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .regex(/[a-z]/, 'Debe contener minúsculas')
  .regex(/[A-Z]/, 'Debe contener mayúsculas')
  .regex(/\d/, 'Debe contener números')
  .regex(/[^a-zA-Z0-9]/, 'Debe contener símbolos');

export const nameSchema = z.string()
  .min(2, 'Mínimo 2 caracteres')
  .max(150)
  .regex(/^[\p{L}\s'-]+$/u, 'Solo letras, espacios, guiones y apóstrofes');

export const taskTitleSchema = z.string()
  .min(5, 'Mínimo 5 caracteres')
  .max(200);

export const taskDescriptionSchema = z.string()
  .min(10, 'Mínimo 10 caracteres')
  .max(5000);

export const tokensAmountSchema = z.number()
  .int('Debe ser un número entero')
  .positive('Debe ser positivo')
  .max(1_000_000, 'Máximo 1,000,000 tokens');

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const addressSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
  city: z.string().max(100).min(1),
});

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const dateRangeSchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
}).refine(
  (data) => !data.date_from || !data.date_to || data.date_from <= data.date_to,
  { message: 'date_from debe ser anterior a date_to', path: ['date_from'] }
);

// Auth Schemas
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: nameSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  remember_me: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

// Task Schemas
export const createTaskSchema = z.object({
  category_id: z.string().uuid(),
  skill_id: z.string().uuid().optional(),
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  location_address: z.string().max(500).optional(),
  location_city: z.string().max(100).min(1),
  budget_min_tokens: tokensAmountSchema,
  budget_max_tokens: tokensAmountSchema,
  budget_type: z.enum(['fixed', 'hourly', 'negotiable']).default('fixed'),
  estimated_hours: z.number().positive().max(1000).optional(),
  preferred_date: z.string().date().optional(),
  preferred_time_start: z.string().time().optional(),
  preferred_time_end: z.string().time().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
}).refine(
  (data) => data.budget_min_tokens <= data.budget_max_tokens,
  { message: 'budget_min_tokens debe ser <= budget_max_tokens', path: ['budget_min_tokens'] }
);

export const updateTaskSchema = z.object({
  title: taskTitleSchema.optional(),
  description: taskDescriptionSchema.optional(),
  budget_min_tokens: tokensAmountSchema.optional(),
  budget_max_tokens: tokensAmountSchema.optional(),
  preferred_date: z.string().date().optional(),
}).refine(
  (data) => !data.budget_min_tokens || !data.budget_max_tokens || data.budget_min_tokens <= data.budget_max_tokens,
  { message: 'budget_min_tokens debe ser <= budget_max_tokens', path: ['budget_min_tokens'] }
);

export const taskFiltersSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled', 'disputed']).optional(),
  category_id: z.string().uuid().optional(),
  skill_id: z.string().uuid().optional(),
  city: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius_km: z.number().positive().max(100).optional(),
  budget_min: tokensAmountSchema.optional(),
  budget_max: tokensAmountSchema.optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  sort: z.enum(['created_desc', 'budget_asc', 'distance']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

// Token Schemas
export const purchaseIntentSchema = z.object({
  package_tokens: z.number().int().positive(),
  payment_provider: z.enum(['stripe', 'mercadopago']),
});

export const withdrawalSchema = z.object({
  tokens_amount: tokensAmountSchema,
  payout_method: z.enum(['bank_transfer', 'paypal', 'mercadopago']),
  payout_details: z.record(z.unknown()),
});

// Message Schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['text', 'image', 'file', 'system', 'offer']).default('text'),
  metadata: z.record(z.unknown()).optional(),
});