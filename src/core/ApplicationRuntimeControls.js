function isWaterObject(obj) {
  return (
    obj?.name === "AegeanOcean" ||
    obj?.name?.toLowerCase?.().includes("water") ||
    obj?.name?.toLowerCase?.().includes("ocean") ||
    obj?.userData?.isWater ||
    (obj?.renderOrder === -1 && obj?.material?.transparent)
  );
}

function isRoadObject(obj) {
  return (
    obj?.name?.toLowerCase?.().includes("road") ||
    obj?.name?.toLowerCase?.().includes("street") ||
    obj?.name?.toLowerCase?.().includes("path") ||
    obj?.userData?.type === "road" ||
    obj?.userData?.isFootpath
  );
}

export function installApplicationRuntimeControls({
  scene,
  playerSystem,
  lightingSystem,
  interactor,
  renderer,
  camera,
  composer,
  bloomPass,
  toggleFog,
  probePlayerPosition,
} = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.toggleWater = () => {
    let count = 0;
    scene.traverse((obj) => {
      if (!isWaterObject(obj)) return;
      obj.visible = !obj.visible;
      count += 1;
    });
    console.log(`Toggled ${count} water objects`);
  };

  window.hideWater = () => {
    let count = 0;
    scene.traverse((obj) => {
      if (!isWaterObject(obj) || !obj.visible) return;
      obj.visible = false;
      count += 1;
    });
    console.log(`Hidden ${count} water objects`);
  };

  window.showWater = () => {
    let count = 0;
    scene.traverse((obj) => {
      if (!isWaterObject(obj) || obj.visible) return;
      obj.visible = true;
      count += 1;
    });
    console.log(`Shown ${count} water objects`);
  };

  window.hideRoads = () => {
    let count = 0;
    scene.traverse((obj) => {
      if (!isRoadObject(obj) || !obj.visible) return;
      obj.visible = false;
      count += 1;
    });
    console.log(`Hidden ${count} road objects (including footpaths)`);
  };

  window.showRoads = () => {
    let count = 0;
    scene.traverse((obj) => {
      if (!isRoadObject(obj) || obj.visible) return;
      obj.visible = true;
      count += 1;
    });
    console.log(`Shown ${count} road objects (including footpaths)`);
  };

  window.debugOcean = () => {
    const oceanObj = scene.getObjectByName("AegeanOcean");
    if (!oceanObj) {
      console.log("Ocean not found");
      return;
    }
    console.log("Ocean Debug Info:");
    console.log("  Position:", oceanObj.position);
    console.log("  Scale:", oceanObj.scale);
    console.log("  Name:", oceanObj.name);
    console.log("  Visible:", oceanObj.visible);
    console.log("  Expected bounds: X=[1500, 2300], Z=[-400, 400]");
    const playerPos = playerSystem?.player?.object?.position;
    console.log(
      "  Player position:",
      playerPos
        ? `X=${playerPos.x.toFixed(1)}, Y=${playerPos.y.toFixed(1)}, Z=${playerPos.z.toFixed(1)}`
        : "unknown",
    );
  };

  window.debugCivicDistrict = () => {
    console.log("Civic District Debug:");
    let roadCount = 0;
    let footpathCount = 0;
    let plazaCount = 0;
    scene.traverse((obj) => {
      if (obj.userData?.isFootpath) {
        footpathCount += 1;
        console.log(
          `  Footpath at (${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)}), visible: ${obj.visible}, color: ${obj.material?.color?.getHexString()}`,
        );
      }
      if (obj.geometry?.type === "BoxGeometry" && obj.position.y < 0.5 && obj.material?.color) {
        const hex = obj.material.color.getHexString();
        if (hex === "887766" || hex === "666666" || hex === "998877" || hex === "aa9988") {
          roadCount += 1;
          console.log(
            `  Road/path at (${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)}), visible: ${obj.visible}, color: #${hex}`,
          );
        }
        if (hex === "aaaaaa") {
          plazaCount += 1;
          console.log(
            `  Plaza at (${obj.position.x.toFixed(1)}, ${obj.position.z.toFixed(1)}), visible: ${obj.visible}`,
          );
        }
      }
    });
    console.log(`  Total: ${roadCount} roads, ${footpathCount} footpaths, ${plazaCount} plazas`);
  };

  window.findBrightObjects = () => {
    console.log("Finding bright/white objects in scene:");
    const brightObjects = [];
    scene.traverse((obj) => {
      if (!obj.material?.color) return;
      const hex = obj.material.color.getHexString();
      const r = obj.material.color.r;
      const g = obj.material.color.g;
      const b = obj.material.color.b;
      const brightness = (r + g + b) / 3;
      if (brightness <= 0.8) return;
      brightObjects.push({
        name: obj.name || "unnamed",
        type: obj.geometry?.type || "unknown",
        position: `(${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})`,
        color: `#${hex}`,
        visible: obj.visible,
        brightness: brightness.toFixed(2),
      });
    });
    console.table(brightObjects);
    console.log(`Found ${brightObjects.length} bright objects (brightness > 0.8)`);
    return brightObjects;
  };

  console.log("Water controls available: hideWater(), showWater(), toggleWater()");
  console.log("Road controls available: hideRoads(), showRoads()");
  console.log("Debug: debugOcean() to check ocean position");
  console.log("Debug: debugCivicDistrict() to inspect civic district elements");
  console.log("Debug: findBrightObjects() to locate white/bright meshes");

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      interactor.useObject();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyG" && !event.repeat) {
      toggleFog();
      return;
    }
    if (event.code === "KeyT" && !event.repeat) {
      lightingSystem.cycleLightingPreset();
      return;
    }
    if (event.code === "F8" && !event.repeat) {
      probePlayerPosition();
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
  });
}
