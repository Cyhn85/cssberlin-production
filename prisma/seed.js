const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('Verbindung zur Datenbank hergestellt. Starte Seeding...');

  // ══════════ TOP-LEVEL CATEGORIES ══════════
  const topCategories = [
    { name: 'Damen', emoji: '👗', color: '#ff6b6b' },
    { name: 'Herren', emoji: '👔', color: '#4a90e2' },
    { name: 'Kinder', emoji: '👶', color: '#f39c12' },
    { name: 'Wohnen', emoji: '🛋️', color: '#27ae60' },
    { name: 'Elektronik', emoji: '💻', color: '#8e44ad' },
    { name: 'Sport', emoji: '⚽', color: '#e67e22' },
    { name: 'Vintage', emoji: '📻', color: '#d35400' },
    { name: 'Taschen & Accessoires', emoji: '👜', color: '#e84393' },
    { name: 'Schuhe', emoji: '👟', color: '#6c5ce7' },
    { name: 'Schmuck & Uhren', emoji: '💎', color: '#fdcb6e' },
    { name: 'Bücher & Medien', emoji: '📚', color: '#00b894' },
    { name: 'Sammler', emoji: '🏆', color: '#a29bfe' },
  ];

  // Create top-level categories
  const createdTop = {};
  for (const cat of topCategories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: { emoji: cat.emoji, color: cat.color },
      create: { name: cat.name, emoji: cat.emoji, color: cat.color },
    });
    createdTop[cat.name] = created.id;
  }

  console.log(`${topCategories.length} Hauptkategorien erstellt ✅`);

  // ══════════ SUB-CATEGORIES ══════════
  const subCategories = {
    'Damen': [
      { name: 'Kleider', emoji: '👗' },
      { name: 'Blusen & Hemden', emoji: '👚' },
      { name: 'T-Shirts & Tops', emoji: '👕' },
      { name: 'Pullover & Strickjacken', emoji: '🧶' },
      { name: 'Jacken & Mäntel', emoji: '🧥' },
      { name: 'Hosen', emoji: '👖' },
      { name: 'Röcke', emoji: '🩱' },
      { name: 'Sportbekleidung', emoji: '🏃‍♀️' },
      { name: 'Bademode', emoji: '👙' },
      { name: 'Nachtwäsche', emoji: '🌙' },
      { name: 'Umstandsmode', emoji: '🤰' },
    ],
    'Herren': [
      { name: 'Hemden', emoji: '👔' },
      { name: 'T-Shirts & Polos', emoji: '👕' },
      { name: 'Pullover & Hoodies', emoji: '🧥' },
      { name: 'Jacken & Mäntel (Herren)', emoji: '🧥' },
      { name: 'Hosen (Herren)', emoji: '👖' },
      { name: 'Anzüge & Sakkos', emoji: '🤵' },
      { name: 'Sportbekleidung (Herren)', emoji: '🏃' },
      { name: 'Unterwäsche', emoji: '🩲' },
    ],
    'Kinder': [
      { name: 'Baby (0-1 Jahr)', emoji: '👶' },
      { name: 'Kleinkind (1-3 Jahre)', emoji: '🧒' },
      { name: 'Mädchen (4-12 Jahre)', emoji: '👧' },
      { name: 'Jungen (4-12 Jahre)', emoji: '👦' },
      { name: 'Teenager', emoji: '🧑' },
      { name: 'Kinderschuhe', emoji: '👟' },
      { name: 'Spielzeug', emoji: '🧸' },
      { name: 'Kinderwagen & Zubehör', emoji: '🍼' },
    ],
    'Wohnen': [
      { name: 'Möbel', emoji: '🛋️' },
      { name: 'Dekoration', emoji: '🖼️' },
      { name: 'Küche & Esszimmer', emoji: '🍽️' },
      { name: 'Bettwäsche & Handtücher', emoji: '🛏️' },
      { name: 'Beleuchtung', emoji: '💡' },
      { name: 'Garten & Balkon', emoji: '🌿' },
      { name: 'Aufbewahrung', emoji: '📦' },
    ],
    'Elektronik': [
      { name: 'Smartphones', emoji: '📱' },
      { name: 'Laptops & Computer', emoji: '💻' },
      { name: 'Tablets', emoji: '📋' },
      { name: 'Kopfhörer & Audio', emoji: '🎧' },
      { name: 'Kameras & Foto', emoji: '📷' },
      { name: 'Spielkonsolen & Gaming', emoji: '🎮' },
      { name: 'Smartwatches & Wearables', emoji: '⌚' },
      { name: 'Zubehör & Kabel', emoji: '🔌' },
    ],
    'Sport': [
      { name: 'Fahrräder', emoji: '🚲' },
      { name: 'Fitness & Gym', emoji: '🏋️' },
      { name: 'Outdoor & Wandern', emoji: '🥾' },
      { name: 'Wintersport', emoji: '⛷️' },
      { name: 'Wassersport', emoji: '🏄' },
      { name: 'Yoga & Pilates', emoji: '🧘' },
      { name: 'Laufen', emoji: '🏃' },
      { name: 'Teamsport', emoji: '⚽' },
    ],
    'Vintage': [
      { name: 'Vintage Mode', emoji: '👘' },
      { name: 'Retro Elektronik', emoji: '📻' },
      { name: 'Antik & Sammlerstücke', emoji: '🏺' },
      { name: 'Vintage Möbel', emoji: '🪑' },
      { name: 'Vintage Schmuck', emoji: '💍' },
    ],
    'Taschen & Accessoires': [
      { name: 'Handtaschen', emoji: '👜' },
      { name: 'Rucksäcke', emoji: '🎒' },
      { name: 'Geldbörsen', emoji: '👛' },
      { name: 'Gürtel', emoji: '🔗' },
      { name: 'Schals & Tücher', emoji: '🧣' },
      { name: 'Mützen & Hüte', emoji: '🧢' },
      { name: 'Sonnenbrillen', emoji: '🕶️' },
    ],
    'Schuhe': [
      { name: 'Sneaker', emoji: '👟' },
      { name: 'Stiefel & Boots', emoji: '🥾' },
      { name: 'Sandalen', emoji: '🩴' },
      { name: 'High Heels', emoji: '👠' },
      { name: 'Laufschuhe', emoji: '🏃' },
      { name: 'Business-Schuhe', emoji: '👞' },
    ],
    'Schmuck & Uhren': [
      { name: 'Ringe', emoji: '💍' },
      { name: 'Ketten & Halsketten', emoji: '📿' },
      { name: 'Armbänder', emoji: '⌚' },
      { name: 'Ohrringe', emoji: '✨' },
      { name: 'Uhren (Damen)', emoji: '⌚' },
      { name: 'Uhren (Herren)', emoji: '⌚' },
    ],
    'Bücher & Medien': [
      { name: 'Romane & Literatur', emoji: '📖' },
      { name: 'Sachbücher', emoji: '📚' },
      { name: 'Kinderbücher', emoji: '📕' },
      { name: 'Comics & Manga', emoji: '🦸' },
      { name: 'CDs & Vinyl', emoji: '💿' },
      { name: 'DVDs & Blu-ray', emoji: '📀' },
    ],
    'Sammler': [
      { name: 'Briefmarken', emoji: '📮' },
      { name: 'Münzen', emoji: '🪙' },
      { name: 'Trading Cards', emoji: '🃏' },
      { name: 'Modellbau', emoji: '🚂' },
      { name: 'Figuren & Statuen', emoji: '🗿' },
    ],
  };

  let subCount = 0;
  for (const [parentName, children] of Object.entries(subCategories)) {
    const parentId = createdTop[parentName];
    if (!parentId) {
      console.warn(`Parent category "${parentName}" not found, skipping children.`);
      continue;
    }

    for (const child of children) {
      await prisma.category.upsert({
        where: { name: child.name },
        update: { emoji: child.emoji, parentId },
        create: {
          name: child.name,
          emoji: child.emoji,
          parentId,
        },
      });
      subCount++;
    }
  }

  console.log(`${subCount} Unterkategorien erstellt ✅`);
  console.log(`Insgesamt ${topCategories.length + subCount} Kategorien. Seeding abgeschlossen! 🌱`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
