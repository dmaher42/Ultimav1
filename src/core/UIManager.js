// src/core/UIManager.js
// Manages HUD overlays, dev UI, and layout positioning

import { mountDevHUD } from '../ui/devHud.ts';
import { mountMiniMap } from '../ui/miniMap.ts';
import { mountHotkeyOverlay } from '../ui/hotkeyOverlay.ts';
import { mountAudioMixer } from '../ui/audioMixer.ts';
import { mountExposureSlider } from '../ui/exposureSlider.ts';
import { QuestHud } from '../ui/questHud.ts';
import { InteractionHud } from '../ui/interactionHud.ts';
import { mount as mountCameraSettings } from '../ui/HUDCameraSettings.ts';
import { updateLayout } from '../ui/HudManager.ts';

let devHud = null;
let minimap = null;
let questHud = null;
let interactionHud = null;
let cameraSettingsHud = null;
let audioMixer = null;
let exposureSlider = null;
let hotkeyOverlay = null;

export const UIManager = {
  init(options = {}) {
    const {
      renderer,
      soundscape,
      questManager,
      questHud: externalQuestHud,
      interactionHud: externalInteractionHud,
      getPosition,
      getDirection,
      lightingCallbacks,
      fogCallbacks,
      sunAlignment,
    } = options;

    // Use externally-created HUD instances if provided.
    interactionHud = externalInteractionHud || new InteractionHud();
    questHud = externalQuestHud || (questManager ? new QuestHud(questManager) : null);

    // Initialize dev HUD if callbacks provided
    if (getPosition && getDirection && lightingCallbacks) {
      devHud = mountDevHUD({
        getPosition,
        getDirection,
        onPin: options.onPin,
        onSetLightingPreset: lightingCallbacks.onSetLightingPreset,
        lightingPresets: lightingCallbacks.lightingPresets,
        getActivePresetName: lightingCallbacks.getActivePresetName,
        setActivePreset: lightingCallbacks.setActivePreset,
        getFogEnabled: fogCallbacks?.getFogEnabled,
        onToggleFog: fogCallbacks?.onToggleFog,
        sunAlignment,
      });
    }

    // Initialize minimap
    if (getPosition && getDirection) {
      minimap = mountMiniMap({ getPosition, getDirection });
    }

    // Initialize camera settings HUD (attached to dev HUD if available)
    if (devHud) {
      cameraSettingsHud = mountCameraSettings(devHud.rootElement ?? null);
    }

    // Initialize audio mixer if soundscape provided
    if (soundscape) {
      audioMixer = mountAudioMixer(soundscape);
    }

    // Initialize exposure slider if renderer provided
    if (renderer) {
      exposureSlider = mountExposureSlider(renderer, {
        min: 0.2,
        max: 2.0,
        step: 0.01,
        key: 'F9',
      });
    }

    // Initialize hotkey overlay
    hotkeyOverlay = mountHotkeyOverlay({ toggleKey: 'KeyH' });

    // Update layout to position all panels
    updateLayout();
  },

  updateDevHud(data) {
    if (devHud && data.activePreset) {
      devHud.setActivePreset?.(data.activePreset);
    }
    if (devHud && data.statusLines) {
      Object.entries(data.statusLines).forEach(([id, text]) => {
        devHud.setStatusLine?.(id, text);
      });
    }
    if (devHud && data.oceanStatus) {
      devHud.setOceanStatus?.(data.oceanStatus);
    }
    if (devHud && typeof data.fogEnabled === 'boolean') {
      devHud.updateFogState?.(data.fogEnabled);
    }
  },

  showInteraction(text) {
    if (interactionHud) {
      interactionHud.show(text);
    }
  },

  hideInteraction() {
    if (interactionHud) {
      interactionHud.hide();
    }
  },

  dispose() {
    if (devHud?.dispose) devHud.dispose();
    if (minimap?.dispose) minimap.dispose();
    if (audioMixer?.dispose) audioMixer.dispose();
    if (exposureSlider?.dispose) exposureSlider.dispose();
  },

  getDevHud() {
    return devHud;
  },

  getInteractionHud() {
    return interactionHud;
  },

  getQuestHud() {
    return questHud;
  }
};
