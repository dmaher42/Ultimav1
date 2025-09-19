import ItemGenerator from './ItemGenerator.js';

function calculateDamage(attacker, defender, attackerGuard = 1, defenderGuard = 1) {
  const baseAttack = attacker.attack;
  const baseDefense = defender.defense * defenderGuard;
  const variance = 0.8 + Math.random() * 0.4;
  const raw = (baseAttack - baseDefense) * variance;
  const damage = Math.max(1, Math.round(raw));
  return Math.max(1, Math.round(damage * attackerGuard));
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
    this.turn = 'player';
    this.active = true;
    this.logElement.innerHTML = '';
    this.itemList.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.appendLog(`A ${enemy.name} emerges!`);
    this.updateStatus();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  end(result) {
    this.active = false;
    this.root.classList.add('hidden');
    this.itemList.classList.add('hidden');
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  handleAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.active || this.turn !== 'player') return;
    const action = button.dataset.action;
    if (action === 'attack') {
      this.playerAttack();
    } else if (action === 'defend') {
      this.playerDefend();
    } else if (action === 'item') {
      this.showItems();
    } else if (action === 'flee') {
      this.playerFlee();
    }
  }

  showItems() {
    const consumables = this.player.character.inventory.filter((item) => item.type === 'consumable');
    if (consumables.length === 0) {
      this.appendLog('No consumables available.');
      return;
    }
    this.itemList.innerHTML = '';
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
    this.itemList.classList.remove('hidden');
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
    this.itemList.classList.add('hidden');
    this.updateStatus();
    this.turn = 'enemy';
    this.enemyTurn();
  }

  playerAttack() {
    this.itemList.classList.add('hidden');
    const damage = calculateDamage(
      this.player.character,
      this.enemy,
      this.playerGuard.damage,
      this.enemyGuard.defense
    );
    this.enemyGuard.defense = 1;
    this.playerGuard.damage = 1;
    this.enemy.takeDamage(damage);
    this.appendLog(`You strike the ${this.enemy.name} for ${damage} damage.`);
    this.updateStatus();
    if (!this.enemy.isAlive()) {
      this.victory();
      return;
    }
    this.turn = 'enemy';
    this.enemyTurn();
  }

  playerDefend() {
    this.itemList.classList.add('hidden');
    this.playerGuard.defense = 1.5;
    this.playerGuard.damage = 0.5;
    this.appendLog('You brace yourself for the next attack.');
    this.turn = 'enemy';
    this.enemyTurn();
  }

  playerFlee() {
    this.itemList.classList.add('hidden');
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
    const decision = Math.random();
    if (decision < 0.7 || this.enemyGuard.defense > 1) {
      this.enemyAttack();
    } else {
      this.enemyDefend();
    }
  }

  enemyAttack() {
    const damage = calculateDamage(
      this.enemy,
      this.player.character,
      this.enemyGuard.damage,
      this.playerGuard.defense
    );
    this.enemyGuard.damage = 1;
    this.playerGuard.defense = 1;
    this.player.character.takeDamage(damage);
    this.appendLog(`The ${this.enemy.name} hits you for ${damage} damage.`);
    this.updateStatus();
    if (!this.player.character.isAlive()) {
      this.defeat();
      return;
    }
    this.turn = 'player';
  }

  enemyDefend() {
    this.enemyGuard.defense = 1.5;
    this.enemyGuard.damage = 0.5;
    this.appendLog(`The ${this.enemy.name} guards cautiously.`);
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
    this.statusElement.textContent = `HP ${this.player.character.currentHP}/${this.player.character.maxHP} · MP ${this.player.character.currentMP}/${this.player.character.maxMP} — ${this.enemy.name}: ${this.enemy.currentHP}/${this.enemy.maxHP}`;
  }
}
