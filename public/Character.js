const STAT_KEYS = ['STR', 'DEX', 'INT', 'VIT', 'LUK'];

function clamp(value, min = 0) {
  return Math.max(min, Math.floor(value));
}

function cloneItem(item) {
  return JSON.parse(JSON.stringify(item));
}

function defaultEquipmentSlots() {
  return {
    weapon: null,
    armor: null,
    accessory: null
  };
}

function getItemWeight(item) {
  if (!item) return 0;
  if (typeof item.weight === 'number') {
    return item.weight;
  }
  switch (item.type) {
    case 'weapon':
      return 1.5;
    case 'armor':
      return 2;
    case 'consumable':
      return 0.5;
    default:
      return 0.75;
  }
}

export default class Character {
  constructor({
    name,
    stats,
    level = 1,
    xp = 0,
    equipment = {},
    inventory = [],
    currentHP,
    currentMP,
    unspentStatPoints = 0,
    quests = {}
  }) {
    this.name = name?.trim() || 'Adventurer';
    this.level = clamp(level, 1);
    this.xp = clamp(xp, 0);
    this.stats = {};
    STAT_KEYS.forEach((key) => {
      const value = Number.isFinite(stats?.[key]) ? stats[key] : 10;
      this.stats[key] = clamp(value, 1);
    });
    this.equipment = { ...defaultEquipmentSlots(), ...equipment };
    this.inventory = [];
    inventory.forEach((item) => {
      this.addItem(item, item.quantity || 1, true);
    });
    this.unspentStatPoints = clamp(unspentStatPoints, 0);
    this.currentHP = Number.isFinite(currentHP) ? clamp(currentHP, 0) : this.maxHP;
    this.currentMP = Number.isFinite(currentMP) ? clamp(currentMP, 0) : this.maxMP;
    this.quests = { ...quests };
  }

  getQuestStage(questId) {
    return this.quests[questId] || 0;
  }

  setQuestStage(questId, stage) {
    this.quests[questId] = stage;
  }

  get maxHP() {
    return this.stats.VIT * 10;
  }

  get maxMP() {
    return this.stats.INT * 5;
  }

  get attack() {
    const weaponAttack = this.equipment.weapon?.stats?.attack || 0;
    return this.stats.STR + weaponAttack;
  }

  get defense() {
    const armorDefense = this.equipment.armor?.stats?.defense || 0;
    const accessoryDefense = this.equipment.accessory?.stats?.defense || 0;
    return this.stats.VIT + armorDefense + accessoryDefense;
  }

  get xpThreshold() {
    return this.level ** 2 * 100;
  }

  get totalXP() {
    let total = this.xp;
    for (let lvl = 1; lvl < this.level; lvl += 1) {
      total += lvl ** 2 * 100;
    }
    return total;
  }

  get equippedWeight() {
    return Object.values(this.equipment).reduce((total, item) => {
      if (!item) return total;
      return total + getItemWeight(item);
    }, 0);
  }

  get backpackWeight() {
    return this.inventory.reduce((total, item) => {
      const weight = getItemWeight(item);
      const qty = item.stackable ? item.quantity : 1;
      return total + weight * (item.stackable ? qty : item.quantity || 1);
    }, 0);
  }

  canEquip(item) {
    if (!item) return false;
    if (!['weapon', 'armor', 'accessory'].includes(item.type)) {
      return false;
    }
    const requirement = item.stats?.str_req || 0;
    if (requirement > this.stats.STR) {
      return false;
    }
    const prospectiveWeight = this.equippedWeight - getItemWeight(this.equipment[item.type]) + getItemWeight(item);
    return prospectiveWeight <= this.stats.STR;
  }

  addItem(item, quantity = 1, skipWeightCheck = false) {
    if (!item || quantity <= 0) return false;
    const copy = cloneItem(item);
    copy.quantity = copy.quantity || quantity;
    const targetQuantity = copy.stackable ? (quantity) : 1;
    const weightIncrease = getItemWeight(copy) * (copy.stackable ? targetQuantity : 1);
    if (!skipWeightCheck && this.backpackWeight + weightIncrease > this.stats.STR * 2) {
      return false;
    }
    const existing = this.inventory.find((entry) => entry.id === copy.id && copy.stackable);
    if (existing && copy.stackable) {
      existing.quantity += quantity;
    } else {
      copy.quantity = copy.stackable ? quantity : 1;
      this.inventory.push(copy);
    }
    return true;
  }

