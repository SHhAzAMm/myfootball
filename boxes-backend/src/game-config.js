// ═══════════════════════════════════════════════
//  GAME CONFIG — единый источник правды для сервера
//  ВАЖНО: если меняешь контент — обнови и на фронте!
// ═══════════════════════════════════════════════

export const CRAFT_AMOUNT = 10;
export const RESET_BASE = 30;
export const SHARD_CARD_PRICE = 5;

export const CRAFT_UPGRADE = {
  common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythical',
};

export const SELL_VALUES = {
  common: 1, rare: 5, epic: 20, legendary: 100, mythical: 500,
};

export const BOX_PRICES = {
  rare: 500, epic: 2000, legendary: 10000, mythical: 50000,
};

export const SHARD_BOX_PRICES = {
  common: 1, rare: 1, epic: 1, legendary: 2, mythical: 3,
};

export const RARITY_CHANCES = { common: 50, rare: 25, epic: 15, legendary: 8, mythical: 2 };

export const BOOST_CHANCES = {
  rare: { common: 35, rare: 40, epic: 15, legendary: 8, mythical: 2 },
  epic: { common: 40, rare: 23, epic: 22, legendary: 12, mythical: 3 },
};

export const BOOST_INFO = {
  rare: { duration: 60 * 60 * 1000 },
  epic: { duration: 60 * 60 * 1000 },
};

export const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
export const DAILY_STREAK_RESET = 48 * 60 * 60 * 1000;

export const DAILY_REWARDS = [
  { type: 'coins',        icon: '🪙', title: '100 монет',         amount: 100 },
  { type: 'coins',        icon: '🪙', title: '250 монет',         amount: 250 },
  { type: 'coins',        icon: '🪙', title: '500 монет',         amount: 500 },
  { type: 'coins_shards', icon: '🎁', title: '200🪙 + 1💎',       coins: 200, shards: 1 },
  { type: 'shards',       icon: '💎', title: '1 осколок',         amount: 1 },
  { type: 'shards',       icon: '💎', title: '2 осколка',         amount: 2 },
  { type: 'shards',       icon: '💎', title: '3 осколка',         amount: 3 },
  { type: 'box',          icon: '📦', title: 'Редкий ящик',       boxRarity: 'rare' },
  { type: 'box',          icon: '📦', title: 'Эпический ящик',    boxRarity: 'epic' },
  { type: 'box',          icon: '📦', title: 'Легендарный ящик',  boxRarity: 'legendary' },
  { type: 'boost',        icon: '🔵', title: 'Буст редких',       boostType: 'rare' },
  { type: 'boost',        icon: '🟣', title: 'Буст эпик+',        boostType: 'epic' },
  { type: 'coins_shards', icon: '💎', title: '150🪙 + 2💎',       coins: 150, shards: 2 },
  { type: 'coins',        icon: '🪙', title: '1000 монет',        amount: 1000 },
];

// ═══ КАТЕГОРИИ И ПРЕДМЕТЫ ═══
const ELEMENT_HEROES = [
  { id: 'fire',  name: 'Огонь',  rarity: 'common', desc: 'Пламя жизни' },
  { id: 'water', name: 'Вода',   rarity: 'common', desc: 'Поток времени' },
  { id: 'earth', name: 'Земля',  rarity: 'common', desc: 'Основа всего' },
  { id: 'air',   name: 'Воздух', rarity: 'common', desc: 'Дыхание мира' },
  { id: 'fog',   name: 'Туман',  rarity: 'rare', desc: 'Скрывает тайны' },
  { id: 'sand',  name: 'Песок',  rarity: 'rare', desc: 'Пыль веков' },
  { id: 'plant', name: 'Растение', rarity: 'rare', desc: 'Сила роста' },
  { id: 'cold',  name: 'Холод',  rarity: 'rare', desc: 'Ледяное дыхание' },
  { id: 'light', name: 'Свет',   rarity: 'epic', desc: 'Сияние истины' },
  { id: 'slime', name: 'Слизь',  rarity: 'epic', desc: 'Живая материя' },
  { id: 'sound', name: 'Звук',   rarity: 'epic', desc: 'Эхо пустоты' },
  { id: 'ash',   name: 'Пепел',  rarity: 'epic', desc: 'Память огня' },
  { id: 'gas',   name: 'Газ',    rarity: 'epic', desc: 'Невидимый дух' },
  { id: 'lava',  name: 'Лава',   rarity: 'legendary', desc: 'Гнев земли' },
  { id: 'electricity', name: 'Электричество', rarity: 'legendary', desc: 'Сила грозы' },
  { id: 'venom', name: 'Яд',     rarity: 'legendary', desc: 'Смертельный шёпот' },
  { id: 'blood', name: 'Кровь',  rarity: 'legendary', desc: 'Цена жизни' },
  { id: 'rainbow', name: 'Радуга', rarity: 'legendary', desc: 'Мост богов' },
  { id: 'darkness', name: 'Тьма', rarity: 'mythical', desc: 'Начало всех начал' },
  { id: 'time',  name: 'Время',  rarity: 'mythical', desc: 'Властелин всего' },
];

