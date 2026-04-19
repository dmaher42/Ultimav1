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
      2: "I have recovered the Orb of Moons, but the air in the caverns feels heavy with a truth I do not yet grasp.",
      3: "Investigation task: I have found a Gargoyle Tablet. I must take it to Mariah at the Lycaeum for translation.",
      4: "The truth is revealed: The Gargoyles believe I am a 'False Prophet'. The conflict is more than a simple raid.",
      5: "Objective: Discuss the 'Misunderstanding' with Lord British. Can war be averted?"
    }
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

  static resolveDialogue(questId, stage) {
    const quest = this.getQuest(questId);
    if (!quest) return null;
    return quest.stages[stage] || quest.stages[0];
  }
}
