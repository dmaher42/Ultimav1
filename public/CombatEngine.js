import ItemGenerator from './ItemGenerator.js';

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

const ACTION_SHORTCUTS = {
  melee: '1',
  bow: '2',
  spell: '3',
  defend: '4',
  item: '5',
  flee: '6'
};

const INTENT_TEMPLATES = {
  strike: {
    id: 'strike',
    title: 'Measured Strike',
    hint: 'Steel answers steel, but a shielded stance is the safer read.',
    counterMode: 'melee',
    action: 'enemyAttack',
    tone: 'steel'
  },
  pressure: {
    id: 'pressure',
    title: 'Relentless Pressure',
    hint: 'Arcane force or a disciplined guard can slow the advance.',
    counterMode: 'spell',
    action: 'enemyPressure',
    tone: 'steel'
  },
  rush: {
    id: 'rush',
    title: 'Diving Rush',
    hint: 'A fast bow shot can catch the lunge before it lands.',
    counterMode: 'bow',
    action: 'enemyAggressiveStrike',
    tone: 'steel'
  },
  lightning: {
    id: 'lightning',
    title: 'Lightning Chant',
    hint: 'Close in with melee before the chant peaks.',
    counterMode: 'melee',
    action: 'enemyLightning',
    tone: 'arcane'
  },
  breath: {
    id: 'breath',
    title: 'Inferno Breath',
    hint: "Spell pressure can break the drake's inhale before the fire blooms.",
    counterMode: 'spell',
    action: 'enemyBreath',
    tone: 'ember'
  },
  burst: {
    id: 'burst',
    title: 'Eye Burst',
    hint: "A precise bow shot can spoil the gazer's focus.",
    counterMode: 'bow',
    action: 'enemyBurst',
    tone: 'arcane'
  },
  fortify: {
    id: 'fortify',
    title: 'Guarded Posture',
    hint: 'Spellwork slips through a raised guard better than brute force.',
    counterMode: 'spell',
    action: 'enemyFortify',
    tone: 'steel'
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function getEnemyCondition(enemy) {
  if (!enemy?.maxHP) return 'steady';
  const ratio = enemy.currentHP / enemy.maxHP;
  if (ratio <= 0.18) return 'is on the brink of collapse';
  if (ratio <= 0.4) return 'is badly wounded and slowing';
  if (ratio <= 0.7) return 'is showing cracks in its guard';
  return null;
}

function getIntentForEnemy(enemy, turnCount = 0) {
  const tactic = enemy?.tactic || enemy?.id || 'default';
  const upcomingTurn = turnCount + 1;
  const lowHealth = enemy?.maxHP ? enemy.currentHP / enemy.maxHP <= 0.35 : false;

  if (tactic === 'gargoyle') {
    if (lowHealth && upcomingTurn % 3 === 0) return { ...INTENT_TEMPLATES.fortify };
    return { ...(upcomingTurn % 3 === 0 ? INTENT_TEMPLATES.rush : INTENT_TEMPLATES.pressure) };
  }

  if (tactic === 'reaper') {
    if (upcomingTurn % 4 === 0) return { ...INTENT_TEMPLATES.fortify };
    return { ...(upcomingTurn % 2 === 0 ? INTENT_TEMPLATES.lightning : INTENT_TEMPLATES.pressure) };
  }

  if (tactic === 'drake') {
    if (upcomingTurn % 3 === 0) return { ...INTENT_TEMPLATES.breath };
    return { ...(lowHealth && upcomingTurn % 2 === 0 ? INTENT_TEMPLATES.fortify : INTENT_TEMPLATES.pressure) };
  }

  if (tactic === 'gazer') {
    if (lowHealth && upcomingTurn % 3 === 0) return { ...INTENT_TEMPLATES.fortify };
    return { ...(upcomingTurn % 2 === 0 ? INTENT_TEMPLATES.burst : INTENT_TEMPLATES.pressure) };
  }

  if (upcomingTurn % 4 === 0) {
    return { ...INTENT_TEMPLATES.fortify };
  }
  if (upcomingTurn % 2 === 0) {
    return { ...INTENT_TEMPLATES.pressure };
  }
  return { ...INTENT_TEMPLATES.strike };
}

export default class CombatEngine {
  constructor(root) {
    this.root = root;
    this.statusElement = root.querySelector('#combat-status');
    this.logElement = root.querySelector('#combat-log');
    this.actionsElement = root.querySelector('.combat-actions');
    this.itemList = root.querySelector('#combat-item-list');
    this.turnElement = root.querySelector('#combat-turn-indicator');
    this.intentTitleElement = root.querySelector('#combat-intent-title');
    this.intentHintElement = root.querySelector('#combat-intent-hint');
    this.playerNameElement = root.querySelector('#combat-player-name');
    this.playerVitalsElement = root.querySelector('#combat-player-vitals');
    this.playerBarElement = root.querySelector('#combat-player-bar');
    this.playerStateElement = root.querySelector('#combat-player-state');
    this.enemyNameElement = root.querySelector('#combat-enemy-name');
    this.enemyVitalsElement = root.querySelector('#combat-enemy-vitals');
    this.enemyBarElement = root.querySelector('#combat-enemy-bar');
    this.enemyStateElement = root.querySelector('#combat-enemy-state');
    this.staggerFillElement = root.querySelector('#combat-stagger-fill');
    this.staggerTextElement = root.querySelector('#combat-stagger-text');
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
    this.playerGuard = { defense: 1, damage: 1, readiedIntentId: null };
    this.enemyGuard = { defense: 1, damage: 1 };
    this.turnCount = 0;
    this.turn = 'player';
    this.active = true;
    this.playerMode = 'melee';
    this.playerOpening = 0;
    this.enemyStagger = 0;
    this.enemyStunnedTurns = 0;
    this.lastPlayerAction = null;
    this.repeatedActionCount = 0;
    this.lastEnemyCondition = null;
    this.enemyIntent = getIntentForEnemy(enemy, this.turnCount);
    this.logElement.innerHTML = '';
    this.itemList.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.renderActionButtons();
    this.appendLog(`A ${enemy.name} emerges!`);
    this.appendLog(`${enemy.name} telegraphs ${this.enemyIntent.title.toLowerCase()}. ${this.enemyIntent.hint}`);
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
    this.enemyIntent = null;
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  getSnapshot() {
    if (!this.active) {
      return { active: false };
    }
    return {
      active: true,
      turn: this.turn,
      mode: this.playerMode,
      intent: this.enemyIntent ? {
        id: this.enemyIntent.id,
        title: this.enemyIntent.title,
        hint: this.enemyIntent.hint,
        counterMode: this.enemyIntent.counterMode
      } : null,
      enemyStagger: Math.round(this.enemyStagger),
      staggerThreshold: this.getStaggerThreshold(),
      playerOpening: this.playerOpening,
      readiedIntentId: this.playerGuard.readiedIntentId
    };
  }

  renderActionButtons() {
    this.actionsElement.innerHTML = `
      <button class="combat-action" data-action="melee">${ACTION_SHORTCUTS.melee} Melee</button>
      <button class="combat-action" data-action="bow">${ACTION_SHORTCUTS.bow} Bow</button>
      <button class="combat-action" data-action="spell">${ACTION_SHORTCUTS.spell} Spell</button>
      <button class="combat-action" data-action="defend">${ACTION_SHORTCUTS.defend} Defend</button>
      <button class="combat-action" data-action="item">${ACTION_SHORTCUTS.item} Item</button>
      <button class="combat-action" data-action="flee">${ACTION_SHORTCUTS.flee} Flee</button>
    `;
    this.syncActionButtonStates();
  }

  handleKeyAction(key) {
    const action = Object.entries(ACTION_SHORTCUTS).find(([, shortcut]) => shortcut === key)?.[0];
    if (!action || !this.active || this.turn !== 'player') {
      return false;
    }
    if (action === 'melee' || action === 'bow' || action === 'spell') {
      this.closeItemMenu();
      this.playerAttack(action);
      return true;
    }
    if (action === 'defend') {
      this.closeItemMenu();
      this.playerDefend();
      return true;
    }
    if (action === 'item') {
      this.toggleItemMenu();
      return true;
    }
    if (action === 'flee') {
      this.closeItemMenu();
      this.playerFlee();
      return true;
    }
    return false;
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
      const isRecommended = this.active && this.turn === 'player' && this.enemyIntent?.counterMode === action;
      const isSpell = action === 'spell';
      const spellCost = getModeConfig('spell').mpCost;
      button.classList.toggle('is-active', isActive);
      button.classList.toggle('is-recommended', isRecommended);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isItem) {
        button.textContent = isActive ? `${ACTION_SHORTCUTS.item} Item (Open)` : `${ACTION_SHORTCUTS.item} Item`;
      }
      if (isSpell) {
        button.disabled = Boolean(this.player?.character && this.player.character.currentMP < spellCost);
      } else {
        button.disabled = false;
      }
    });
  }

  openItemMenu() {
    const consumables = this.player.character.inventory.filter((item) => item.type === 'consumable');
    this.itemList.innerHTML = '';
    if (consumables.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'combat-item-empty';
      empty.textContent = 'No consumables available. Press 5 again or Esc to close.';
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

  getStaggerThreshold() {
    return 55 + (this.enemy?.level || 1) * 10;
  }

  getRepetitionMultiplier(mode, counteredIntent) {
    if (counteredIntent || this.lastPlayerAction !== mode) {
      return 1;
    }
    const penaltySteps = Math.max(0, this.repeatedActionCount);
    return Math.max(0.76, 1 - penaltySteps * 0.08);
  }

  notePlayerAction(mode, counteredIntent) {
    if (counteredIntent || this.lastPlayerAction !== mode) {
      this.repeatedActionCount = 0;
    } else {
      this.repeatedActionCount += 1;
    }
    this.lastPlayerAction = mode;
  }

  calculateStaggerGain(damage, counteredIntent) {
    let amount = 8 + damage * 1.2;
    if (counteredIntent) amount += 18;
    if (this.playerOpening > 0) amount += this.playerOpening * 6;
    return amount;
  }

  applyEnemyStagger(amount) {
    this.enemyStagger = clamp(this.enemyStagger + amount, 0, this.getStaggerThreshold());
    if (this.enemyStagger >= this.getStaggerThreshold()) {
      this.enemyStagger = Math.round(this.getStaggerThreshold() * 0.22);
      this.enemyStunnedTurns = 1;
      return true;
    }
    return false;
  }

  decayEnemyStagger(amount = 10) {
    this.enemyStagger = Math.max(0, this.enemyStagger - amount);
  }

  announceNextIntent() {
    if (!this.enemyIntent || !this.enemy?.isAlive()) return;
    this.appendLog(`${this.enemy.name} sets up ${this.enemyIntent.title.toLowerCase()}. ${this.enemyIntent.hint}`);
  }

  reportEnemyConditionShift() {
    const next = getEnemyCondition(this.enemy);
    if (!next || next === this.lastEnemyCondition) {
      return;
    }
    this.lastEnemyCondition = next;
    this.appendLog(`The ${this.enemy.name} ${next}.`);
  }

  prepareNextIntent(announce = true) {
    this.enemyIntent = getIntentForEnemy(this.enemy, this.turnCount);
    if (announce) {
      this.announceNextIntent();
    }
    this.updateStatus();
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

    const intent = this.enemyIntent;
    const counteredIntent = Boolean(intent && intent.counterMode === mode);
    const attackPower = this.getPlayerAttackPower(mode);
    const variance = 0.85 + Math.random() * 0.3;
    const baseDefense = this.enemy.defense * this.enemyGuard.defense * config.defenseFactor;
    const openingMultiplier = 1 + this.playerOpening * 0.18;
    const counterMultiplier = counteredIntent ? 1.28 : 1;
    const repetitionMultiplier = this.getRepetitionMultiplier(mode, counteredIntent);
    const raw = (attackPower * this.playerGuard.damage - baseDefense) * variance;
    const damage = Math.max(
      1,
      Math.round(raw * getMatchupMultiplier(this.enemy, mode) * openingMultiplier * counterMultiplier * repetitionMultiplier)
    );

    this.enemyGuard.defense = 1;
    this.playerGuard.damage = 1;
    this.enemy.takeDamage(damage);

    let message = `You ${config.verb} the ${this.enemy.name} for ${damage} damage.`;
    if (counteredIntent) {
      message += ` The ${intent.title.toLowerCase()} is disrupted.`;
    }
    if (this.playerOpening > 0) {
      message += ' You cash in the opening you created.';
    }
    if (repetitionMultiplier < 1) {
      message += ` The ${this.enemy.name} is starting to read that rhythm.`;
    }
    this.appendLog(message);
    this.notePlayerAction(mode, counteredIntent);

    const staggered = this.applyEnemyStagger(this.calculateStaggerGain(damage, counteredIntent));
    this.playerOpening = 0;
    this.triggerHitFlash();
    if (damage > 10 || staggered) this.triggerScreenShake();
    this.reportEnemyConditionShift();
    if (staggered) {
      this.appendLog(`The ${this.enemy.name}'s guard breaks under the pressure.`);
    }
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
    this.playerGuard.defense = 1.7;
    this.playerGuard.damage = 0.65;
    this.playerGuard.readiedIntentId = this.enemyIntent?.id || null;
    if (this.enemyIntent) {
      this.appendLog(`You brace for ${this.enemyIntent.title.toLowerCase()} and watch for the recovery.`);
    } else {
      this.appendLog('You brace yourself for the next attack.');
    }
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
    if (this.enemyStunnedTurns > 0) {
      this.enemyStunnedTurns -= 1;
      this.appendLog(`The ${this.enemy.name} reels and cannot answer your assault.`);
      this.turn = 'player';
      this.prepareNextIntent(true);
      return;
    }

    this.turnCount += 1;
    const intent = this.enemyIntent || getIntentForEnemy(this.enemy, this.turnCount - 1);
    if (typeof this[intent.action] === 'function') {
      this[intent.action](intent);
      return;
    }
    this.enemyAttack(intent);
  }

  enemyAttack(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} hits you`,
      damageType: 'physical',
      multiplier: 1,
      intent
    });
  }

  enemyPressure(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} presses in`,
      damageType: 'physical',
      multiplier: 1.05,
      intent
    });
  }

  enemyAggressiveStrike(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} dives at you in a savage rush`,
      damageType: 'physical',
      multiplier: 1.2,
      intent
    });
  }

  enemyLightning(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} hurls lightning`,
      damageType: 'lightning',
      multiplier: 1.15,
      intent
    });
  }

  enemyBreath(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} breathes a cone of fire`,
      damageType: 'fire',
      multiplier: 1.35,
      intent
    });
  }

  enemyBurst(intent = null) {
    this.resolveIncomingAttack({
      label: `The ${this.enemy.name} unleashes a burst of force`,
      damageType: 'magic',
      multiplier: 1.2,
      intent
    }, 2);
  }

  enemyFortify(intent = null) {
    this.enemyGuard.defense = 1.45;
    this.enemyGuard.damage = 1.08;
    this.decayEnemyStagger(14);
    this.appendLog(`The ${this.enemy.name} settles into a guarded stance, waiting for you to overcommit.`);
    this.turn = 'player';
    this.prepareNextIntent(true);
  }

  resolveIncomingAttack({ label, damageType = 'physical', multiplier = 1, intent = null }, hits = 1) {
    const resistance = this.player.character.getDamageMultiplier(damageType);
    const readiedIntent = Boolean(intent?.id && this.playerGuard.readiedIntentId === intent.id);
    const braceMultiplier = readiedIntent ? 0.52 : 1;
    let totalDamage = 0;

    for (let i = 0; i < hits; i += 1) {
      const variance = 0.85 + Math.random() * 0.3;
      const defenseFactor = damageType === 'magic' ? 0.7 : 1;
      const raw = (
        this.enemy.attack * this.enemyGuard.damage * multiplier -
        this.player.character.defense * this.playerGuard.defense * defenseFactor
      ) * variance;
      let damage = resistance <= 0 ? 0 : Math.max(1, Math.round(raw * resistance));
      if (damage > 0) {
        damage = Math.max(0, Math.round(damage * braceMultiplier));
      }
      totalDamage += damage;
    }

    this.enemyGuard.damage = 1;
    this.playerGuard.defense = 1;
    this.playerGuard.readiedIntentId = null;
    this.decayEnemyStagger(8);

    if (totalDamage <= 0) {
      this.appendLog('The Storm Cloak repels the attack.');
    } else {
      this.player.character.takeDamage(totalDamage);
      let message = `${label} for ${totalDamage} damage.`;
      if (readiedIntent) {
        message += ' Your guard turns the worst of it aside.';
      }
      this.appendLog(message);
      this.triggerHitFlash(damageType === 'physical' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(120, 180, 255, 0.45)');
      if (totalDamage > 10) this.triggerScreenShake();
    }

    if (readiedIntent) {
      this.playerOpening = Math.min(2, this.playerOpening + 1);
      this.appendLog('You spot an opening in the recovery.');
    }

    this.updateStatus();
    if (!this.player.character.isAlive()) {
      this.defeat();
      return;
    }
    this.turn = 'player';
    this.prepareNextIntent(true);
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

  renderBattleState() {
    if (!this.active || !this.player?.character || !this.enemy) return;
    const playerCharacter = this.player.character;
    const playerHpRatio = playerCharacter.maxHP ? clamp(playerCharacter.currentHP / playerCharacter.maxHP, 0, 1) : 0;
    const enemyHpRatio = this.enemy.maxHP ? clamp(this.enemy.currentHP / this.enemy.maxHP, 0, 1) : 0;
    const mode = getModeConfig(this.playerMode)?.label || 'Melee';

    this.root.dataset.intentTone = this.enemyIntent?.tone || 'steel';
    this.turnElement.textContent = this.enemyStunnedTurns > 0
      ? `${this.enemy.name} is reeling`
      : (this.turn === 'player' ? 'Your turn' : `${this.enemy.name}'s turn`);

    if (this.enemyStunnedTurns > 0) {
      this.intentTitleElement.textContent = 'Broken Guard';
      this.intentHintElement.textContent = `${this.enemy.name} is staggered. Press the advantage before it recovers.`;
    } else if (this.enemyIntent) {
      this.intentTitleElement.textContent = this.enemyIntent.title;
      this.intentHintElement.textContent = this.enemyIntent.hint;
    } else {
      this.intentTitleElement.textContent = 'Watch the foe';
      this.intentHintElement.textContent = 'Read the field before you commit.';
    }

    this.playerNameElement.textContent = playerCharacter.name;
    this.playerVitalsElement.textContent = `HP ${playerCharacter.currentHP}/${playerCharacter.maxHP}  MP ${playerCharacter.currentMP}/${playerCharacter.maxMP}`;
    this.playerBarElement.style.width = `${Math.round(playerHpRatio * 100)}%`;
    if (this.playerOpening > 0) {
      this.playerStateElement.textContent = `Opening ready x${this.playerOpening}. ${mode} stance is set.`;
    } else if (this.playerGuard.readiedIntentId) {
      this.playerStateElement.textContent = 'Braced and reading the next exchange.';
    } else {
      this.playerStateElement.textContent = `Current stance: ${mode}.`;
    }

    this.enemyNameElement.textContent = this.enemy.name;
    this.enemyVitalsElement.textContent = `HP ${this.enemy.currentHP}/${this.enemy.maxHP}  LV ${this.enemy.level}`;
    this.enemyBarElement.style.width = `${Math.round(enemyHpRatio * 100)}%`;
    const enemyState = getEnemyCondition(this.enemy);
    this.enemyStateElement.textContent = enemyState
      ? `The ${this.enemy.name} ${enemyState}.`
      : `${this.enemy.name} still has full fighting shape.`;

    const threshold = this.getStaggerThreshold();
    this.staggerFillElement.style.width = `${Math.round((this.enemyStagger / threshold) * 100)}%`;
    this.staggerTextElement.textContent = this.enemyStunnedTurns > 0
      ? 'Guard broken'
      : `${Math.round(this.enemyStagger)}/${threshold} stagger`;
  }

  updateStatus() {
    const mode = getModeConfig(this.playerMode)?.label || 'Melee';
    const openingText = this.playerOpening > 0 ? ` - Opening x${this.playerOpening}` : '';
    this.statusElement.textContent = `HP ${this.player.character.currentHP}/${this.player.character.maxHP} - MP ${this.player.character.currentMP}/${this.player.character.maxMP} - ${this.enemy.name}: ${this.enemy.currentHP}/${this.enemy.maxHP} - Mode: ${mode}${openingText}`;
    this.renderBattleState();
    this.syncActionButtonStates();
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
