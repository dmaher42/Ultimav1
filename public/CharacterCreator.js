import Character from './Character.js';

const STAT_LABELS = {
  STR: 'Strength',
  DEX: 'Dexterity',
  INT: 'Intelligence',
  VIT: 'Vitality',
  LUK: 'Luck'
};

const TOTAL_POINTS = 75;

function randomStat() {
  return 10 + Math.floor(Math.random() * 9);
}

function rollStats() {
  let stats;
  do {
    stats = {};
    let sum = 0;
    Character.STAT_KEYS.forEach((key) => {
      const value = randomStat();
      stats[key] = value;
      sum += value;
    });
    if (sum <= TOTAL_POINTS) {
      return stats;
    }
  } while (true);
}

export default class CharacterCreator {
  constructor(root) {
    this.root = root;
    this.stats = rollStats();
    this.form = document.createElement('form');
    this.form.autocomplete = 'off';
    this.form.innerHTML = `
      <h2>Create Your Hero</h2>
      <label for="character-name">Name</label>
      <input id="character-name" name="name" type="text" maxlength="24" required placeholder="Briton" />
      <div class="creator-stats"></div>
      <div class="creator-remaining">Remaining points: <strong id="creator-remaining"></strong></div>
      <div class="creator-derived"></div>
      <div class="creator-actions">
        <button type="button" id="creator-reroll">Reroll</button>
        <button type="submit">Begin Adventure</button>
      </div>`;
    this.root.appendChild(this.form);
    this.statsContainer = this.form.querySelector('.creator-stats');
    this.remainingLabel = this.form.querySelector('#creator-remaining');
    this.derivedContainer = this.form.querySelector('.creator-derived');
    this.rerollButton = this.form.querySelector('#creator-reroll');
    this.nameInput = this.form.querySelector('#character-name');
    this.renderStats();
    this.updateRemaining();
    this.updateDerived();
    this.bindEvents();
  }

  bindEvents() {
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.getRemainingPoints() < 0) {
        return;
      }
      const name = this.nameInput.value.trim() || 'Adventurer';
      const stats = { ...this.stats };
      Object.keys(stats).forEach((key) => {
        stats[key] = Math.max(10, Math.min(18, Math.floor(stats[key])));
      });
      const character = new Character({ name, stats });
      this.close(character);
    });

    this.rerollButton.addEventListener('click', () => {
      this.stats = rollStats();
      this.renderStats();
      this.updateRemaining();
      this.updateDerived();
    });
  }

  renderStats() {
    this.statsContainer.innerHTML = '';
    Character.STAT_KEYS.forEach((key) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'creator-stat';
      const label = document.createElement('label');
      label.textContent = STAT_LABELS[key];
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 10;
      input.max = 18;
      input.step = 1;
      input.value = this.stats[key];
      input.dataset.stat = key;
      input.addEventListener('input', () => {
        const value = Math.min(18, Math.max(10, Math.floor(Number(input.value) || 10)));
        this.stats[key] = value;
        input.value = value;
        this.updateRemaining();
        this.updateDerived();
      });
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      this.statsContainer.appendChild(wrapper);
    });
  }

  getRemainingPoints() {
    const total = Character.STAT_KEYS.reduce((sum, key) => sum + this.stats[key], 0);
    return TOTAL_POINTS - total;
  }

  updateRemaining() {
    const remaining = this.getRemainingPoints();
    this.remainingLabel.textContent = `${remaining}`;
    this.remainingLabel.style.color = remaining < 0 ? '#ff9b9b' : '#dff6cf';
  }

  updateDerived() {
    const vit = this.stats.VIT;
    const intStat = this.stats.INT;
    const str = this.stats.STR;
    const weaponAttack = str;
    const defense = vit;
    this.derivedContainer.innerHTML = `
      <div>HP: ${vit * 10} | MP: ${intStat * 5}</div>
      <div>Attack: ${weaponAttack} | Defense: ${defense}</div>`;
  }

  async open() {
    this.root.classList.remove('hidden');
    this.nameInput.focus();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  close(character) {
    this.root.classList.add('hidden');
    if (this.resolve) {
      this.resolve(character);
      this.resolve = null;
    }
  }
}
