from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one match in {relative_path}, found {count}: {old[:100]!r}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Cache and data imports.
replace_once(
    "public/game.js",
    "import Renderer from './render.js?v=18';",
    "import Renderer from './render.js?v=19';",
)

replace_once(
    "public/game.js",
    """} from './OrbQuest.js?v=1';
import { initCanvas, resize } from './renderer/canvas.js';""",
    """} from './OrbQuest.js?v=1';
import {
  THRONE_AMBUSH_GROUP,
  findThroneAmbushAggressor,
  getThroneAmbushStatus,
  isThroneAmbushNpc,
  syncThroneAmbushNpcs
} from './ThroneRoomEnemies.js?v=1';
import { initCanvas, resize } from './renderer/canvas.js';""",
)

# Encounter state and visible enemy synchronisation.
replace_once(
    "public/game.js",
    """function directionFromDelta(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

// --- GAME LOOP FOR AI ---""",
    """function directionFromDelta(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

function getCastleCrisisStage() {
  return state.character?.getQuestStage?.('castle_crisis') || 0;
}

function isThroneRoomAmbushPending() {
  return Boolean(
    state.character
    && !state.throneIntroComplete
    && getCastleCrisisStage() < 2
  );
}

function syncThroneRoomEnemies() {
  const castle = state.world.maps.castle;
  if (!castle) return [];
  return syncThroneAmbushNpcs(castle, {
    castleCrisisStage: getCastleCrisisStage(),
    throneIntroComplete: state.throneIntroComplete
  });
}

function beginThroneRoomAmbush(aggressor = null, { reason = 'proximity' } = {}) {
  if (
    !state.character
    || state.map?.id !== 'castle'
    || state.inCombat
    || !isThroneRoomAmbushPending()
  ) {
    return false;
  }

  resetMovementInput();
  if (getCastleCrisisStage() === 0) {
    setQuestStageAndRefresh('castle_crisis', 1);
  }

  const enemyName = aggressor?.name || 'Gargoyle raiders';
  const battleCry = aggressor?.hostileLine || 'The Orb will leave this hall with us.';
  log(`${enemyName}: “${battleCry}”`);
  if (reason === 'collision') {
    log('The raider blocks your path and lunges.');
  } else if (reason === 'talk') {
    log('Your challenge draws the whole raiding party into battle.');
  } else {
    log('Three gargoyle raiders close around the royal dais.');
  }

  renderer.playHostileAlert?.(aggressor);
  autoSave('throne-ambush-start');
  void startSpecialEncounter(THRONE_AMBUSH_GROUP);
  return true;
}

// --- GAME LOOP FOR AI ---""",
)

# Objective copy now reflects the visible raiding party.
replace_once(
    "public/game.js",
    """  if (!state.throneIntroComplete) {
    return {
      hidden: false,
      text: 'Clear the throne room ambush, then speak to Lord British.',
      tip: 'Read the Enemy Intent card. Use the highlighted counter, or press 4 Defend to create an opening.'
    };
  }
""",
    """  if (!state.throneIntroComplete) {
    const raid = getThroneAmbushStatus(state.world.maps.castle);
    const raiderLabel = raid.count === 1 ? 'raider blocks' : 'raiders block';
    return {
      hidden: false,
      text: raid.count
        ? `${raid.count} gargoyle ${raiderLabel} the royal dais. Protect Lord British.`
        : 'Clear the throne room ambush, then speak to Lord British.',
      tip: raid.count
        ? 'Move toward a raider or press T while facing one to engage. Combat still uses the Enemy Intent tutorial.'
        : 'Read the Enemy Intent card. Use the highlighted counter, or press 4 Defend to create an opening.'
    };
  }
""",
)

# Restore or remove hostiles whenever Castle Britannia becomes active.
replace_once(
    "public/game.js",
    """function changeMap(mapId, spawnTag, x, y) {
  const map = state.world.maps[mapId];
  if (!map || !state.player) return;
  resetMovementInput();
  state.map = map;""",
    """function changeMap(mapId, spawnTag, x, y) {
  const map = state.world.maps[mapId];
  if (!map || !state.player) return;
  resetMovementInput();
  if (mapId === 'castle') syncThroneRoomEnemies();
  state.map = map;""",
)

# Bumping a hostile begins the encounter instead of presenting friendly dialogue copy.
replace_once(
    "public/game.js",
    """  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    const now = Date.now();
    if (!state.lastBlockedLog || now - state.lastBlockedLog > 900) {
      log(`Blocked by: ${npc.name}. Press T to talk.`);
      state.lastBlockedLog = now;
    }
    renderer.playBlockedStep?.(direction);
    renderGame();
    return { moved: false, blocked: true, reason: 'npc' };
  }
""",
    """  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    if (isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
      renderer.playBlockedStep?.(direction);
      const encounterStarted = beginThroneRoomAmbush(npc, { reason: 'collision' });
      renderGame();
      return {
        moved: false,
        blocked: true,
        reason: 'hostile',
        encounterStarted
      };
    }

    const now = Date.now();
    if (!state.lastBlockedLog || now - state.lastBlockedLog > 900) {
      log(`Blocked by: ${npc.name}. Press T to talk.`);
      state.lastBlockedLog = now;
    }
    renderer.playBlockedStep?.(direction);
    renderGame();
    return { moved: false, blocked: true, reason: 'npc' };
  }
""",
)

