// src/config/athensLayoutConfig.js
// -----------------------------------------------------------------------------
// This file centralises every landmark placement used by the Ancient Athens
// prototype.  Instead of scattering coordinates and asset references throughout
// the main application loop we keep them in a single, well-commented manifest.
// Each landmark can specify:
//   - a unique identifier and display label
//   - one or more candidate asset files plus optional fallbacks
//   - placement information (position, rotation, scale)
//   - collision / placeholder behaviour and helper text for missing assets
// The LandmarkManager reads this structure and takes care of instancing models,
// logging fallback usage, and spawning placeholders when an asset is absent.
// Landmarks are intentionally disabled in this solo project.
//
// Because the in-game coordinate system is rooted around a handful of historic
// anchors we derive most positions as offsets from those shared reference
// points.  This keeps the layout easy to tweak while matching the curated
// terrain that already exists inside the scene graph.
// -----------------------------------------------------------------------------

import { deepFreeze, mergeDeep, getRuntimeEnvironment, assert } from "./utils.js";

const districtRulesManifest = {
  "version": 2,
  "seed": 1337,
  "roadSetbackMeters": 4,
  "maxSlopeDeltaPerLot": 2,
  "densitySpacingMeters": { "high": 11, "medium": 16, "low": 22 },
  "districts": [
    {
      "id": "civic",
      "label": "Civic District",
      "heightRange": [-999, 999],
      "buildingDensity": "medium",
      "minSeparation": 20,
      "allowedTypes": ["monument", "temple", "stoa", "plaza"],
      "road": { "width": 4.0, "color": 14540253 }
    },
    {
      "id": "commercial",
      "label": "Market District",
      "heightRange": [-999, 999],
      "buildingDensity": "high",
      "minSeparation": 12,
      "allowedTypes": ["shop", "market", "workshop"],
      "road": { "width": 3.2, "color": 12632256 }
    },
    {
      "id": "residential",
      "label": "Residential",
      "heightRange": [-999, 999],
      "buildingDensity": "medium",
      "minSeparation": 15,
      "allowedTypes": ["house", "courtyard"],
      "road": { "width": 2.8, "color": 10066329 }
    }
  ]
};

import {
  ACROPOLIS_PEAK_3D,
  AGORA_CENTER_3D,
  HARBOR_CENTER_3D,
} from "../world/locations.js";

function anchorPosition(anchor, delta = {}) {
  const base = anchor || { x: 0, y: 0, z: 0 };
  const dx = delta.x ?? delta[0] ?? 0;
  const dy = delta.y ?? delta[1] ?? 0;
  const dz = delta.z ?? delta[2] ?? 0;
  return {
    x: (base.x ?? 0) + dx,
    y: (base.y ?? 0) + dy,
    z: (base.z ?? 0) + dz,
  };
}

function normalizeDistrictRules(manifest = {}) {
  const safe = manifest && typeof manifest === "object" ? manifest : {};
  const density = safe.densitySpacingMeters || safe.densityToLotSpacing || {};
  const normalisedDensity = {
    high: Number.isFinite(density.high) ? density.high : 11,
    medium: Number.isFinite(density.medium) ? density.medium : 16,
    low: Number.isFinite(density.low) ? density.low : 22,
  };

  const districts = Array.isArray(safe.districts)
    ? safe.districts.map((district, index) => {
        const id = typeof district.id === "string" && district.id.trim() ? district.id.trim() : `district-${index}`;
        const label = typeof district.label === "string" ? district.label : id;
        const allowedTypes = Array.isArray(district.allowedTypes)
          ? district.allowedTypes.filter((v) => typeof v === "string" && v.trim())
          : ["house"];
        const heightRange = Array.isArray(district.heightRange)
          ? [Number(district.heightRange[0] ?? -999), Number(district.heightRange[1] ?? 999)]
          : [-999, 999];
        const road = district.road && typeof district.road === "object" ? { ...district.road } : {};
        road.width = Number.isFinite(road.width) ? road.width : 3.2;
        road.color = Number.isFinite(road.color) ? road.color : 0x333333;

        return {
          ...district,
          id,
          label,
          allowedTypes,
          heightRange,
          buildingDensity: district.buildingDensity || "medium",
          minSeparation: Number.isFinite(district.minSeparation) ? district.minSeparation : 0,
          road,
        };
      })
    : [];

  return {
    version: typeof safe.version === "number" ? safe.version : 1,
    seed: Number.isFinite(safe.seed) ? safe.seed : 0,
    densitySpacingMeters: normalisedDensity,
    maxSlopeDeltaPerLot: Number.isFinite(safe.maxSlopeDeltaPerLot)
      ? safe.maxSlopeDeltaPerLot
      : 2,
    roadSetbackMeters: Number.isFinite(safe.roadSetbackMeters) ? safe.roadSetbackMeters : 4,
    districts,
  };
}

