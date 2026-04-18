import * as THREE from "three";

function isGroundy(obj) {
  const n = (obj?.name || "").toLowerCase();
  return (
    n.includes("terrain") ||
    n.includes("harbor") ||
    n.includes("ocean") ||
    n.includes("shore") ||
    n.includes("floorcap") ||
    n.includes("water") ||
    n.includes("dock") ||
    n.includes("pad")
  );
}

function getMaterialInfo(material) {
  if (!material) return { type: "null" };
  if (Array.isArray(material)) {
    return { type: "array", count: material.length };
  }
  return {
    type: material.type,
    transparent: material.transparent ?? false,
    opacity: material.opacity ?? 1,
    renderOrder: "renderOrder" in material ? material.renderOrder : "N/A",
    depthWrite: material.depthWrite ?? true,
    depthTest: material.depthTest ?? true,
    colorWrite: material.colorWrite ?? true,
    side: material.side === THREE.DoubleSide ? "DoubleSide" : material.side === THREE.BackSide ? "BackSide" : "FrontSide",
  };
}

function addOutline(scene, obj) {
  try {
    const geom = obj.geometry || obj?.mesh?.geometry;
    if (!geom || !geom.attributes?.position) return;
    const edges = new THREE.EdgesGeometry(geom, 30);
    const mat = new THREE.LineBasicMaterial({ color: 0xff3333 });
    const lines = new THREE.LineSegments(edges, mat);
    lines.name = `${obj.name || "Object"}-Outline`;
    lines.renderOrder = 9999;
    lines.frustumCulled = false;
    lines.userData.debugHelper = true;
    lines.position.copy(obj.position);
    lines.rotation.copy(obj.rotation);
    lines.scale.copy(obj.scale);
    scene.add(lines);
  } catch (e) {
    console.warn("[groundAudit] outline failed for", obj?.name, e);
  }
}

function enableWireframe(obj) {
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const m of mats) {
    if (!m || !m.isMaterial) continue;
    m.wireframe = true;
    m.depthTest = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
    m.needsUpdate = true;
  }
}

function logDetailedAudit(scene) {
  console.group("=== GROUND LAYER AUDIT ===");
  
  const groundLayers = scene.children.filter(isGroundy);
  
  console.log(`\nFound ${groundLayers.length} ground-related meshes:\n`);
  
  const rows = groundLayers.map((obj) => {
    const matInfo = getMaterialInfo(obj.material);
    return {
      name: obj.name,
      y: Number((obj.position?.y ?? 0).toFixed(2)),
      renderOrder: obj.renderOrder ?? 0,
      type: obj.type,
      transparent: matInfo.transparent,
      opacity: matInfo.opacity,
      depthWrite: matInfo.depthWrite,
      side: matInfo.side,
      visible: obj.visible ?? true,
    };
  });
  
  // Sort by Y (descending) then by renderOrder (descending) for visibility analysis
  rows.sort((a, b) => {
    if (a.y !== b.y) return b.y - a.y;
    return (b.renderOrder ?? 0) - (a.renderOrder ?? 0);
  });
  
  console.table(rows);
  
  console.log("\n=== LAYER OVERLAP ANALYSIS ===");
  for (const row of rows) {
    const opacity = row.transparent ? row.opacity : 1.0;
    const occludes = !row.transparent || opacity > 0.95 ? "✓ OPAQUE (occludes below)" : "✗ TRANSPARENT";
    console.log(`${row.name.padEnd(30)} Y=${row.y.toString().padStart(6)} renderOrder=${String(row.renderOrder).padStart(3)} ${occludes}`);
  }
  
  console.log("\n=== RENDERING STACK (EXPECTED ORDER) ===");
  console.log("High renderOrder renders LAST (on top)");
  console.log("Lower Y positions render FIRST (below)");
  console.log("Suggested stack (bottom to top):");
  console.log("  1. WorldFloorCap (Y≈-140, renderOrder=-10) - Below everything");
  console.log("  2. Terrain (Y=0, renderOrder=0) - Main ground with sand texture");
  console.log("  3. AegeanOcean (Y=0, renderOrder=0, transparent) - Ocean water");
  console.log("  4. ShoreTermination (Y≈0.06, renderOrder=-1, transparent) - Coastal silhouette");
  console.log("  5. Docks / quay / harbor props (renderOrder=2 or default) - Above-water structures");
  console.log("  6. Shoreline dressing / beach patches (slightly above terrain) - Coastal transition detail");
  console.log("  7. Dock decks (Y≈0.975, renderOrder=0) - Wood walkways above the basin");
  
  console.log("Current runtime ownership:");
  console.log("  - AegeanOcean is the only live water surface.");
  console.log("  - Terrain owns shoreline elevation and coastal material zoning.");
  console.log("  - Terrain is the harbor-ground owner near the basin.");
  console.log("  - Harbor structures should stay above the shoreline, not replace it.");
  console.groupEnd();
}

export function mountGroundAudit(scene) {
  if (!scene) return;
  // Clean old helpers
  scene.traverse((o) => {
    if (o.userData?.debugHelper) {
      o.parent?.remove(o);
    }
  });

  const targets = scene.children.filter(isGroundy);
  for (const t of targets) {
    addOutline(scene, t);
    enableWireframe(t);
    // Nudge transparent far ocean to avoid depth-sorting confusion in debug
    if (t.name === "FarOceanPlane" && t.material) {
      t.material.transparent = false;
      t.material.opacity = 1.0;
      t.material.depthWrite = true;
      t.material.needsUpdate = true;
      t.renderOrder = -10;
    }
  }

  logDetailedAudit(scene);

  // Expose quick toggle
  scene.userData.groundAudit = {
    refresh: () => mountGroundAudit(scene),
    disable: () => {
      scene.traverse((o) => {
        if (o.userData?.debugHelper) o.parent?.remove(o);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.isMaterial) m.wireframe = false;
        }
      });
    },
  };
}
