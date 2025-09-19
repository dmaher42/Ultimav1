const ENEMY_ARCHETYPES = {
  forest: [
    {
      id: 'wolf',
      name: 'Forest Wolf',
      baseLevel: 1,
      baseStats: { STR: 9, DEX: 12, INT: 6, VIT: 9, LUK: 8 },
      scaling: { STR: 1, DEX: 0.8, VIT: 1, LUK: 0.5 },
      attackBonus: 2,
      defenseBonus: 1,
      lootTags: ['pelt', 'herb']
    },
    {
      id: 'bandit',
      name: 'Wayward Bandit',
      baseLevel: 2,
      baseStats: { STR: 11, DEX: 10, INT: 8, VIT: 10, LUK: 9 },
      scaling: { STR: 1.1, DEX: 0.9, VIT: 1.1, LUK: 0.6 },
      attackBonus: 3,
      defenseBonus: 2,
      lootTags: ['weapon', 'coin']
    }
  ],
  cave: [
    {
      id: 'goblin',
      name: 'Cave Goblin',
      baseLevel: 2,
      baseStats: { STR: 10, DEX: 9, INT: 7, VIT: 11, LUK: 8 },
      scaling: { STR: 1.2, DEX: 0.8, VIT: 1.4, INT: 0.4 },
      attackBonus: 4,
      defenseBonus: 3,
      lootTags: ['weapon', 'material']
    },
    {
      id: 'slime',
      name: 'Azure Slime',
      baseLevel: 1,
      baseStats: { STR: 8, DEX: 6, INT: 5, VIT: 12, LUK: 6 },
      scaling: { STR: 0.8, VIT: 1.6, LUK: 0.3 },
      attackBonus: 2,
      defenseBonus: 4,
      lootTags: ['goo', 'herb']
    }
  ]
};

function clamp(value, min = 0) {
  return Math.max(min, Math.floor(value));
}

export default class Enemy {
  constructor(template, areaLevel = 1) {
    this.id = template.id;
    this.name = template.name;
    this.level = Math.max(1, Math.round(areaLevel + (template.baseLevel - 1)));
    this.baseStats = template.baseStats;
    this.scaling = template.scaling || {};
    this.attackBonus = template.attackBonus || 0;
    this.defenseBonus = template.defenseBonus || 0;
    this.lootTags = template.lootTags || [];
    this.stats = {};
    Object.keys(this.baseStats).forEach((key) => {
      const base = this.baseStats[key];
      const scale = this.scaling[key] || 0.5;
      this.stats[key] = clamp(base + areaLevel * scale);
    });
    this.maxHP = clamp(this.stats.VIT * 9 + this.level * 6, 10);
    this.maxMP = clamp((this.stats.INT || 6) * 3 + this.level * 2, 0);
    this.currentHP = this.maxHP;
    this.currentMP = this.maxMP;
    this.defending = false;
  }

  get attack() {
    return this.stats.STR + this.attackBonus;
  }

  get defense() {
    return this.stats.VIT + this.defenseBonus;
  }

  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - Math.floor(amount));
    return this.currentHP;
  }

  heal(amount) {
    this.currentHP = Math.min(this.maxHP, this.currentHP + Math.floor(amount));
  }

  isAlive() {
    return this.currentHP > 0;
  }

  get xpReward() {
    return this.level * 25;
  }
}

export function createEnemy(areaId, areaLevel = 1) {
  const pool = ENEMY_ARCHETYPES[areaId] || ENEMY_ARCHETYPES.forest;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return new Enemy(template, areaLevel);
}