  removeItem(itemId, quantity = 1) {
    const index = this.inventory.findIndex((entry) => entry.id === itemId);
    if (index === -1) return false;
    const entry = this.inventory[index];
    if (entry.stackable) {
      entry.quantity -= quantity;
      if (entry.quantity <= 0) {
        this.inventory.splice(index, 1);
      }
    } else {
      this.inventory.splice(index, 1);
    }
    return true;
  }

  findItem(itemId) {
    return this.inventory.find((entry) => entry.id === itemId) || null;
  }

  equipItem(itemId) {
    const entry = this.inventory.find((it) => it.id === itemId);
    if (!entry) return { success: false, reason: 'Item not found' };
    if (!this.canEquip(entry)) {
      return { success: false, reason: 'Requirements not met' };
    }
    const slot = entry.type;
    const previous = this.equipment[slot];
    if (previous) {
      if (!this.addItem(previous)) {
        return { success: false, reason: 'Backpack too heavy for swap' };
      }
    }
    this.equipment[slot] = { ...entry, quantity: 1 };
    this.removeItem(entry.id);
    this.syncVitals();
    return { success: true };
  }

  unequip(slot) {
    if (!this.equipment[slot]) return false;
    const item = this.equipment[slot];
    const success = this.addItem(item);
    if (!success) return false;
    this.equipment[slot] = null;
    this.syncVitals();
    return true;
  }

  gainXP(amount) {
    if (amount <= 0) return { leveledUp: false };
    let leveledUp = false;
    this.xp += amount;
    while (this.xp >= this.xpThreshold) {
      this.xp -= this.xpThreshold;
      this.level += 1;
      this.unspentStatPoints += 3;
      this.currentHP = this.maxHP;
      this.currentMP = this.maxMP;
      leveledUp = true;
    }
    return { leveledUp };
  }

  applyStatPoints(allocation) {
    if (!allocation) return false;
    let required = 0;
    Object.entries(allocation).forEach(([key, value]) => {
      if (STAT_KEYS.includes(key) && value > 0) {
        required += value;
      }
    });
    if (required > this.unspentStatPoints) {
      return false;
    }
    Object.entries(allocation).forEach(([key, value]) => {
      if (STAT_KEYS.includes(key) && value > 0) {
        this.stats[key] += value;
      }
    });
    this.unspentStatPoints -= required;
    this.syncVitals();
    return true;
  }

  takeDamage(amount) {
    this.currentHP = Math.max(0, this.currentHP - Math.floor(amount));
    return this.currentHP;
  }

  heal(amount) {
    this.currentHP = Math.min(this.maxHP, this.currentHP + Math.floor(amount));
    return this.currentHP;
  }

  useMana(amount) {
    if (this.currentMP < amount) return false;
    this.currentMP -= amount;
    return true;
  }

  restoreMana(amount) {
    this.currentMP = Math.min(this.maxMP, this.currentMP + Math.floor(amount));
    return this.currentMP;
  }

  isAlive() {
    return this.currentHP > 0;
  }

  applyDeathPenalty() {
    const penalty = Math.floor(this.xpThreshold * 0.1);
    this.xp = Math.max(0, this.xp - penalty);
    if (this.currentHP <= 0) {
      this.currentHP = Math.floor(this.maxHP * 0.5);
    }
  }

  syncVitals() {
    this.currentHP = Math.min(this.currentHP, this.maxHP);
    this.currentMP = Math.min(this.currentMP, this.maxMP);
  }

  toJSON() {
    return {
      name: this.name,
      stats: { ...this.stats },
      level: this.level,
      xp: this.xp,
      equipment: {
        weapon: this.equipment.weapon ? { ...this.equipment.weapon } : null,
        armor: this.equipment.armor ? { ...this.equipment.armor } : null,
        accessory: this.equipment.accessory ? { ...this.equipment.accessory } : null
      },
      inventory: this.inventory.map((item) => ({ ...item })),
      currentHP: this.currentHP,
      currentMP: this.currentMP,
      unspentStatPoints: this.unspentStatPoints,
      quests: { ...this.quests }
    };
  }

  static get STAT_KEYS() {
    return [...STAT_KEYS];
  }
}
