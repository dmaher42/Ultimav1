import {
  ORB_QUEST_ID,
  ORB_QUEST_STAGE,
  ORB_QUEST_STEPS
} from './OrbQuest.js';

const ORB_JOURNAL_STAGES = Object.fromEntries(
  Object.entries(ORB_QUEST_STEPS).map(([stage, data]) => [stage, data.journal])
);

export const QUESTS = {
  'castle_crisis': {
    id: 'castle_crisis',
    title: 'Castle Crisis',
    description: 'The Avatar has arrived during a desperate attack on Castle Britannia.',
    stages: {
      0: 'Survive the initial attack! Defend the throne room.',
      1: 'The castle is secure, but the air is thick with alarm. Lord British awaits.',
      2: 'Speak with Lord British to understand your duty.',
      3: 'Investigation task received. The path ahead is clear.',
      4: 'Introduction phase complete. Britannia needs its champion.'
    }
  },
  [ORB_QUEST_ID]: {
    id: ORB_QUEST_ID,
    title: 'The Stolen Orb',
    description: 'Recover the Orb of Moons, uncover the Gargoyles’ warning, and advise Britannia’s response.',
    completionStage: ORB_QUEST_STAGE.COMPLETE,
    stages: ORB_JOURNAL_STAGES
  },
  'wisdom_of_lycaeum': {
    id: 'wisdom_of_lycaeum',
    title: 'Wisdom of the Lycaeum',
    description: 'Seek the guidance of Mariah at the Lycaeum to interpret the strange omens.',
    stages: {
      0: 'Mariah offers her guidance, but first I must demonstrate my understanding of truth.',
      1: 'I must answer the scholar\'s challenge regarding the nature of Truth.',
      2: 'The challenge is met. I have gained Mariah\'s trust.',
      3: 'I am helping Mariah translate the Gargoyle Tablet discovered in the caverns.',
      4: 'Quest complete. The scrolls of the Lycaeum have revealed that our "enemies" may be victims of their own prophecy.'
    }
  }
};

export default class QuestManager {
  static getQuest(id) {
    return QUESTS[id] || null;
  }

  static getCompletionStage(id) {
    const quest = this.getQuest(id);
    if (!quest) return 0;
    if (Number.isFinite(quest.completionStage)) return quest.completionStage;
    const stages = Object.keys(quest.stages || {})
      .map((key) => Number(key))
      .filter((key) => Number.isFinite(key));
    return stages.length ? Math.max(...stages) : 0;
  }

  static resolveDialogue(questId, stage) {
    const quest = this.getQuest(questId);
    if (!quest) return null;
    return quest.stages[stage] || quest.stages[0];
  }
}
