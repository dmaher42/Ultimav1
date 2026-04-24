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

const ACTION_LABELS = {
  melee: 'Melee',
  bow: 'Bow',
  spell: 'Spell',
  defend: 'Defend',
  item: 'Item',
  flee: 'Flee'
};

const INTENT_TEMPLATES = {
  strike: {
    id: 'strike',
    title: 'Blade Line',
    hint: 'It squares up at close range; steel or a braced guard can meet the blow.',
    counterMode: 'melee',
    action: 'enemyAttack',
    tone: 'steel',
    range: 'close',
    hazardSlot: 'close',
    marker: 'Blade lane',
    threat: 'A weapon lane opens directly in front of you.',
    preview: 'The foe plants its feet and draws a clean line toward your ribs.'
  },
  pressure: {
    id: 'pressure',
    title: 'Crushing Advance',
    hint: 'Arcane force or a disciplined guard can slow the closing pressure.',
    counterMode: 'spell',
    action: 'enemyPressure',
    tone: 'steel',
    range: 'close',
    hazardSlot: 'close',
    marker: 'Pressing line',
    threat: 'The front line is being squeezed.',
    preview: 'The foe crowds the space, trying to make the fight small and ugly.'
  },
  rush: {
    id: 'rush',
    title: 'Winged Rush',
    hint: 'A fast bow shot can catch the lunge before it crashes into the line.',
    counterMode: 'bow',
    action: 'enemyAggressiveStrike',
    tone: 'steel',
    range: 'closing',
    hazardSlot: 'close',
    marker: 'Rush lane',
    threat: 'The enemy is about to collapse the distance.',
    preview: 'Muscle tightens and the whole battlefield seems to lean forward.'
  },
  lightning: {
    id: 'lightning',
    title: 'Charged Lightning Chant',
    hint: 'Close in with melee before the charge finds a path through you.',
    counterMode: 'melee',
    action: 'enemyLightning',
    tone: 'arcane',
    range: 'far',
    hazardSlot: 'far',
    marker: 'Charged arc',
    threat: 'A blue-white charge builds over the battlefield.',
    preview: 'The air tastes of iron as the chant pulls sparks from the floor.'
  },
  breath: {
    id: 'breath',
    title: 'Inferno Cone',
    hint: "Spell pressure can break the drake's inhale before the cone blooms.",
    counterMode: 'spell',
    action: 'enemyBreath',
    tone: 'ember',
    range: 'far',
    hazardSlot: 'far',
    marker: 'Heat cone',
    threat: 'A cone of heat threatens the whole line.',
    preview: 'Heat rolls outward before the flame, turning the ground amber.'
  },
  burst: {
    id: 'burst',
    title: 'Unstable Eye Burst',
    hint: "A precise bow shot can spoil the gazer's focus before it ruptures.",
    counterMode: 'bow',
    action: 'enemyBurst',
    tone: 'arcane',
    range: 'mid',
    hazardSlot: 'mid',
    marker: 'Warped zone',
    threat: 'A warped blast zone gathers around the eye.',
    preview: 'The air buckles around the gaze, as if the world is about to blink.'
  },
  fortify: {
    id: 'fortify',
    title: 'Guarded Shell',
    hint: 'Spellwork slips through a raised guard better than brute force.',
    counterMode: 'spell',
    action: 'enemyFortify',
    tone: 'steel',
    range: 'mid',
    hazardSlot: 'mid',
    marker: 'Guard shell',
    threat: 'The foe has withdrawn into a hard shell.',
    preview: 'Its guard closes like a door, daring you to strike first.'
  }
};

const MODE_FIELD_EFFECTS = {
  melee: {
    range: 'close',
    posture: 'Committed',
    text: 'You step into the front line where blades, claws, and breath all feel close.'
  },
  bow: {
    range: 'far',
    posture: 'Measured',
    text: 'You give ground and look for a clean shot through the chaos.'
  },
  spell: {
    range: 'mid',
    posture: 'Channeling',
    text: 'You hold the middle distance and shape the air into force.'
  },
  defend: {
    posture: 'Braced',
    text: 'You lower your stance and let the enemy reveal its weight.'
  }
};

