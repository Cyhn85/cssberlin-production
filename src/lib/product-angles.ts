/**
 * 6-angle product photography: not a full 360° spin rig, but the same
 * front/back/top/bottom/left/right set real e-commerce product photography
 * already standardizes on. Ordered so FRONT->RIGHT->BACK->LEFT forms a
 * natural horizontal rotation loop, with TOP/BOTTOM as the two extra faces.
 */
export const PRODUCT_ANGLES = ['FRONT', 'RIGHT', 'BACK', 'LEFT', 'TOP', 'BOTTOM'] as const;

export type ProductAngle = (typeof PRODUCT_ANGLES)[number];

export const PRODUCT_ANGLE_LABELS: Record<ProductAngle, string> = {
  FRONT: 'Vorne',
  RIGHT: 'Rechts',
  BACK: 'Hinten',
  LEFT: 'Links',
  TOP: 'Oben',
  BOTTOM: 'Unten',
};

export function isProductAngle(value: string | null | undefined): value is ProductAngle {
  return !!value && (PRODUCT_ANGLES as readonly string[]).includes(value);
}

/**
 * True only if the product has all 6 angles present - a partial set (e.g.
 * just front+back) is intentionally not enough to switch on the angle
 * viewer, since a half-filled cube control would be confusing.
 */
export function hasFullAngleSet(images: Array<{ angle?: string | null }>): boolean {
  const present = new Set(images.map((img) => img.angle).filter(isProductAngle));
  return PRODUCT_ANGLES.every((angle) => present.has(angle));
}
