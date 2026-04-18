// src/core/CameraManager.js
// Handles third-person camera and player controls

import * as THREE from 'three';
import { ThirdPersonCamera } from '../controls/ThirdPersonCamera.js';
import { PlayerController } from '../controls/PlayerController.js';

let camera, thirdPersonCamera, playerController, player;

export const CameraManager = {
  // Static method to create a default camera (used by Scene.js)
  createCamera(fov = 75, aspect = window.innerWidth / window.innerHeight, near = 0.1, far = 2000) {
    const cam = new THREE.PerspectiveCamera(fov, aspect, near, far);
    cam.position.set(0, 5, 10);
    return cam;
  },

  init(playerObject, renderer, canvas) {
    player = playerObject;

    // Create camera
    camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, -5);

    // Initialize player controller
    playerController = new PlayerController(player, canvas);
    playerController.init();

    // Initialize third-person camera
    thirdPersonCamera = new ThirdPersonCamera(camera, player);
    thirdPersonCamera.update(0);

    // Handle resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  },

  update(deltaTime) {
    if (playerController) playerController.update(deltaTime);
    if (thirdPersonCamera) thirdPersonCamera.update(deltaTime);
  },

  getCamera() {
    return camera;
  },

  getController() {
    return playerController;
  },

  getThirdPersonCamera() {
    return thirdPersonCamera;
  },

  getPlayer() {
    return player;
  }
};