const baseAthensLayoutConfig = {
  version: 1,
  metadata: {
    author: "configuration",
    description:
      "Historic Athens layout covering the Acropolis, Agora, and civic outskirts.",
  },
  defaults: {
    collision: false,
    alignToTerrain: true,
    surfaceOffset: 0.08,
    snapOptions: {
      clampToSea: true,
      minAboveSea: 0.05,
    },
    placeholder: {
      enabled: true,
    },
    loadOptions: {
      materialPreset: "marble",
    },
  },
  // Landmarks are intentionally disabled in this solo project.
  landmarks: [],
  groups: [
    {
      id: "acropolis-plateau",
      label: "Acropolis Plateau",
      description:
        "Monuments crowning the limestone plateau dedicated to Athena.",
      defaults: {
        collision: true,
      },
      landmarks: [],
    },
    {
      id: "acropolis-slopes",
      label: "Acropolis Slopes",
      description:
        "Performance venues and healing sanctuaries hugging the southern cliffs.",
      defaults: {
        collision: true,
      },
      landmarks: [],
    },
    {
      id: "athenian-agora",
      label: "Athenian Agora",
      description:
        "Civic square hosting the council, courts, and bustling stoas of democratic Athens.",
      defaults: {
        collision: true,
      },
      landmarks: [],
    },
    {
      id: "med-harbor-landmarks",
      label: "Mediterranean Harbor Landmarks",
      description:
        "Seaside markers guiding sailors toward the piers and animating the waterfront plaza.",
      scenes: ["harbor"],
      defaults: {
        collision: true,
        loadOptions: {
          materialPreset: "mediterranean-plaster",
        },
        placeholder: {
          accentColor: 0xd2b48c,
          baseRadius: 1.8,
          columnHeight: 3.2,
        },
      },
      landmarks: [],
    },
    {
      id: "city-outskirts",
      label: "City & Outskirts",
      description:
        "Religious sanctuaries and athletic venues beyond the civic core.",
      defaults: {
        collision: true,
      },
      landmarks: [],
    },
  ],
};

const unifiedDistrictRules = normalizeDistrictRules(districtRulesManifest);
assert(
  Array.isArray(unifiedDistrictRules.districts),
  "District rules manifest must provide a districts array",
);

const ENVIRONMENT_OVERRIDES = {
  development: {
    metadata: {
      environment: "development",
    },
  },
};

const baseLayoutConfig = mergeDeep({}, baseAthensLayoutConfig, {
  metadata: mergeDeep({}, baseAthensLayoutConfig.metadata || {}, {
    districtVersion: unifiedDistrictRules.version ?? 0,
  }),
  districts: unifiedDistrictRules.districts,
  districtRules: unifiedDistrictRules,
});

const initialEnvironment = getRuntimeEnvironment();

export const athensLayoutConfig = deepFreeze(
  mergeDeep({}, baseLayoutConfig, ENVIRONMENT_OVERRIDES[initialEnvironment] || {}),
);

export function createAthensLayoutConfig(
  environment = getRuntimeEnvironment(),
  overrides = {},
) {
  return deepFreeze(
    mergeDeep(
      {},
      baseLayoutConfig,
      ENVIRONMENT_OVERRIDES[environment] || {},
      overrides,
    ),
  );
}

export default athensLayoutConfig;
