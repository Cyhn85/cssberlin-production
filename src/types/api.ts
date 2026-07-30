/**
 * Shared TypeScript types for cssberlin.de
 * Mirrors Prisma models for client-side use
 */

// ══════════ PRODUCT ══════════

export interface ProductImage {
  id: string;
  url: string;
  orderIndex: number;
}

export interface ProductSeller {
  id: string;
  name: string | null;
  avatar: string | null;
  username?: string | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  emoji?: string | null;
  parent?: { name: string } | null;
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  size: string | null;
  brand: string | null;
  condition: string;
  status: string;
  shippingCost: number;
  views: number;
  likes: number;
  ecoCO2Saved: number;
  categoryId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
  seller: ProductSeller;
  category: ProductCategory;
  _count?: {
    favorites: number;
    offers: number;
  };
}

// ══════════ USER ══════════

export interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  isVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  ecoCO2Saved: number;
  itemsRecycled: number;
  _count: {
    products: number;
    followers: number;
    following: number;
    receivedReviews: number;
    ordersAsSeller: number;
  };
  rating?: number;
  isFollowing?: boolean;
}

export interface UserMe {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  role: string;
  isVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  ecoCO2Saved: number;
  itemsRecycled: number;
  createdAt: string;
}

// ══════════ CATEGORY ══════════

export interface Category {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  parentId: string | null;
  children?: Category[];
  _count?: { products: number };
}

// ══════════ OFFER ══════════

export interface Offer {
  id: string;
  offeredPrice: number;
  status: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  product?: Pick<Product, 'id' | 'title' | 'price' | 'images'>;
  buyer?: ProductSeller;
  seller?: ProductSeller;
}

// ══════════ ORDER ══════════

export interface Order {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  itemPrice: number;
  shippingFee: number;
  protectionFee: number;
  totalAmount: number;
  status: string;
  trackingCode: string | null;
  shippingCarrier: string | null;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
  product: Pick<Product, 'id' | 'title' | 'images' | 'price'>;
  buyer: ProductSeller;
  seller: ProductSeller;
  review?: Review | null;
}

// ══════════ MESSAGE ══════════

export interface Message {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'OFFER_ACTION' | 'SYSTEM_INFO';
  isRead: boolean;
  senderId: string;
  receiverId: string;
  offerId: string | null;
  createdAt: string;
  sender: ProductSeller;
  offer?: {
    id: string;
    offeredPrice: number;
    status: string;
    product: Pick<Product, 'id' | 'title' | 'price' | 'images'>;
  } | null;
}

export interface Conversation {
  partnerId: string;
  partnerName: string | null;
  partnerAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  productImage?: string | null;
}

// ══════════ REVIEW ══════════

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: ProductSeller;
  order?: {
    product: { id: string; title: string };
  };
}

// ══════════ PAGINATION ══════════

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore?: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ══════════ ECO IMPACT ══════════

export interface EcoImpact {
  personal: {
    co2Saved: number;
    waterSaved: number;
    itemsRecycled: number;
    level: string;
    levelEmoji: string;
    equivalents: {
      carKm: number;
      flights: number;
      treesPerYear: number;
      showers: number;
    };
    nextLevel?: {
      name: string;
      itemsNeeded: number;
    };
  };
  monthlyTrend: Array<{
    month: string;
    co2Saved: number;
  }>;
  community: {
    totalUsers: number;
    totalCO2Saved: number;
    totalItemsRecycled: number;
  };
}