const BATTLE_CONTEXTS = {
  castle: {
    label: 'Throne Room',
    ground: 'Marble underfoot',
    partyLine: 'Dupre braces the royal line beside you.'
  },
  lycaeum_entrance: {
    label: 'Lycaeum Grounds',
    ground: 'Stone steps and open air',
    partyLine: 'Iolo watches the angles between columns.'
  },
  village: {
    label: 'Britanny Bay',
    ground: 'Packed earth and market stones',
    partyLine: 'Shamino keeps one eye on the bystanders.'
  },
  dungeon_1: {
    label: 'Dark Caverns',
    ground: 'Wet stone and narrow walls',
    partyLine: 'Dupre keeps his shield close in the tunnel.'
  },
  overworld: {
    label: 'Wilds',
    ground: 'Grass, mud, and broken trail',
    partyLine: 'Iolo calls distances through the wind.'
  },
  default: {
    label: 'Battlefield',
    ground: 'Unsteady ground',
    partyLine: 'Your companions hold the line around you.'
  }
};

const ENEMY_PROFILES = {
  gargoyle: {
    family: 'Gargoyle',
    entrance: '{enemy} lands with drilled, brutal discipline.',
    stance: '{enemy} fights like a soldier, not a beast.',
    hit: {
      melee: "You meet {enemy}'s disciplined guard and force it back for {damage} damage.",
      bow: 'Your shot catches {enemy} between wingbeats for {damage} damage.',
      spell: 'Spellfire crawls across {enemy} for {damage} damage.'
    },
    attack: {
      pressure: '{enemy} hammers forward, step after disciplined step',
      rush: '{enemy} folds its wings and crashes into the line'
    },
    breakLine: "{enemy}'s drilled guard finally buckles."
  },
  reaper: {
    family: 'Reaper',
    entrance: '{enemy} rises like a curse from the edge of sight.',
    stance: 'The air around {enemy} feels colder than the room.',
    hit: {
      melee: 'You cut through the dead hush around {enemy} for {damage} damage.',
      bow: 'Your arrow vanishes into the gloom around {enemy}, dealing {damage} damage.',
      spell: 'Your spell tears a bright wound through {enemy} for {damage} damage.'
    },
    attack: {
      pressure: '{enemy} presses its shadow across your footing',
      lightning: '{enemy} lifts a claw and the chant becomes lightning'
    },
    breakLine: "{enemy}'s chant falters into a rasping hiss."
  },
  drake: {
    family: 'Drake',
    entrance: '{enemy} drags heat and weight into the fight.',
    stance: 'Every breath from {enemy} makes the battlefield feel smaller.',
    hit: {
      melee: 'You strike hot scale for {damage} damage.',
      bow: 'Your arrow punches beneath a scale ridge for {damage} damage.',
      spell: 'Your spell bites through the heat haze for {damage} damage.'
    },
    attack: {
      pressure: '{enemy} uses its weight to grind the line backward',
      breath: '{enemy} draws in a furnace-breath'
    },
    breakLine: "{enemy}'s massive stance slips and the heat breaks around it."
  },
  gazer: {
    family: 'Gazer',
    entrance: '{enemy} floats into view, every eye twitching with force.',
    stance: '{enemy} makes the space around it feel wrong.',
    hit: {
      melee: 'You slash through the warped air around {enemy} for {damage} damage.',
      bow: 'Your shot pierces the wobbling focus around {enemy} for {damage} damage.',
      spell: 'Magic snaps back against {enemy}, dealing {damage} damage.'
    },
    attack: {
      pressure: '{enemy} crowds your senses without moving',
      burst: '{enemy} gathers a sickly pulse behind its eye'
    },
    breakLine: "{enemy}'s focus fractures into a dozen twitching glances."
  },
  wolf: {
    family: 'Beast',
    entrance: '{enemy} circles low, teeth bright in the dim light.',
    stance: '{enemy} tests the edge of the line for weakness.',
    hit: {
      melee: 'You catch {enemy} as it darts in, dealing {damage} damage.',
      bow: 'Your shot clips {enemy} mid-step for {damage} damage.',
      spell: 'Your spell sends {enemy} skidding for {damage} damage.'
    },
    attack: {
      strike: '{enemy} snaps at your lead side',
      pressure: '{enemy} circles and herds you toward bad footing'
    },
    breakLine: "{enemy}'s rhythm breaks into a panicked skid."
  },
  default: {
    family: 'Foe',
    entrance: '{enemy} pushes into the fight.',
    stance: '{enemy} watches for a mistake.',
    hit: {
      melee: 'You drive in and strike {enemy} for {damage} damage.',
      bow: 'Your shot lands on {enemy} for {damage} damage.',
      spell: 'Your spell strikes {enemy} for {damage} damage.'
    },
    attack: {
      strike: '{enemy} cuts into your space',
      pressure: '{enemy} presses forward',
      rush: '{enemy} rushes the line',
      lightning: '{enemy} releases a charged bolt',
      breath: '{enemy} breathes fire across the line',
      burst: '{enemy} releases a burst of force'
    },
    breakLine: "{enemy}'s guard breaks."
  }
};

