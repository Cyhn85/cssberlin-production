import { z } from 'zod/v4';

// ══════════ PRODUCT SCHEMAS ══════════

export const conditionValues = [
  'NEW_WITH_TAGS',
  'NEW_WITHOUT_TAGS',
  'VERY_GOOD',
  'GOOD',
  'ACCEPTABLE',
] as const;

export const productStatusValues = [
  'DRAFT',
  'ACTIVE',
  'HIDDEN',
  'RESERVED',
  'SOLD',
] as const;

/**
 * Schema for creating a new product listing
 */
export const createProductSchema = z.object({
  title: z
    .string()
    .min(3, 'Titel muss mindestens 3 Zeichen lang sein.')
    .max(100, 'Titel darf maximal 100 Zeichen lang sein.'),
  description: z
    .string()
    .max(2000, 'Beschreibung darf maximal 2000 Zeichen lang sein.')
    .optional(),
  price: z
    .number()
    .positive('Preis muss positiv sein.')
    .max(10000, 'Maximaler Preis ist 10.000€.'),
  originalPrice: z
    .number()
    .positive('Originalpreis muss positiv sein.')
    .optional(),
  categoryId: z.string().min(1, 'Bitte wähle eine Kategorie.'),
  condition: z.enum(conditionValues, {
    message: 'Bitte wähle den Zustand des Artikels.',
  }),
  size: z.string().optional(),
  brand: z.string().max(50, 'Marke darf maximal 50 Zeichen lang sein.').optional(),
  shippingCost: z.number().min(0).default(0),
  imageUrls: z
    .array(z.string().url('Ungültige Bild-URL.'))
    .min(1, 'Mindestens 1 Foto ist erforderlich.')
    .max(12, 'Maximal 12 Fotos erlaubt.'),
  allowOffers: z.boolean().default(true),
  status: z.enum(productStatusValues).default('ACTIVE'),
});

/**
 * Schema for updating an existing product
 */
export const updateProductSchema = createProductSchema.partial().omit({
  imageUrls: true,
});

// ══════════ OFFER SCHEMAS ══════════

/**
 * Schema for creating a price offer (Pazarlık)
 * Implements Vinted's 60% minimum rule
 */
export const createOfferSchema = z.object({
  productId: z.string().min(1, 'Produkt-ID ist erforderlich.'),
  offeredPrice: z
    .number()
    .positive('Angebotspreis muss positiv sein.'),
  message: z
    .string()
    .max(500, 'Nachricht darf maximal 500 Zeichen lang sein.')
    .optional(),
});

/**
 * Schema for responding to an offer (accept/reject/counter)
 */
export const respondOfferSchema = z.object({
  action: z.enum(['accept', 'reject', 'counter'], {
    message: 'Ungültige Aktion.',
  }),
  counterPrice: z
    .number()
    .positive('Gegenangebotspreis muss positiv sein.')
    .optional(),
});

// ══════════ MESSAGE SCHEMAS ══════════

export const messageTypeValues = [
  'TEXT',
  'IMAGE',
  'OFFER_ACTION',
  'SYSTEM_INFO',
] as const;

/**
 * Schema for sending a message
 */
export const createMessageSchema = z.object({
  receiverId: z.string().min(1, 'Empfänger-ID ist erforderlich.'),
  content: z
    .string()
    .min(1, 'Nachricht darf nicht leer sein.')
    .max(2000, 'Nachricht darf maximal 2000 Zeichen lang sein.'),
  type: z.enum(messageTypeValues).default('TEXT'),
  offerId: z.string().optional(),
});

// ══════════ USER SCHEMAS ══════════

/**
 * Schema for updating user profile
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen lang sein.')
    .max(50, 'Name darf maximal 50 Zeichen lang sein.')
    .optional(),
  username: z
    .string()
    .min(3, 'Benutzername muss mindestens 3 Zeichen lang sein.')
    .max(30, 'Benutzername darf maximal 30 Zeichen lang sein.')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten.')
    .optional(),
  bio: z
    .string()
    .max(300, 'Bio darf maximal 300 Zeichen lang sein.')
    .optional(),
  location: z
    .string()
    .max(100, 'Standort darf maximal 100 Zeichen lang sein.')
    .optional(),
  avatar: z.string().url('Ungültige Avatar-URL.').optional(),
});

/**
 * Schema for user registration
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen lang sein.')
    .max(50),
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse.'),
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein.')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten.')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten.'),
});

// ══════════ ORDER SCHEMAS ══════════

export const orderStatusValues = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED',
] as const;

/**
 * Schema for creating an order
 */
export const createOrderSchema = z.object({
  productId: z.string().min(1),
  offerId: z.string().optional(),
  shippingMethod: z.enum(['DHL', 'Hermes', 'DPD']),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().regex(/^\d{5}$/, 'PLZ muss 5 Ziffern haben.'),
    country: z.string().default('DE'),
  }),
  hasBuyerProtection: z.boolean().default(true),
});

/**
 * Schema for updating order status (shipping info)
 */
export const updateOrderSchema = z.object({
  status: z.enum(orderStatusValues).optional(),
  trackingCode: z.string().optional(),
  shippingCarrier: z.string().optional(),
  shippingLabelUrl: z.string().url().optional(),
});

// ══════════ REVIEW SCHEMAS ══════════

/**
 * Schema for creating a review
 */
export const createReviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z
    .number()
    .int()
    .min(1, 'Bewertung muss mindestens 1 Stern sein.')
    .max(5, 'Bewertung darf maximal 5 Sterne sein.'),
  comment: z
    .string()
    .max(1000, 'Kommentar darf maximal 1000 Zeichen lang sein.')
    .optional(),
});

// ══════════ SEARCH SCHEMAS ══════════

/**
 * Schema for search/filter params
 */
export const searchParamsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  condition: z.enum(conditionValues).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// ══════════ BUNDLE DISCOUNT SCHEMA ══════════

export const updateBundleDiscountSchema = z.object({
  isActive: z.boolean(),
  twoItems: z.number().min(0).max(50).optional(),
  threeItems: z.number().min(0).max(50).optional(),
  fiveItems: z.number().min(0).max(50).optional(),
});

// ══════════ TYPE EXPORTS ══════════

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type RespondOfferInput = z.infer<typeof respondOfferSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
export type UpdateBundleDiscountInput = z.infer<typeof updateBundleDiscountSchema>;