# Talking to a hostile is an explicit engage action.
replace_once(
    "public/game.js",
    """  const npc = getNPCAt(targetX, targetY);
  if (npc) {
    showDialogue(npc);
  } else {
    log('There is no one there.');
  }
}
""",
    """  const npc = getNPCAt(targetX, targetY);
  if (npc && isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
    beginThroneRoomAmbush(npc, { reason: 'talk' });
    return;
  }
  if (npc) {
    showDialogue(npc);
  } else {
    log('There is no one there.');
  }
}
""",
)

# Guard against programmatic dialogue calls opening a friendly panel for enemies.
replace_once(
    "public/game.js",
    """function showDialogue(npc) {
  if (!npc || !state.character) return;
  resetMovementInput();""",
    """function showDialogue(npc) {
  if (!npc || !state.character) return;
  if (isThroneAmbushNpc(npc) && isThroneRoomAmbushPending()) {
    beginThroneRoomAmbush(npc, { reason: 'talk' });
    return;
  }
  resetMovementInput();""",
)

# Replace the invisible single-tile trigger with enemy-based aggression radii.
replace_once(
    "public/game.js",
    """  if (
    state.map.id === 'castle'
    && state.character.getQuestStage('castle_crisis') === 0
    && x === 14
    && y === 11
  ) {
    setQuestStageAndRefresh('castle_crisis', 1);
    log('A gargoyle bursts into the throne room!');
    void startSpecialEncounter('throne_ambush');
    return;
  }
""",
    """  if (state.map.id === 'castle' && isThroneRoomAmbushPending()) {
    const aggressor = findThroneAmbushAggressor(state.map, x, y);
    if (aggressor) {
      beginThroneRoomAmbush(aggressor, { reason: 'proximity' });
      return;
    }
  }
""",
)

# Use the shared encounter category constant.
replace_once(
    "public/game.js",
    "const isThroneAmbush = combatSnapshot?.onboarding || combatEngine.category === 'throne_ambush';",
    "const isThroneAmbush = combatSnapshot?.onboarding || combatEngine.category === THRONE_AMBUSH_GROUP;",
)
replace_once(
    "public/game.js",
    "if (category === 'throne_ambush') {",
    "if (category === THRONE_AMBUSH_GROUP) {",
)

# Victory removes every visible member of the raiding party.
replace_once(
    "public/game.js",
    """    if (enemy.id === 'gargoyle' && state.map?.id === 'castle') {
      state.throneIntroComplete = true;
      setQuestStageAndRefresh('castle_crisis', 2);
      log('The throne room is clear. You should speak with Lord British.');
      renderGame();
      autoSave('throne-ambush');
    }
""",
    """    if (
      category === THRONE_AMBUSH_GROUP
      || (enemy.id === 'gargoyle' && state.map?.id === 'castle')
    ) {
      state.throneIntroComplete = true;
      setQuestStageAndRefresh('castle_crisis', 2);
      syncThroneRoomEnemies();
      renderer.playHostileDefeat?.();
      log('The gargoyle raiding party breaks. The throne room is clear.');
      log('Speak with Lord British when you are ready.');
      renderGame();
      autoSave('throne-ambush');
    }
""",
)

# Old and current saves derive the correct enemy presence from existing quest state.
replace_once(
    "public/game.js",
    """  state.lastSaveTimestamp = data.timestamp || null;
  state.discoveredAreas.add(currentMap.id);

  applyOrbQuestWorldState();""",
    """  state.lastSaveTimestamp = data.timestamp || null;
  state.discoveredAreas.add(currentMap.id);

  syncThroneRoomEnemies();
  applyOrbQuestWorldState();""",
)

# Expose encounter helpers for diagnostics and browser verification.
replace_once(
    "public/game.js",
    """  resetMovementInput,
  getObjectiveState,
  applyOrbQuestWorldState,""",
    """  resetMovementInput,
  getObjectiveState,
  syncThroneRoomEnemies,
  beginThroneRoomAmbush,
  applyOrbQuestWorldState,""",
)

replace_once(
    "public/game.js",
    """    verticalSliceComplete: Boolean(state.orbQuest?.complete),
    inventory: state.character?.inventory?.map((item) => ({""",
    """    verticalSliceComplete: Boolean(state.orbQuest?.complete),
    hostileNpcs: state.map?.npcs?.filter((npc) => npc.hostile).map((npc) => ({
      id: npc.id,
      name: npc.name,
      x: npc.x,
      y: npc.y,
      enemyGroup: npc.enemyGroup
    })) || [],
    inventory: state.character?.inventory?.map((item) => ({""",
)

# Browser cache bumps for both entry points.
replace_once(
    "index.html",
    '<script type="module" src="./public/game.js?v=21"></script>',
    '<script type="module" src="./public/game.js?v=22"></script>',
)
replace_once(
    "public/index.html",
    '<script type="module" src="game.js?v=14"></script>',
    '<script type="module" src="game.js?v=22"></script>',
)

print("Throne-room enemy NPC integration applied.")