const PARTY_CALLOUTS = {
  read: ['Dupre: Hold it there. Now answer!', 'Iolo: That is the opening. Take it!'],
  counter: ['Iolo: Clean line!', 'Shamino: You caught its reach.'],
  break: ['Dupre: Its guard is gone!', 'Iolo: Press it before it recovers!'],
  danger: ['Shamino: Watch the ground!', 'Dupre: Line holds. Brace!']
};

const PARTY_FORMATIONS = {
  steady: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'holding the front' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'watching the lane' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'guarding the flank' }
  ],
  melee: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'steps in beside you' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'covers the back line' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'keeps the flank clear' }
  ],
  bow: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'buys you space' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'calls the shot' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'marks the escape line' }
  ],
  spell: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'locks the front' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'keeps pressure off you' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'watches the casting space' }
  ],
  defend: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'braces the line' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'waits for the recovery' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'reads the footing' }
  ],
  danger: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'absorbs the shock' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'shouts a warning' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'pulls the flank back' }
  ],
  break: [
    { id: 'dupre', name: 'Dupre', role: 'Shield', state: 'pushes forward' },
    { id: 'iolo', name: 'Iolo', role: 'Bow', state: 'has a clean angle' },
    { id: 'shamino', name: 'Shamino', role: 'Scout', state: 'cuts off retreat' }
  ]
};

