export const QUESTS = {
  'castle_crisis': {
    id: 'castle_crisis',
    title: "Castle Crisis",
    description: "The Avatar has arrived during a desperate attack on Castle Britannia.",
    stages: {
      0: "Survive the initial attack! Defend the throne room.",
      1: "The castle is secure, but the air is thick with alarm. Lord British awaits.",
      2: "Speak with Lord British to understand your duty.",
      3: "Investigation task received. The path ahead is clear.",
      4: "Introduction phase complete. Britannia needs its champion."
    }
  },
  'orb_quest': {
    id: 'orb_quest',
    title: "The Stolen Orb",
    description: "Investigate the missing Orb of Moons and the strange disturbance in the sacred order.",
    stages: {
      0: "Lord British has tasked me with investigating the missing Orb in the Dark Caverns.",
      1: "Travel to the Lycaeum to seek scholarly guidance on the moonstone disturbance.",
      2: "I have discovered that the problem is deeper than a simple raid. The Gargoyles are acting with purpose.",
      3: "A key object or clue has been recovered. The truth is starting to emerge.",
      4: "The next story path has been unlocked. Suspicion and doubt grow."
    }
  },
  'wisdom_of_lycaeum': {
    id: 'wisdom_of_lycaeum',
    title: 'Wisdom of the Lycaeum',
    description: 'Seek the guidance of Mariah at the Lycaeum to interpret the strange omens.',
    stages: {
      0: 'Mariah offers her guidance, but first I must demonstrate my understanding of truth.',
      1: 'I must answer, retrieve, or reason through the scholar\'s challenge.',
      2: 'The challenge is met. Strategic understanding of the Codex is gained.',
      3: 'New insights into the prophecy are now accessible.',
      4: 'Quest complete. The scrolls of the Lycaeum have revealed a crack in the official story.'
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
