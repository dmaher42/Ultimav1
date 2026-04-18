import * as THREE from "three";
import { AEGEAN_OCEAN_BOUNDS } from "../locations.js";

function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function createBeachPatch(scaleX, scaleZ) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.08, 0.12, 18),
        new THREE.MeshStandardMaterial({
            color: 0xc8bea8,
            roughness: 0.96,
            metalness: 0.02,
            fog: true,
        }),
    );
    mesh.scale.set(scaleX, 1, scaleZ);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
}

function createScrubTuft(scale = 1) {
    const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.78, 6),
        new THREE.MeshStandardMaterial({
            color: 0x5f7a46,
            roughness: 0.86,
            metalness: 0.02,
            fog: true,
        }),
    );
    tuft.scale.setScalar(scale);
    tuft.castShadow = true;
    tuft.receiveShadow = true;
    return tuft;
}

function createShoreCluster(x, z, terrain, seaLevel, seed) {
    if (!terrain?.userData?.getHeightAt) return null;
    const h = terrain.userData.getHeightAt(x, z);
    if (!Number.isFinite(h) || h <= seaLevel + 0.08 || h >= seaLevel + 1.7) return null;

    const group = new THREE.Group();
    group.name = "ShoreCluster";

    const patch = createBeachPatch(
        2.1 + seededRandom(seed + 1) * 2.6,
        1.4 + seededRandom(seed + 2) * 1.9,
    );
    patch.position.set(0, h + 0.05, 0);
    patch.rotation.y = seededRandom(seed + 3) * Math.PI;
    group.add(patch);

    for (let i = 0; i < 3; i++) {
        const tuft = createScrubTuft(0.8 + seededRandom(seed + 10 + i) * 0.55);
        const offsetX = (seededRandom(seed + 20 + i) * 2 - 1) * 1.8;
        const offsetZ = (seededRandom(seed + 30 + i) * 2 - 1) * 1.4;
        const tuftHeight = terrain.userData.getHeightAt(x + offsetX, z + offsetZ);
        if (!Number.isFinite(tuftHeight) || tuftHeight <= seaLevel + 0.12) continue;
        tuft.position.set(offsetX, tuftHeight + 0.2, offsetZ);
        tuft.rotation.y = seededRandom(seed + 40 + i) * Math.PI * 2;
        group.add(tuft);
    }

    group.position.set(x, 0, z);
    return group;
}

export function createShorelineDressing(scene, terrain, seaLevel) {
    const group = new THREE.Group();
    group.name = "ShorelineDressing";
    scene.add(group);

    // Beach terrain exists only at the east coastal tips where the terrain's
    // coast-fade brings elevation into the valid cluster range
    // (seaLevel + 0.08 m to seaLevel + 1.7 m).  That narrow transition band
    // requires x to be within ~35 units of the terrain east edge (x = 1200).
    //
    // In the z direction, clusters must sit *outside* AEGEAN_OCEAN_BOUNDS so
    // that clampHarborBandHeight does not clamp terrain to the seabed.
    // Due to the PlaneGeometry y-axis orientation used during terrain
    // generation the effective ocean boundary is symmetric at
    // |worldZ| > oceanEdge (≈ 930) for both north and south coasts.
    const TERRAIN_EAST_EDGE = 1200;
    const coastXWest = TERRAIN_EAST_EDGE - 35; // 1165 – noise-safe lower bound
    const coastXEast = TERRAIN_EAST_EDGE - 10; // 1190 – noise-safe upper bound

    const oceanEdge = Math.max(
        Math.abs(AEGEAN_OCEAN_BOUNDS.north),
        Math.abs(AEGEAN_OCEAN_BOUNDS.south),
    ); // ≈ 930 – |worldZ| threshold for both coasts

    const northBandMin =  oceanEdge + 12;  //  942 – inside north coastal tip
    const northBandMax =  oceanEdge + 200; // 1130
    const southBandMin = -(oceanEdge + 200); // -1130
    const southBandMax = -(oceanEdge + 12);  //  -942 – inside south coastal tip

    const seed = 999;
    const clusterCount = 5;
    for (let i = 0; i < clusterCount; i++) {
        const side = seededRandom(seed + 240 + i) > 0.5 ? 1 : -1;

        const x = coastXWest + seededRandom(seed + 300 + i) * (coastXEast - coastXWest);
        const z = side > 0
            ? northBandMin + seededRandom(seed + 320 + i) * (northBandMax - northBandMin)
            : southBandMin + seededRandom(seed + 320 + i) * (southBandMax - southBandMin);

        const cluster = createShoreCluster(x, z, terrain, seaLevel, seed + 400 + i * 17);
        if (cluster) {
            group.add(cluster);
        }
    }

    return group;
}
