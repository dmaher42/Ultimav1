import ItemGenerator from './ItemGenerator.js';

function calculateDamage(attacker, defender, attackerGuard = 1, defenderGuard = 1) {
  const baseAttack = attacker.attack;
  const baseDefense = defender.defense * defenderGuard;
  const variance = 0.8 + Math.random() * 0.4;
  const raw = (baseAttack - baseDefense) * variance;
  const damage = Math.max(1, Math.round(raw));
  return Math.max(1, Math.round(damage * attackerGuard));
}

const MODE_CONFIG = {
  melee: {
    label: 'Melee',
    stat: 'STR',
    multiplier: 1,
    defenseFactor: 1,
    mpCost: 0,
    damageType: 'physical',
    verb: 'strike'
  },
  bow: {
    label: 'Bow',
    stat: 'DEX',
    multiplier: 0.95,
    defenseFactor: 0.85,
    mpCost: 0,
    damageType: 'physical',
    verb: 'loose an arrow at'
  },
  spell: {
    label: 'Spell',
    stat: 'INT',
    multiplier: 1.1,
    defenseFactor: 0.65,
    mpCost: 8,
    damageType: 'magic',
    verb: 'cast a spell at'
  }
};

function getModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG.melee;
}

function getMatchupMultiplier(enemy, mode) {
  const tactic = enemy?.tactic || enemy?.id || 'default';
  const table = {
    melee: { gargoyle: 1.1, reaper: 0.95, drake: 0.9, gazer: 0.85, default: 1 },
    bow: { gargoyle: 1.15, reaper: 1, drake: 0.9, gazer: 1.05, default: 1 },
    spell: { gargoyle: 0.9, reaper: 1.15, drake: 1.15, gazer: 1.1, default: 1 }
  };
  return table[mode]?.[tactic] ?? table[mode]?.default ?? 1;
}