const RANGE_SLOT_LABELS = {
  close: 'Close',
  closing: 'Close',
  mid: 'Mid',
  far: 'Far'
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

function formatLine(template, values = {}) {
  return Object.entries(values).reduce(
    (line, [key, value]) => line.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function getEnemyProfile(enemy) {
  const key = enemy?.tactic && enemy.tactic !== 'default' ? enemy.tactic : (enemy?.id || 'default');
  return ENEMY_PROFILES[key] || ENEMY_PROFILES[enemy?.id] || ENEMY_PROFILES.default;
}

function getBattleContext(context = {}) {
  const mapId = context.map?.id || context.mapId || 'default';
  const base = BATTLE_CONTEXTS[mapId] || BATTLE_CONTEXTS.default;
  return {
    key: mapId,
    label: base.label || context.map?.name || 'Battlefield',
    ground: base.ground,
    partyLine: base.partyLine
  };
}

function getRangeSlot(range = 'mid') {
  return RANGE_SLOT_LABELS[range] ? range : 'mid';
}

function getPartyFormation(focus = 'steady') {
  const formation = PARTY_FORMATIONS[focus] || PARTY_FORMATIONS.steady;
  return formation.map((member) => ({ ...member }));
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
    this.onboardingElement = root.querySelector('#combat-onboarding');
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
    this.fieldContextElement = root.querySelector('#combat-field-context');
    this.fieldRangeElement = root.querySelector('#combat-field-range');
    this.fieldThreatElement = root.querySelector('#combat-field-threat');
    this.fieldPartyElement = root.querySelector('#combat-field-party');
    this.spaceLabelElement = root.querySelector('#combat-space-label');
    this.enemyMarkerElement = root.querySelector('#combat-enemy-marker');
    this.threatMarkerElement = root.querySelector('#combat-threat-marker');
    this.terrainCueElement = root.querySelector('#combat-terrain-cue');
    this.partyFormationElement = root.querySelector('#combat-party-formation');
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

  start(player, enemy, context = {}) {
    this.player = player;
    this.enemy = enemy;
    this.enemyProfile = getEnemyProfile(enemy);
    this.battlefield = this.createBattlefieldState(context);
    this.playerGuard = { defense: 1, damage: 1, readiedIntentId: null };
    this.enemyGuard = { defense: 1, damage: 1 };
    this.turnCount = 0;
    this.turn = 'player';
    this.active = true;
    this.category = context.category || null;
    this.showOnboarding = this.category === 'throne_ambush' || Boolean(context.onboarding);
    this.onUpdate = typeof context.onUpdate === 'function' ? context.onUpdate : null;
    this.playerMode = 'melee';
    this.playerOpening = 0;
    this.enemyStagger = 0;
    this.enemyStunnedTurns = 0;
    this.lastPlayerAction = null;
    this.repeatedActionCount = 0;
    this.lastEnemyCondition = null;
    this.partyCalloutCooldown = 0;
    this.enemyIntent = getIntentForEnemy(enemy, this.turnCount);
    this.updateBattlefieldForIntent(this.enemyIntent);
    this.logElement.innerHTML = '';
    this.itemList.classList.add('hidden');
    this.root.classList.remove('hidden');
    this.root.classList.toggle('has-onboarding', this.showOnboarding);
    this.renderActionButtons();
    this.appendLog(formatLine(this.enemyProfile.entrance, { enemy: enemy.name }));
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
    this.root.classList.remove('has-onboarding');
    this.closeItemMenu();
    this.enemyIntent = null;
    this.onUpdate = null;
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }

  createBattlefieldState(context) {
    const battleContext = getBattleContext(context);
    return {
      contextKey: battleContext.key,
      contextLabel: battleContext.label,
      ground: battleContext.ground,
      range: 'mid',
      posture: 'Ready',
      enemySlot: 'mid',
      hazardSlot: 'mid',
      hazardLabel: 'Reading',
      spaceLine: 'Party line steady. Enemy at mid range.',
      partyFormation: getPartyFormation('steady'),
      threat: 'The fight opens at weapon-call distance.',
      partyLine: battleContext.partyLine
    };
  }

  updateBattlefieldForIntent(intent) {
    if (!this.battlefield || !intent) return;
    this.battlefield.threat = intent.threat || intent.preview || 'The foe is reading the line.';
    const range = getRangeSlot(intent.range);
    this.battlefield.range = range;
    this.battlefield.enemySlot = range === 'closing' ? 'close' : range;
    this.battlefield.hazardSlot = getRangeSlot(intent.hazardSlot || intent.range);
    this.battlefield.hazardLabel = intent.marker || intent.title || 'Threat';
    this.battlefield.spaceLine = `${this.enemy.name} threatens ${RANGE_SLOT_LABELS[this.battlefield.hazardSlot].toLowerCase()} range. ${this.enemyProfile.family} pressure is ${intent.title.toLowerCase()}.`;
  }

  updateBattlefieldForPlayerAction(mode, counteredIntent) {
    if (!this.battlefield) return;
    const effect = MODE_FIELD_EFFECTS[mode] || MODE_FIELD_EFFECTS.melee;
    const range = getRangeSlot(effect.range || this.battlefield.range);
    this.battlefield.range = range;
    this.battlefield.enemySlot = range;
    this.battlefield.posture = counteredIntent ? 'Exploiting' : effect.posture;
    this.battlefield.hazardSlot = counteredIntent && this.enemyIntent
      ? getRangeSlot(this.enemyIntent.hazardSlot || this.enemyIntent.range)
      : range;
    this.battlefield.hazardLabel = counteredIntent && this.enemyIntent
      ? `Disrupted ${this.enemyIntent.marker || this.enemyIntent.title}`
      : effect.posture;
    this.battlefield.partyFormation = getPartyFormation(mode);
    this.battlefield.spaceLine = counteredIntent
      ? `The party pivots through ${RANGE_SLOT_LABELS[this.battlefield.hazardSlot].toLowerCase()} range and steals the lane.`
      : `The party shifts to support your ${effect.posture.toLowerCase()} ${mode} stance.`;
    this.battlefield.threat = counteredIntent && this.enemyIntent
      ? `You cut across ${this.enemyIntent.title.toLowerCase()} before it owns the space.`
      : effect.text;
  }

  updateBattlefieldForEnemyHit({ damageType, readiedIntent, totalDamage }) {
    if (!this.battlefield) return;
    if (readiedIntent) {
      this.battlefield.posture = 'Braced';
      this.battlefield.hazardLabel = 'Read and held';
      this.battlefield.partyFormation = getPartyFormation('defend');
      this.battlefield.spaceLine = 'The party line absorbs the attack and turns the recovery into space.';
      this.battlefield.threat = 'The line holds and the foe overextends into your guard.';
      return;
    }
    this.battlefield.posture = totalDamage > 0 ? 'Pressed' : 'Protected';
    this.battlefield.hazardLabel = totalDamage > 0 ? 'Impact lane' : 'Blocked lane';
    this.battlefield.partyFormation = getPartyFormation(totalDamage > 0 ? 'danger' : 'defend');
    this.battlefield.spaceLine = totalDamage > 0
      ? 'The party is driven back a step but stays in formation.'
      : 'The party holds its spacing as the attack breaks around you.';
    const threatByType = {
      physical: 'The impact drives through the front line.',
      lightning: 'Lightning crawls over the battlefield and snaps away.',
      fire: 'Heat washes through the lane and leaves smoke in its wake.',
      magic: 'Force buckles the air around the party.'
    };
    this.battlefield.threat = threatByType[damageType] || 'The attack rattles the line.';
  }

  pulseCombat(className, duration = 420) {
    this.root.classList.add(className);
    setTimeout(() => this.root.classList.remove(className), duration);
  }

  maybeAppendPartyCallout(kind) {
    if (!this.battlefield || this.partyCalloutCooldown > 0) {
      this.partyCalloutCooldown = Math.max(0, this.partyCalloutCooldown - 1);
      return;
    }
    const lines = PARTY_CALLOUTS[kind];
    if (!lines?.length) return;
    const index = (this.turnCount + this.enemy.level + this.repeatedActionCount) % lines.length;
    const line = lines[index];
    this.battlefield.partyLine = line;
    const formationFocus = kind === 'counter' ? this.playerMode : (kind === 'read' ? 'defend' : kind);
    this.battlefield.partyFormation = getPartyFormation(formationFocus);
    this.appendLog(line);
    this.partyCalloutCooldown = 2;
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
      readiedIntentId: this.playerGuard.readiedIntentId,
      recommendedAction: this.getRecommendedAction(),
      onboarding: this.showOnboarding,
      battlefield: this.battlefield ? { ...this.battlefield } : null
    };
  }

  getActionLabel(action) {
    const label = ACTION_LABELS[action] || action;
    const shortcut = ACTION_SHORTCUTS[action];
    return shortcut ? `${shortcut} ${label}` : label;
  }

  getRecommendedAction() {
    const action = this.enemyIntent?.counterMode || null;
    if (!action) return null;
    return {
      action,
      label: ACTION_LABELS[action] || action,
      shortcut: ACTION_SHORTCUTS[action] || null,
      display: this.getActionLabel(action)
    };
  }

  getCurrentAdvice() {
    if (!this.active) return null;
    const recommended = this.getRecommendedAction();
    const intentName = this.enemyIntent?.title || 'the next move';
    return {
      intent: intentName,
      counter: recommended?.display || 'the highlighted attack',
      defend: this.getActionLabel('defend'),
      shortcuts: 'Use 1 Melee, 2 Bow, 3 Spell, 4 Defend, 5 Item, 6 Flee.'
    };
  }

  renderActionButtons() {
    this.actionsElement.innerHTML = `
      <button class="combat-action" data-action="melee">${ACTION_SHORTCUTS.melee} Melee <span>close</span></button>
      <button class="combat-action" data-action="bow">${ACTION_SHORTCUTS.bow} Bow <span>far</span></button>
      <button class="combat-action" data-action="spell">${ACTION_SHORTCUTS.spell} Spell <span>mid</span></button>
      <button class="combat-action" data-action="defend">${ACTION_SHORTCUTS.defend} Defend <span>brace</span></button>
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
      button.setAttribute('aria-label', `${this.getActionLabel(action)}${isRecommended ? ' - recommended counter' : ''}`);
      button.title = isRecommended ? `Recommended counter: press ${ACTION_SHORTCUTS[action]}` : `Shortcut: ${ACTION_SHORTCUTS[action]}`;
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
    this.updateBattlefieldForIntent(this.enemyIntent);
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
    this.updateBattlefieldForPlayerAction(mode, counteredIntent);
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

    const hitTemplate = this.enemyProfile.hit?.[mode] || ENEMY_PROFILES.default.hit[mode];
    let message = formatLine(hitTemplate, { enemy: this.enemy.name, damage });
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
    if (counteredIntent) {
      this.maybeAppendPartyCallout('counter');
    }
    this.notePlayerAction(mode, counteredIntent);

    const staggered = this.applyEnemyStagger(this.calculateStaggerGain(damage, counteredIntent));
    this.playerOpening = 0;
    this.triggerHitFlash(mode === 'spell' ? 'rgba(120, 180, 255, 0.45)' : 'rgba(255, 240, 180, 0.35)');
    this.pulseCombat(mode === 'spell' ? 'magic-hit' : 'physical-hit');
    if (damage > 10 || staggered) this.triggerScreenShake();
    this.reportEnemyConditionShift();
    if (staggered) {
      this.battlefield.posture = 'Guard broken';
      this.battlefield.hazardLabel = 'Open lane';
      this.battlefield.partyFormation = getPartyFormation('break');
      this.battlefield.spaceLine = 'The formation surges forward through the broken guard.';
      this.battlefield.threat = formatLine(this.enemyProfile.breakLine || ENEMY_PROFILES.default.breakLine, { enemy: this.enemy.name });
      this.appendLog(this.battlefield.threat);
      this.pulseCombat('guard-break', 520);
      this.maybeAppendPartyCallout('break');
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
    if (this.battlefield) {
      this.battlefield.posture = MODE_FIELD_EFFECTS.defend.posture;
      this.battlefield.hazardSlot = getRangeSlot(this.enemyIntent?.hazardSlot || this.enemyIntent?.range || this.battlefield.hazardSlot);
      this.battlefield.hazardLabel = 'Guard read';
      this.battlefield.partyFormation = getPartyFormation('defend');
      this.battlefield.spaceLine = 'Dupre locks the line while Iolo and Shamino wait for the recovery.';
      this.battlefield.threat = this.enemyIntent
        ? `You brace into ${this.enemyIntent.title.toLowerCase()} and let the threat come to you.`
        : MODE_FIELD_EFFECTS.defend.text;
    }
    if (this.enemyIntent) {
      this.appendLog(`You brace for ${this.enemyIntent.title.toLowerCase()} and watch for the recovery.`);
    } else {
      this.appendLog('You brace yourself for the next attack.');
    }
    this.pulseCombat('read-stance', 360);
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
    this.updateBattlefieldForIntent(intent);
    this.pulseCombat(`threat-${intent.tone || 'steel'}`, 360);
    if (typeof this[intent.action] === 'function') {
      this[intent.action](intent);
      return;
    }
    this.enemyAttack(intent);
  }

  enemyAttack(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.strike || ENEMY_PROFILES.default.attack.strike, { enemy: this.enemy.name }),
      damageType: 'physical',
      multiplier: 1,
      intent
    });
  }

  enemyPressure(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.pressure || ENEMY_PROFILES.default.attack.pressure, { enemy: this.enemy.name }),
      damageType: 'physical',
      multiplier: 1.05,
      intent
    });
  }

  enemyAggressiveStrike(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.rush || ENEMY_PROFILES.default.attack.rush, { enemy: this.enemy.name }),
      damageType: 'physical',
      multiplier: 1.2,
      intent
    });
  }

  enemyLightning(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.lightning || ENEMY_PROFILES.default.attack.lightning, { enemy: this.enemy.name }),
      damageType: 'lightning',
      multiplier: 1.15,
      intent
    });
  }

  enemyBreath(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.breath || ENEMY_PROFILES.default.attack.breath, { enemy: this.enemy.name }),
      damageType: 'fire',
      multiplier: 1.35,
      intent
    });
  }

  enemyBurst(intent = null) {
    this.resolveIncomingAttack({
      label: formatLine(this.enemyProfile.attack?.burst || ENEMY_PROFILES.default.attack.burst, { enemy: this.enemy.name }),
      damageType: 'magic',
      multiplier: 1.2,
      intent
    }, 2);
  }

  enemyFortify(intent = null) {
    this.enemyGuard.defense = 1.45;
    this.enemyGuard.damage = 1.08;
    this.decayEnemyStagger(14);
    if (this.battlefield) {
      this.battlefield.range = 'mid';
      this.battlefield.enemySlot = 'mid';
      this.battlefield.hazardSlot = 'mid';
      this.battlefield.hazardLabel = intent?.marker || 'Guard shell';
      this.battlefield.partyFormation = getPartyFormation('steady');
      this.battlefield.spaceLine = `${this.enemy.name} gives ground into a guarded middle lane.`;
      this.battlefield.posture = 'Guarded enemy';
      this.battlefield.threat = intent?.preview || `${this.enemy.name} settles into a guarded shell.`;
    }
    this.appendLog(`${this.enemy.name} settles into a guarded shell, waiting for you to overcommit.`);
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
    this.updateBattlefieldForEnemyHit({ damageType, readiedIntent, totalDamage });

    if (totalDamage <= 0) {
      this.appendLog('The Storm Cloak repels the attack.');
    } else {
      this.player.character.takeDamage(totalDamage);
      let message = `${label} for ${totalDamage} damage.`;
      if (readiedIntent) {
        message += ' Your guard turns the worst of it aside.';
      }
      this.appendLog(message);
      const flashColors = {
        physical: 'rgba(255, 0, 0, 0.4)',
        lightning: 'rgba(130, 190, 255, 0.5)',
        fire: 'rgba(255, 112, 32, 0.48)',
        magic: 'rgba(180, 120, 255, 0.45)'
      };
      this.triggerHitFlash(flashColors[damageType] || flashColors.physical);
      this.pulseCombat(`impact-${damageType}`, 440);
      if (totalDamage > 10) this.triggerScreenShake();
    }

    if (readiedIntent) {
      this.playerOpening = Math.min(2, this.playerOpening + 1);
      this.appendLog('You spot an opening in the recovery.');
      this.pulseCombat('read-success', 520);
      this.maybeAppendPartyCallout('read');
    } else if (totalDamage > 8) {
      this.maybeAppendPartyCallout('danger');
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

  renderPartyFormation() {
    if (!this.partyFormationElement || !this.battlefield?.partyFormation) return;
    this.partyFormationElement.innerHTML = '';
    this.battlefield.partyFormation.forEach((member) => {
      const chip = document.createElement('div');
      chip.className = 'combat-party-member';
      chip.innerHTML = `
        <strong>${member.name}</strong>
        <span>${member.role} - ${member.state}</span>
      `;
      this.partyFormationElement.appendChild(chip);
    });
  }

  renderBattleState() {
    if (!this.active || !this.player?.character || !this.enemy) return;
    const playerCharacter = this.player.character;
    const playerHpRatio = playerCharacter.maxHP ? clamp(playerCharacter.currentHP / playerCharacter.maxHP, 0, 1) : 0;
    const enemyHpRatio = this.enemy.maxHP ? clamp(this.enemy.currentHP / this.enemy.maxHP, 0, 1) : 0;
    const mode = getModeConfig(this.playerMode)?.label || 'Melee';

    this.root.dataset.intentTone = this.enemyIntent?.tone || 'steel';
    this.root.dataset.range = this.battlefield?.range || 'mid';
    this.root.dataset.enemySlot = this.battlefield?.enemySlot || 'mid';
    this.root.dataset.threatSlot = this.battlefield?.hazardSlot || 'mid';
    this.turnElement.textContent = this.enemyStunnedTurns > 0
      ? `${this.enemy.name} is reeling`
      : (this.turn === 'player' ? 'Your turn' : `${this.enemy.name}'s turn`);

    if (this.enemyStunnedTurns > 0) {
      this.intentTitleElement.textContent = 'Broken Guard';
      this.intentHintElement.textContent = `${this.enemy.name} is staggered. Press the advantage before it recovers.`;
    } else if (this.enemyIntent) {
      const recommended = this.getRecommendedAction();
      this.intentTitleElement.textContent = this.enemyIntent.title;
      this.intentHintElement.textContent = `${this.enemyIntent.preview} ${this.enemyIntent.hint} Recommended counter: ${recommended?.display || 'highlighted action'}.`;
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

    if (this.fieldContextElement) {
      this.fieldContextElement.textContent = `${this.battlefield.contextLabel} - ${this.battlefield.ground}`;
    }
    if (this.fieldRangeElement) {
      this.fieldRangeElement.textContent = `${this.battlefield.range.toUpperCase()} range`;
    }
    if (this.fieldThreatElement) {
      this.fieldThreatElement.textContent = this.battlefield.threat;
    }
    if (this.fieldPartyElement) {
      this.fieldPartyElement.textContent = this.battlefield.partyLine;
    }
    if (this.spaceLabelElement) {
      this.spaceLabelElement.textContent = this.battlefield.spaceLine;
    }
    if (this.enemyMarkerElement) {
      this.enemyMarkerElement.textContent = `${this.enemyProfile.family}: ${this.enemy.name}`;
    }
    if (this.threatMarkerElement) {
      this.threatMarkerElement.textContent = this.battlefield.hazardLabel;
    }
    if (this.terrainCueElement) {
      this.terrainCueElement.textContent = `${this.battlefield.contextLabel}: ${this.battlefield.ground}`;
    }
    if (this.onboardingElement) {
      this.onboardingElement.classList.toggle('hidden', !this.showOnboarding);
      if (this.showOnboarding) {
        const recommended = this.getRecommendedAction();
        const counter = recommended?.display || 'the highlighted counter';
        const opening = this.playerOpening > 0
          ? `Opening ready x${this.playerOpening}: attack now to cash it in.`
          : `${this.getActionLabel('defend')} reads the intent, softens the hit, and can create an opening.`;
        this.onboardingElement.innerHTML = `
          <div><strong>Read:</strong> ${this.enemyIntent?.title || 'Watch the foe'}.</div>
          <div><strong>Counter:</strong> press ${counter}, or choose the highlighted button.</div>
          <div><strong>Openings:</strong> ${opening}</div>
          <div><strong>Shortcuts:</strong> 1 Melee, 2 Bow, 3 Spell, 4 Defend, 5 Item, 6 Flee.</div>
        `;
      }
    }
    this.renderPartyFormation();
  }

  updateStatus() {
    const mode = getModeConfig(this.playerMode)?.label || 'Melee';
    const openingText = this.playerOpening > 0 ? ` - Opening x${this.playerOpening}` : '';
    this.statusElement.textContent = `HP ${this.player.character.currentHP}/${this.player.character.maxHP} - MP ${this.player.character.currentMP}/${this.player.character.maxMP} - ${this.enemy.name}: ${this.enemy.currentHP}/${this.enemy.maxHP} - Mode: ${mode}${openingText}`;
    this.renderBattleState();
    this.syncActionButtonStates();
    if (this.onUpdate) {
      this.onUpdate();
    }
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
