
export const QUESTS = {
  'orb_quest': {
    id: 'orb_quest',
    title: "The Stolen Orb",
    description: "Lord British has tasked me with retrieving the Orb of Moons from the Dungeon.",
    stages: {
        0: "Retrieve my Orb of Moons! It lies within the Dark Caverns to the East.",
        1: "The dungeon is to the East... Please hurry.",
        2: "You found it! My gratitude is yours, avatar.",
        3: "Thank you for your service."
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
