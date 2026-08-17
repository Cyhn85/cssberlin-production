/**
 * Merchandising order for top-level categories in the header nav and homepage
 * grid. Mirrors how Vinted/Kleinanzeigen lead with the highest-traffic
 * fashion segments instead of an arbitrary alphabetical list.
 */
const CATEGORY_PRIORITY = [
  'Damen',
  'Herren',
  'Kinder',
  'Schuhe',
  'Schmuck & Uhren',
  'Elektronik',
  'Sport',
  'Wohnen',
  'Bücher & Medien',
  'Sammler',
];

export function sortCategoriesByPriority<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const aIndex = CATEGORY_PRIORITY.indexOf(a.name);
    const bIndex = CATEGORY_PRIORITY.indexOf(b.name);
    const aRank = aIndex === -1 ? CATEGORY_PRIORITY.length : aIndex;
    const bRank = bIndex === -1 ? CATEGORY_PRIORITY.length : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, 'de');
  });
}
