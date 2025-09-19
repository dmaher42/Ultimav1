function uniqueId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

const WEAPON_BASES = [
  { name: 'Rusty Blade', attack: 3, strReq: 8, weight: 1.4 },
  { name: 'Iron Longsword', attack: 5, strReq: 10, weight: 1.6 },
  { name: 'Oak Mace', attack: 6, strReq: 12, weight: 1.8 },
  { name: 'Hunter Spear', attack: 7, strReq: 13, weight: 1.7 }
];

const ARMOR_BASES = [
  { name: 'Padded Vest', defense: 3, strReq: 8, weight: 1.8 },
  { name: 'Leather Brigandine', defense: 5, strReq: 11, weight: 2.2 },
  { name: 'Iron Scale', defense: 7, strReq: 13, weight: 2.4 }
];

const MATERIALS = {
  pelt: ['Wolf Pelt', 'Thick Hide', 'Striped Fur'],
  herb: ['Silverleaf', 'Moonblossom', 'Ginseng Root'],
  goo: ['Luminescent Ooze', 'Sticky Residue'],
  coin: ['Bag of Coin'],
  material: ['Crude Ore', 'Dull Crystal'],
  weapon: ['Broken Blade']
};

export default class ItemGenerator {
  constructor() {
    this.random = Math.random;
  }

  createWeapon(level = 1) {
    const base = WEAPON_BASES[Math.floor(this.random() * WEAPON_BASES.length)];
    const bonus = Math.max(1, Math.round(level * 0.8));
    const item = {
      id: uniqueId('weapon'),
      name: base.name,
      type: 'weapon',
      stats: {
        attack: base.attack + bonus,
        str_req: base.strReq + Math.floor(level * 0.5)
      },
      value: 30 + bonus * 12,
      stackable: false,
      weight: base.weight
    };
    return item;
  }

  createArmor(level = 1) {
    const base = ARMOR_BASES[Math.floor(this.random() * ARMOR_BASES.length)];
    const bonus = Math.max(1, Math.round(level * 0.7));
    return {
      id: uniqueId('armor'),
      name: base.name,
      type: 'armor',
      stats: {
        defense: base.defense + bonus,
        str_req: base.strReq + Math.floor(level * 0.4)
      },
      value: 28 + bonus * 10,
      stackable: false,
      weight: base.weight
    };
  }

  createHealthPotion(level = 1) {
    const amount = 25 + level * 6;
    return {
      id: 'potion-health',
      name: 'Health Draught',
      type: 'consumable',
      stats: {},
      effect: { type: 'heal', amount },
      value: 12 + level * 2,
      stackable: true,
      quantity: 1,
      weight: 0.5
    };
  }

  createManaPotion(level = 1) {
    const amount = 15 + level * 4;
    return {
      id: 'potion-mana',
      name: 'Mana Tonic',
      type: 'consumable',
      stats: {},
      effect: { type: 'restore_mana', amount },
      value: 15 + level * 3,
      stackable: true,
      quantity: 1,
      weight: 0.5
    };
  }

  createMaterial(tag = 'material') {
    const list = MATERIALS[tag] || MATERIALS.material;
    const name = list[Math.floor(this.random() * list.length)];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return {
      id: `material-${slug}`,
      name,
      type: 'material',
      stats: {},
      value: 6 + Math.floor(this.random() * 8),
      stackable: true,
      quantity: 1,
      weight: 0.5
    };
  }

  generateLoot(level = 1, tags = []) {
    const drops = [];
    const roll = this.random();
    if (roll < 0.3) {
      drops.push(this.createHealthPotion(level));
    }
    if (roll > 0.6) {
      drops.push(this.createManaPotion(level));
    }
    if (tags.includes('weapon') && this.random() < 0.7) {
      drops.push(this.createWeapon(level));
    } else if (tags.includes('material') || tags.includes('pelt') || tags.includes('goo')) {
      drops.push(this.createMaterial(tags[0]));
    }
    if (drops.length === 0 && this.random() < 0.5) {
      drops.push(this.createMaterial(tags[0] || 'material'));
    }
    return drops;
  }
}
