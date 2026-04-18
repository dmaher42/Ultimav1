import { createHudPanel } from "./hudShared.js";
import { registerPanel } from "./HudManager.js";
import "./hudTheme.css";

// Basic interface for what we expect from QuestManager (avoiding circular imports or complex types for now)
interface QuestState {
  title: string | null;
  objective: string | null;
  status: string;
}

interface QuestManager {
  subscribe(callback: (state: QuestState) => void): () => void;
}

export class QuestHud {
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private objectiveEl: HTMLElement;

  constructor(questManager: QuestManager) {
    const panel = createHudPanel({
      title: "Active Quest",
      className: "quest-hud",
      toggleLabels: { expanded: "Hide", collapsed: "Show" },
    });

    this.root = panel.root;
    this.root.style.display = "none"; // Hidden by default until a quest starts

    this.titleEl = document.createElement("div");
    this.titleEl.className = "quest-hud__title";
    panel.content.appendChild(this.titleEl);

    this.objectiveEl = document.createElement("div");
    this.objectiveEl.className = "quest-hud__objective";
    panel.content.appendChild(this.objectiveEl);

    registerPanel("questHud", this.root, 1);

    // Subscribe to updates
    if (questManager) {
      questManager.subscribe(this.update.bind(this));
    }
  }

  update(questState: QuestState) {
    if (!questState || questState.status === 'Not Started' || !questState.title) {
      this.root.style.display = "none";
      return;
    }

    this.root.style.display = "block";
    this.titleEl.textContent = questState.title || "";
    this.objectiveEl.textContent = questState.objective || "";

    if (questState.status === 'Completed') {
        this.root.classList.add("quest-hud--completed");
    } else {
        this.root.classList.remove("quest-hud--completed");
    }
  }
}
