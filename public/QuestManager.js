export const QUESTS = {
  'orb_quest': {
    id: 'orb_quest',
    title: "The Stolen Orb",
    description: "Lord British has tasked me with retrieving the Orb of Moons from the Dungeon.",
    stages: {
        0: "Retrieve my Orb of Moons! It lies within the Dark Caverns to the East.",
        1: "The dungeon is to the East... Lord British seems desperate, but why would a Gargoyle take it?",
        2: "I have recovered the Orb. The Guardian spoke of their own need for its power. Was Lord British fully honest?",
        3: "Quest complete. Lord British has the Orb, but the cycle of conflict continues.",
        4: "Quest complete. I have mediated a truce; the Orb is shared between the kingdoms."
    }
  },
  'socrates_riddle': {
    id: 'socrates_riddle',
    title: 'Wisdom of Athens',
    description: 'Answer Socrates to earn the Tactics Codex.',
    stages: {
      0: 'Socrates asks a simple question of wisdom.',
      1: 'You answered wisely. Collect your reward.',
      2: 'The codex is yours.'
    }
  }
};

export default class QuestManager {
  static getQuest(id) {
    return QUESTS[id] || null;
  }

  static resolveDialogue(questId, stage) {
    const quest = this.getQuest(questId);
    if (!quest) return null;
    return quest.stages[stage] || quest.stages[0];
  }
}