const GEM_HEROES = [
  { id: 'diamond', name: 'Алмаз', rarity: 'mythical', desc: 'Твёрдость 10' },
  { id: 'alexandrite', name: 'Александрит', rarity: 'legendary', desc: 'Меняет цвет' },
  { id: 'ruby', name: 'Рубин', rarity: 'legendary', desc: 'Камень страсти' },
  { id: 'emerald', name: 'Изумруд', rarity: 'legendary', desc: 'Камень царей' },
  { id: 'sapphire', name: 'Сапфир', rarity: 'legendary', desc: 'Небесный камень' },
  { id: 'amethyst', name: 'Аметист', rarity: 'epic', desc: 'Защита от сглаза' },
  { id: 'topaz', name: 'Топаз', rarity: 'epic', desc: 'Солнечный камень' },
  { id: 'opal', name: 'Опал', rarity: 'epic', desc: 'Все цвета радуги' },
  { id: 'moonstone', name: 'Лунный камень', rarity: 'epic', desc: 'Свет луны' },
  { id: 'aquamarine', name: 'Аквамарин', rarity: 'rare', desc: 'Морская волна' },
  { id: 'garnet', name: 'Гранат', rarity: 'rare', desc: 'Огонь и страсть' },
  { id: 'tourmaline', name: 'Турмалин', rarity: 'rare', desc: 'Радужный камень' },
  { id: 'malachite', name: 'Малахит', rarity: 'rare', desc: 'Зелёный узор' },
  { id: 'obsidian', name: 'Обсидиан', rarity: 'rare', desc: 'Вулканическое стекло' },
  { id: 'pearl', name: 'Жемчуг', rarity: 'rare', desc: 'Слёзы моря' },
  { id: 'agate', name: 'Агат', rarity: 'common', desc: 'Полосатый камень' },
  { id: 'quartz', name: 'Кварц', rarity: 'common', desc: 'Прозрачный кристалл' },
  { id: 'amber', name: 'Янтарь', rarity: 'common', desc: 'Солнечная смола' },
  { id: 'onyx', name: 'Оникс', rarity: 'common', desc: 'Чёрный камень' },
  { id: 'pyrite', name: 'Пирит', rarity: 'common', desc: 'Золото дураков' },
];

const EQUIPMENT_HEROES = [
  { id: 'daggers',    name: 'Кинжалы',     rarity: 'common', desc: 'Быстрые и скрытные' },
  { id: 'machete',    name: 'Мачете',      rarity: 'common', desc: 'Тесак джунглей' },
  { id: 'nunchaku',   name: 'Нунчаки',     rarity: 'common', desc: 'Оружие монахов' },
  { id: 'shuriken',   name: 'Сюрикен',     rarity: 'common', desc: 'Метательная звезда' },
  { id: 'wood',       name: 'Дубина',      rarity: 'common', desc: 'Просто и надёжно' },
  { id: 'bow',        name: 'Лук',         rarity: 'rare', desc: 'Меткий выстрел' },
  { id: 'crossbow',   name: 'Арбалет',     rarity: 'rare', desc: 'Пробивает броню' },
  { id: 'slingshot',  name: 'Рогатка',     rarity: 'rare', desc: 'Просто и метко' },
  { id: 'spear',      name: 'Копьё',       rarity: 'rare', desc: 'Дальний удар' },
  { id: 'axe',        name: 'Топор',       rarity: 'epic', desc: 'Дровосек войны' },
  { id: 'hammer',     name: 'Молот',       rarity: 'epic', desc: 'Сокрушает всё' },
  { id: 'katana',     name: 'Катана',      rarity: 'epic', desc: 'Путь самурая' },
  { id: 'saber',      name: 'Сабля',       rarity: 'epic', desc: 'Клинок кавалерии' },
  { id: 'morgenstern',name: 'Моргенштерн', rarity: 'epic', desc: 'Утренняя звезда' },
  { id: 'sword',      name: 'Меч',         rarity: 'legendary', desc: 'Классика воинов' },
  { id: 'staff',      name: 'Посох',       rarity: 'legendary', desc: 'Магия в руках' },
  { id: 'chainmail',  name: 'Кольчуга',    rarity: 'legendary', desc: 'Защита воина' },
  { id: 'shield',     name: 'Щит',         rarity: 'legendary', desc: 'Надёжная защита' },
  { id: 'helmet',     name: 'Шлем',        rarity: 'legendary', desc: 'Голова под защитой' },
  { id: 'crown',      name: 'Корона',      rarity: 'mythical', desc: 'Власть королей' },
];

export const CATEGORIES = {
  elements:  { name: 'Элементы', heroes: ELEMENT_HEROES },
  gems:      { name: 'Драгоценные камни', heroes: GEM_HEROES },
  equipment: { name: 'Снаряжение', heroes: EQUIPMENT_HEROES },
};

// ═══ ХЕЛПЕРЫ ═══
export function getHeroes(category) {
  return CATEGORIES[category]?.heroes || [];
}

export function getHeroById(category, id) {
  return getHeroes(category).find(h => h.id === id);
}

export function pickHeroByRarity(category, rarity) {
  const pool = getHeroes(category).filter(h => h.rarity === rarity);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function rollRarity(boost) {
  const chances = (boost && boost.expiresAt > Date.now() && BOOST_CHANCES[boost.type])
    ? BOOST_CHANCES[boost.type]
    : RARITY_CHANCES;
  const roll = Math.random() * 100;
  let acc = 0;
  for (const [rarity, chance] of Object.entries(chances)) {
    acc += chance;
    if (roll < acc) return rarity;
  }
  return 'common';
}