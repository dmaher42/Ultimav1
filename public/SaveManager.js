/**
 * SaveManager handles persisting the game state to localStorage.
 */
export default class SaveManager {
    static STORAGE_KEY = 'ultima_athens_save';

    /**
     * Serializes and saves the game state.
     * @param {Object} state - The global game state.
     */
    static save(state) {
        if (!state || !state.character) return;

        const saveData = {
            character: state.character.toJSON(),
            mapId: state.map.id,
            playerPosition: state.player.position,
            flags: {
                guardianDefeated: state.guardianDefeated || false,
                worldTime: state.worldTime || 0
            },
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
            console.log('Game saved successfully.');
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    /**
     * Loads and deserializes the game state.
     * @returns {Object|null} The saved data or null if none exists.
     */
    static load() {
        try {
            const rawData = localStorage.getItem(this.STORAGE_KEY);
            if (!rawData) return null;
            return JSON.parse(rawData);
        } catch (e) {
            console.error('Failed to load game:', e);
            return null;
        }
    }

    /**
     * Clears the current save data.
     */
    static clearSave() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

/**
 * Formats a timestamp into a readable string.
 */
export function formatTimestamp(ts) {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
