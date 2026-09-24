export const ORB_QUEST_ID = 'orb_quest';

export const ORB_QUEST_STAGE = Object.freeze({
  NOT_STARTED: 0,
  SEEK_MARIAH: 1,
  REACH_CAVERNS: 2,
  FACE_GUARDIAN: 3,
  RECOVER_RELICS: 4,
  TRANSLATE_TABLET: 5,
  RETURN_TO_LORD_BRITISH: 6,
  CHOOSE_RESPONSE: 7,
  COMPLETE: 8
});

export const ORB_QUEST_DECISION = Object.freeze({
  PEACE: 'peace',
  CAUTION: 'caution',
  DEFENCE: 'defence'
});

export const ORB_QUEST_STEPS = Object.freeze({
  [ORB_QUEST_STAGE.NOT_STARTED]: {
    journal: 'Lord British has not yet entrusted me with the mystery of the missing Orb of Moons.',
    objective: 'Speak with Lord British about the missing Orb of Moons.',
    tip: 'Press T while facing Lord British, then choose ORB.'
  },
  [ORB_QUEST_STAGE.SEEK_MARIAH]: {
    journal: 'Lord British asked me to seek Mariah at the Lycaeum and learn why the Gargoyles took the Orb.',
    objective: 'Visit Mariah at the Lycaeum and ask about the PROPHECY.',
    tip: 'The Lycaeum lies west of Castle Britannia.'
  },
  [ORB_QUEST_STAGE.REACH_CAVERNS]: {
    journal: 'Mariah believes the theft is tied to a Gargoyle prophecy. I must reach the Dark Caverns and hear the Guardian’s account.',
    objective: 'Travel to the Dark Caverns and confront the Gargoyle Guardian.',
    tip: 'The cavern entrance lies east of the Britannian Wilderness.'
  },
  [ORB_QUEST_STAGE.FACE_GUARDIAN]: {
    journal: 'The Guardian believes I am the False Prophet. I must choose whether to seek understanding or fight for passage.',
    objective: 'Resolve the confrontation with the Guardian.',
    tip: 'Choose UNDERSTANDING for diplomacy or FIGHT for combat.'
  },
  [ORB_QUEST_STAGE.RECOVER_RELICS]: {
    journal: 'The path is open. I must recover both the Orb of Moons and the Gargoyle Tablet before leaving the caverns.',
    objective: 'Recover the Orb of Moons and the Gargoyle Tablet.',
    tip: 'Stand on each relic and press G. Their order does not matter.'
  },
  [ORB_QUEST_STAGE.TRANSLATE_TABLET]: {
    journal: 'I have recovered the Orb and Tablet. Mariah may be able to translate the Gargoyle runes.',
    objective: 'Return to Mariah and ask her to translate the TABLET.',
    tip: 'The recovered Orb can now carry you to the Lycaeum.'
  },
  [ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH]: {
    journal: 'Mariah revealed that the Gargoyles fear a False Prophet will destroy their world. Lord British must hear the truth.',
    objective: 'Return to Lord British and discuss the MISUNDERSTANDING.',
    tip: 'Use the Orb of Moons or travel back to Castle Britannia.'
  },
  [ORB_QUEST_STAGE.CHOOSE_RESPONSE]: {
    journal: 'Lord British accepts that Britannia may have misunderstood the Gargoyles. I must advise how the realm should respond.',
    objective: 'Choose Britannia’s response: PEACE, CAUTION, or DEFENCE.',
    tip: 'Each response completes the vertical slice with a different consequence.'
  },
  [ORB_QUEST_STAGE.COMPLETE]: {
    journal: 'The Orb of Moons has been recovered, the Gargoyle warning has been heard, and Britannia has chosen its response.',
    objective: 'Vertical slice complete.',
    tip: 'Open the journal to review your path, or continue exploring Britannia.'
  }
});

const VALID_RESOLUTIONS = new Set(['diplomacy', 'combat', 'legacy']);
const VALID_DECISIONS = new Set(Object.values(ORB_QUEST_DECISION));

const ENDINGS = Object.freeze({
  [ORB_QUEST_DECISION.PEACE]: {
    title: 'An Envoy Beneath Two Moons',
    counsel: 'Seek peace',
    consequence: 'Lord British halts retaliation and sends an envoy carrying Mariah’s translation. For the first time, Britannian and Gargoyle witnesses approach the same table without drawn weapons.'
  },
  [ORB_QUEST_DECISION.CAUTION]: {
    title: 'The Watchful Accord',
    counsel: 'Proceed with caution',
    consequence: 'Lord British restores the Moongates under guard while Mariah opens a formal inquiry. Contact with the Gargoyles begins, but neither side is asked to surrender its defences before trust is earned.'
  },
  [ORB_QUEST_DECISION.DEFENCE]: {
    title: 'Britannia Stands Guard',
    counsel: 'Strengthen the realm',
    consequence: 'Lord British fortifies the Shrines and recalls the scattered guards. The Gargoyle warning is recorded rather than dismissed, but Britannia prepares for another attack before attempting further contact.'
  }
});

export function createOrbQuestState(saved = {}) {
  const guardianResolution = VALID_RESOLUTIONS.has(saved.guardianResolution)
    ? saved.guardianResolution
    : null;
  const finalDecision = VALID_DECISIONS.has(saved.finalDecision)
    ? saved.finalDecision
    : null;

  return {
    mariahBriefed: Boolean(saved.mariahBriefed),
    guardianResolution,
    tabletTranslated: Boolean(saved.tabletTranslated),
    finalDecision,
    complete: Boolean(saved.complete || finalDecision)
  };
}