export default class CombatEngine {
  constructor(root) {
    this.root = root;
    this.statusElement = root.querySelector('#combat-status');
    this.logElement = root.querySelector('#combat-log');
    this.actionsElement = root.querySelector('.combat-actions');
    this.itemList = root.querySelector('#combat-item-list');
    this.generator = new ItemGenerator();
    this.boundActionHandler = (event) => this.handleAction(event);
    this.actionsElement.addEventListener('click', this.boundActionHandler);
    this.root.addEventListener('click', (event) => {
      if (!this.active || !this.isItemMenuOpen()) return;
      const clickedAction = event.target.closest('button[data-action]');
      const clickedItem = event.target.closest('#combat-item-list');
      if (!clickedAction && !clickedItem) {
        this.closeItemMenu();
      }
    });
    this.itemList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-item]');
      if (!button) return;
      const itemId = button.dataset.item;
      this.consumeItem(itemId);
    });
  }

  start(player, enemy) {
    this.player = player;
    this.enemy = enemy;
    this.playerGuard = { defense: 1, damage: 1 };
    this.enemyGuard = { defense: 1, damage: 1 };
    this.turnCount = 0;
    this.turn = 'player';
    this.active = true;
    this.playerMode = 'melee';
    this.logElement.innerHTML = '';
    this.itemList.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.renderActionButtons();
    this.appendLog(`A ${enemy.name} emerges!`);
    this.updateStatus();
    this.syncActionButtonStates();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  end(result) {
    this.active = false;
    this.root.classList.add('hidden');
    this.closeItemMenu();
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  renderActionButtons() {
    this.actionsElement.innerHTML = `
      <button class="combat-action" data-action="melee">Melee</button>
      <button class="combat-action" data-action="bow">Bow</button>
      <button class="combat-action" data-action="spell">Spell</button>
      <button class="combat-action" data-action="defend">Defend</button>
      <button class="combat-action" data-action="item">Item</button>
      <button class="combat-action" data-action="flee">Flee</button>
    `;
    this.syncActionButtonStates();
  }

  handleAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.active || this.turn !== 'player') return;
    const action = button.dataset.action;
    if (action === 'melee' || action === 'bow' || action === 'spell') {
      this.closeItemMenu();
      this.playerAttack(action);
    } else if (action === 'defend') {
      this.closeItemMenu();
      this.playerDefend();
    } else if (action === 'item') {
      this.toggleItemMenu();
    } else if (action === 'flee') {
      this.closeItemMenu();
      this.playerFlee();
    }
  }

  isItemMenuOpen() {
    return !this.itemList.classList.contains('hidden');
  }

  syncActionButtonStates() {
    const buttons = this.actionsElement.querySelectorAll('button[data-action]');
    buttons.forEach((button) => {
      const action = button.dataset.action;
      const isItem = action === 'item';
      const isActive = isItem && this.isItemMenuOpen();
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isItem) {
        button.textContent = isActive ? 'Item (Open)' : 'Item';
      }
    });
  }

  openItemMenu() {
    const consumables = this.player.character.inventory.filter((item) => item.type === 'consumable');
    this.itemList.innerHTML = '';
    if (consumables.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'combat-item-empty';
      empty.textContent = 'No consumables available. Press Item again or Esc to close.';
      this.itemList.appendChild(empty);
    } else {
      consumables.forEach((item) => {
        const element = document.createElement('div');
        element.className = 'inventory-item';
        element.innerHTML = `
          <div class="inventory-item-header">
            <strong>${item.name}</strong>
            <span>x${item.quantity || 1}</span>
          </div>
          <button data-item="${item.id}">Use</button>`;
        this.itemList.appendChild(element);
      });
    }
    this.itemList.classList.remove('hidden');
    this.syncActionButtonStates();
  }

  closeItemMenu() {
    this.itemList.classList.add('hidden');
    this.syncActionButtonStates();
  }

  toggleItemMenu() {
    if (this.isItemMenuOpen()) {
      this.closeItemMenu();
      return;
    }
    this.openItemMenu();
  }

  consumeItem(itemId) {
    const entry = this.player.character.findItem(itemId);
    if (!entry) {
      this.appendLog('Item could not be used.');
      return;
    }
    if (entry.type !== 'consumable') {
      this.appendLog('Only consumables can be used in battle.');
      return;
    }
    if (entry.effect?.type === 'heal') {
      this.player.character.heal(entry.effect.amount);
      this.appendLog(`You quaff ${entry.name}, restoring ${entry.effect.amount} HP.`);
    } else if (entry.effect?.type === 'restore_mana') {
      this.player.character.restoreMana(entry.effect.amount);
      this.appendLog(`You drink ${entry.name}, restoring ${entry.effect.amount} MP.`);
    }
    this.player.character.removeItem(entry.id, 1);
    this.closeItemMenu();
    this.updateStatus();
    this.turn = 'enemy';
    this.enemyTurn();
  }

  getPlayerAttackPower(mode) {
    const config = getModeConfig(mode);
    const stat = this.player.character.stats?.[config.stat] || 10;
    const weapon = this.player.character.equipment.weapon;
    const weaponAttack = weapon?.stats?.attack || 0;
    const bowBonus = mode === 'bow' && weapon?.name?.toLowerCase().includes('bow') ? 4 : 0;
    const spellBonus = mode === 'spell' ? this.player.character.level * 2 : 0;
    return Math.max(1, Math.round((stat + weaponAttack + bowBonus + spellBonus) * config.multiplier));
  }

  playerAttack(mode = 'melee') {
    this.closeItemMenu();
    this.playerMode = mode;
    const config = getModeConfig(mode);
    if (config.mpCost > 0 && !this.player.character.useMana(config.mpCost)) {
      this.appendLog('Not enough MP for that spell.');
      this.updateStatus();
      return;
    }

    const attackPower = this.getPlayerAttackPower(mode);
    const variance = 0.85 + Math.random() * 0.3;
    const baseDefense = this.enemy.defense * this.enemyGuard.defense * config.defenseFactor;
    const raw = (attackPower * this.playerGuard.damage - baseDefense) * variance;
    const damage = Math.max(1, Math.round(raw * getMatchupMultiplier(this.enemy, mode)));

    this.enemyGuard.defense = 1;
    this.playerGuard.damage = 1;
    this.enemy.takeDamage(damage);
    this.appendLog(`You ${config.verb} the ${this.enemy.name} for ${damage} damage.`);
    this.triggerHitFlash();
    if (damage > 10) this.triggerScreenShake();
    this.updateStatus();
    if (!this.enemy.isAlive()) {
      this.victory();
      return;
    }
    this.turn = 'enemy';
    this.enemyTurn();
  }

  playerDefend() {
    this.closeItemMenu();
    this.playerGuard.defense = 1.5;
    this.playerGuard.damage = 0.5;
    this.appendLog('You brace yourself for the next attack.');
    this.turn = 'enemy';
    this.enemyTurn();
  }

  playerFlee() {
    this.closeItemMenu();
    const chance = 0.4 + this.player.character.stats.LUK / 100;
    if (Math.random() < chance) {
      this.appendLog('You successfully retreat!');
      this.updateStatus();
      this.end({ outcome: 'fled' });
    } else {
      this.appendLog('You fail to escape!');
      this.turn = 'enemy';
      this.enemyTurn();
    }
  }

  enemyTurn() {
    if (!this.enemy.isAlive()) return;
    this.turnCount += 1;
    const tactic = this.enemy?.tactic || this.enemy?.id || 'default';
    if (tactic === 'gargoyle') {
      this.enemyAggressiveStrike();
      return;
    }
    if (tactic === 'reaper') {
      this.enemyLightning();
      return;
    }
    if (tactic === 'drake') {
      if (this.turnCount % 3 === 0) {
        this.enemyBreath();
      } else {
        this.enemyPressure();
      }
      return;
    }
    if (tactic === 'gazer') {
      if (this.turnCount % 2 === 0) {
        this.enemyBurst();
      } else {
        this.enemyPressure();
      }
      return;
    }
    const decision = Math.random();
    if (decision < 0.7 || this.enemyGuard.defense > 1) {
      this.enemyAttack();
    } else {
      this.enemyDefend();
    }
  }

  enemyAttack() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} hits you`,
      damageType: 'physical',
      multiplier: 1
    });
  }

  enemyPressure() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} presses in`,
      damageType: 'physical',
      multiplier: 1.05
    });
  }

  enemyAggressiveStrike() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} dives at you in a savage rush`,
      damageType: 'physical',
      multiplier: 1.2
    });
  }

  enemyLightning() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} hurls lightning`,
      damageType: 'lightning',
      multiplier: 1.15
    });
  }

  enemyBreath() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} breathes a cone of fire`,
      damageType: 'fire',
      multiplier: 1.35
    });
  }

  enemyBurst() {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} unleashes a burst of force`,
      damageType: 'magic',
      multiplier: 1.2
    }, 2);
  }

  resolveIncomingAttack({ label, damageType = 'physical', multiplier = 1 }, hits = 1) {
    const resistance = this.player.character.getDamageMultiplier(damageType);
    let totalDamage = 0;

    for (let i = 0; i < hits; i += 1) {
      const variance = 0.85 + Math.random() * 0.3;
      const defenseFactor = damageType === 'magic' ? 0.7 : 1;
      const raw = (this.enemy.attack * this.enemyGuard.damage * multiplier - this.player.character.defense * this.playerGuard.defense * defenseFactor) * variance;
      const damage = resistance <= 0 ? 0 : Math.max(1, Math.round(raw * resistance));
      totalDamage += damage;
    }

    this.enemyGuard.damage = 1;
    this.playerGuard.defense = 1;

    if (totalDamage <= 0) {
      this.appendLog('The Storm Cloak repels the attack.');
    } else {
      this.player.character.takeDamage(totalDamage);
      this.appendLog(`${label} for ${totalDamage} damage.`);
      this.triggerHitFlash(damageType === 'physical' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(120, 180, 255, 0.45)');
      if (totalDamage > 10) this.triggerScreenShake();
    }
    this.updateStatus();
    if (!this.player.character.isAlive()) {
      this.defeat();
      return;
    }
    this.turn = 'player';
  }

  victory() {
    const xp = this.enemy.xpReward;
    const loot = this.generator.generateLoot(this.enemy.level, this.enemy.lootTags);
    this.appendLog(`The ${this.enemy.name} is defeated! You gain ${xp} XP.`);
    this.updateStatus();
    this.end({ outcome: 'victory', xp, loot, enemy: this.enemy });
  }

  defeat() {
    this.appendLog('You fall to the ground!');
    this.updateStatus();
    this.end({ outcome: 'defeat' });
  }

  appendLog(message) {
    const entry = document.createElement('div');
    entry.textContent = message;
    this.logElement.appendChild(entry);
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  updateStatus() {
    const mode = getModeConfig(this.playerMode)?.label || 'Melee';
    this.statusElement.textContent = `HP ${this.player.character.currentHP}/${this.player.character.maxHP} - MP ${this.player.character.currentMP}/${this.player.character.maxMP} - ${this.enemy.name}: ${this.enemy.currentHP}/${this.enemy.maxHP} - Mode: ${mode}`;
  }

  triggerHitFlash(color = 'rgba(255, 255, 255, 0.5)') {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = color;
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '1000';
    flash.style.opacity = '0.1';
    flash.style.mixBlendMode = 'screen';
    flash.style.transition = 'opacity 0.09s ease-out';
    this.root.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 90);
    }, 30);
  }

  triggerScreenShake() {
    this.root.classList.add('shake');
    setTimeout(() => this.root.classList.remove('shake'), 400);
  }
}
