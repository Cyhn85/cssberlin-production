/**
 * Eco Impact Calculator for cssberlin.de
 *
 * Calculates CO2 savings and water savings when buying second-hand
 * Based on real industry data for fashion, electronics, and home goods.
 *
 * Sources:
 * - Fashion: ~16kg CO2 per garment (McKinsey, 2020)
 * - Cotton: ~7,000L water per 1kg cotton
 * - Electronics: EPA lifecycle data
 * - Furniture: IKEA sustainability reports
 */

// ── CO2 Savings (kg) per category ──

const CO2_BY_CATEGORY: Record<string, number> = {
  // Kleidung & Mode
  'Damen': 16.0,
  'Herren': 16.0,
  'Kinder': 8.0,
  'Schuhe': 14.0,
  'Taschen': 12.0,
  'Accessoires': 5.0,
  'Schmuck': 3.0,

  // Kleidung Untertypen
  'Jacken & Mäntel': 25.0,
  'Kleider': 18.0,
  'Hosen': 14.0,
  'Pullover': 16.0,
  'T-Shirts & Tops': 8.0,
  'Röcke': 10.0,
  'Blusen & Hemden': 12.0,
  'Sportbekleidung': 14.0,
  'Bademode': 6.0,

  // Elektronik
  'Smartphones': 56.0,
  'Laptops': 240.0,
  'Tablets': 100.0,
  'Kopfhörer': 15.0,
  'Kameras': 45.0,
  'Spielkonsolen': 80.0,
  'Elektronik': 50.0,

  // Wohnen & Möbel
  'Möbel': 120.0,
  'Dekoration': 15.0,
  'Küche': 20.0,
  'Wohnen': 30.0,

  // Sport & Freizeit
  'Sport': 20.0,
  'Fahrräder': 75.0,
  'Outdoor': 25.0,

  // Bücher & Medien
  'Bücher': 3.0,
  'Medien': 5.0,

  // Vintage & Sammler
  'Vintage': 20.0,
  'Sammler': 10.0,
};

// ── Water Savings (liters) per category ──

const WATER_BY_CATEGORY: Record<string, number> = {
  'Damen': 7000,
  'Herren': 7000,
  'Kinder': 3500,
  'Schuhe': 4500,
  'Taschen': 3000,
  'Accessoires': 1500,
  'Jacken & Mäntel': 10000,
  'Kleider': 8000,
  'Hosen': 7500,
  'Pullover': 7000,
  'T-Shirts & Tops': 4000,
  'Sportbekleidung': 5000,
  'Elektronik': 1200,
  'Smartphones': 900,
  'Laptops': 2000,
  'Möbel': 3000,
  'Wohnen': 2000,
  'Sport': 3000,
};

// ── Public API ──

export interface EcoImpact {
  co2Saved: number; // kg
  waterSaved: number; // liters
  treesEquivalent: number; // number of trees absorbing same CO2 in a year
}

/**
 * Calculate eco impact for a single product based on its category
 */
export function calculateProductEcoImpact(categoryName: string): EcoImpact {
  const co2 = findBestMatch(categoryName, CO2_BY_CATEGORY) || 15.0; // Default 15kg
  const water = findBestMatch(categoryName, WATER_BY_CATEGORY) || 3000; // Default 3000L

  return {
    co2Saved: Math.round(co2 * 10) / 10,
    waterSaved: Math.round(water),
    treesEquivalent: Math.round((co2 / 22) * 100) / 100, // 1 tree absorbs ~22kg CO2/year
  };
}

/**
 * Calculate total eco impact for a user
 */
export function calculateUserEcoImpact(
  totalCO2Saved: number,
  itemsRecycled: number
): {
  co2Saved: number;
  waterSaved: number;
  treesEquivalent: number;
  itemsRecycled: number;
  carKmEquivalent: number;
  flightsEquivalent: number;
  level: string;
  badge: string;
} {
  // Estimate water savings (~300L per kg CO2 as rough ratio)
  const waterSaved = Math.round(totalCO2Saved * 300);
  const treesEquivalent = Math.round((totalCO2Saved / 22) * 100) / 100;
  const carKmEquivalent = Math.round(totalCO2Saved / 0.12); // ~120g CO2/km for avg car
  const flightsEquivalent = Math.round((totalCO2Saved / 255) * 100) / 100; // ~255kg CO2 for Berlin-Paris

  // Eco level system
  let level: string;
  let badge: string;
  if (totalCO2Saved >= 500) {
    level = 'Eco Champion';
    badge = 'champion';
  } else if (totalCO2Saved >= 200) {
    level = 'Eco Held';
    badge = 'hero';
  } else if (totalCO2Saved >= 100) {
    level = 'Eco Profi';
    badge = 'pro';
  } else if (totalCO2Saved >= 50) {
    level = 'Eco Starter';
    badge = 'starter';
  } else if (totalCO2Saved >= 10) {
    level = 'Eco Entdecker';
    badge = 'explorer';
  } else {
    level = 'Eco Neuling';
    badge = 'newbie';
  }

  return {
    co2Saved: Math.round(totalCO2Saved * 10) / 10,
    waterSaved,
    treesEquivalent,
    itemsRecycled,
    carKmEquivalent,
    flightsEquivalent,
    level,
    badge,
  };
}

/**
 * Get monthly eco trends (placeholder — needs order history data)
 */
export function getMonthlyTrend(
  orders: Array<{ createdAt: Date; product: { ecoCO2Saved: number } }>
): Array<{ month: string; co2Saved: number; items: number }> {
  const months = new Map<string, { co2: number; items: number }>();

  for (const order of orders) {
    const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const existing = months.get(key) || { co2: 0, items: 0 };
    existing.co2 += order.product.ecoCO2Saved;
    existing.items += 1;
    months.set(key, existing);
  }

  return Array.from(months.entries())
    .map(([month, data]) => ({
      month,
      co2Saved: Math.round(data.co2 * 10) / 10,
      items: data.items,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ── Helpers ──

function findBestMatch(categoryName: string, map: Record<string, number>): number | null {
  // Exact match
  if (map[categoryName]) return map[categoryName];

  // Case-insensitive
  const lower = categoryName.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return value;
  }

  // Partial match
  for (const [key, value] of Object.entries(map)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return value;
    }
  }

  return null;
}