export function getOrbQuestStage(character) {
  return character?.getQuestStage?.(ORB_QUEST_ID) || ORB_QUEST_STAGE.NOT_STARTED;
}

export function advanceOrbQuest(character, targetStage) {
  if (!character?.setQuestStage) return false;
  const currentStage = getOrbQuestStage(character);
  const boundedTarget = Math.max(
    ORB_QUEST_STAGE.NOT_STARTED,
    Math.min(ORB_QUEST_STAGE.COMPLETE, Number(targetStage) || 0)
  );

  if (boundedTarget <= currentStage) return false;
  character.setQuestStage(ORB_QUEST_ID, boundedTarget);
  return true;
}

export function getOrbQuestStep(stage) {
  return ORB_QUEST_STEPS[stage] || ORB_QUEST_STEPS[ORB_QUEST_STAGE.NOT_STARTED];
}

export function getMissingRelics(character) {
  if (!character) return ['Orb of Moons', 'Gargoyle Tablet'];
  const missing = [];
  if (!character.hasItem?.('orb_of_moons')) missing.push('Orb of Moons');
  if (!character.hasItem?.('gargoyle_tablet')) missing.push('Gargoyle Tablet');
  return missing;
}

export function syncOrbQuestProgress(state) {
  if (!state?.character) return false;
  state.orbQuest = createOrbQuestState(state.orbQuest);

  const currentStage = getOrbQuestStage(state.character);
  if (currentStage === ORB_QUEST_STAGE.NOT_STARTED) return false;

  let targetStage = currentStage;
  const missingRelics = getMissingRelics(state.character);

  if (state.orbQuest.complete || state.orbQuest.finalDecision) {
    state.orbQuest.complete = true;
    targetStage = ORB_QUEST_STAGE.COMPLETE;
  } else if (state.orbQuest.tabletTranslated) {
    targetStage = Math.max(targetStage, ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH);
  } else if (state.orbQuest.guardianResolution && missingRelics.length === 0) {
    targetStage = Math.max(targetStage, ORB_QUEST_STAGE.TRANSLATE_TABLET);
  } else if (state.orbQuest.guardianResolution) {
    targetStage = Math.max(targetStage, ORB_QUEST_STAGE.RECOVER_RELICS);
  } else if (state.orbQuest.mariahBriefed) {
    targetStage = Math.max(targetStage, ORB_QUEST_STAGE.REACH_CAVERNS);
  }

  return advanceOrbQuest(state.character, targetStage);
}

export function migrateLegacyOrbQuest(character, flags = {}) {
  const legacyStage = getOrbQuestStage(character);
  const migrated = createOrbQuestState();

  if (legacyStage <= ORB_QUEST_STAGE.NOT_STARTED) {
    return migrated;
  }

  const hasOrb = Boolean(character?.hasItem?.('orb_of_moons'));
  const hasTablet = Boolean(character?.hasItem?.('gargoyle_tablet'));

  if (legacyStage >= 2 || hasOrb || hasTablet || flags.guardianDefeated) {
    migrated.mariahBriefed = true;
  }
  if (flags.guardianDefeated || hasOrb || hasTablet || legacyStage >= 3) {
    migrated.guardianResolution = flags.guardianDefeated ? 'combat' : 'legacy';
  }
  if (legacyStage >= 4) {
    migrated.tabletTranslated = true;
  }

  let mappedStage = ORB_QUEST_STAGE.SEEK_MARIAH;
  if (migrated.mariahBriefed) mappedStage = ORB_QUEST_STAGE.REACH_CAVERNS;
  if (migrated.guardianResolution) mappedStage = ORB_QUEST_STAGE.RECOVER_RELICS;
  if (migrated.guardianResolution && hasOrb && hasTablet) mappedStage = ORB_QUEST_STAGE.TRANSLATE_TABLET;
  if (migrated.tabletTranslated) mappedStage = ORB_QUEST_STAGE.RETURN_TO_LORD_BRITISH;
  if (legacyStage >= 5) mappedStage = ORB_QUEST_STAGE.CHOOSE_RESPONSE;

  character.setQuestStage(ORB_QUEST_ID, mappedStage);
  return migrated;
}

export function getOrbEnding(state) {
  const decision = state?.orbQuest?.finalDecision;
  const ending = ENDINGS[decision] || {
    title: 'The Choice Still Waits',
    counsel: 'No final counsel given',
    consequence: 'Britannia has learned the truth, but Lord British still awaits the Avatar’s advice.'
  };

  const resolution = state?.orbQuest?.guardianResolution;
  let guardianSummary = 'The Guardian confrontation was resolved.';
  if (resolution === 'diplomacy') {
    guardianSummary = 'You listened to the Guardian and opened the path without bloodshed.';
  } else if (resolution === 'combat') {
    guardianSummary = 'You defeated the Guardian in battle, then carried its warning back to Britannia.';
  } else if (resolution === 'legacy') {
    guardianSummary = 'The Guardian encounter was resolved before this save was upgraded.';
  }

  return {
    ...ending,
    decision,
    guardianResolution: resolution,
    guardianSummary
  };
}
