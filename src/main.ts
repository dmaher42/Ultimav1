import * as THREE from "three";
import type { ApplicationBootOptions } from "./core/Application.js";
import type { Application } from "./core/Application.js";

// Expose THREE globally for devtools debugging.
(window as any).THREE = THREE;
console.log("✅ THREE exposed globally for debugging (main.ts)");

import {
  applicationBootConfig as runtimeApplicationBootConfig,
  bootApplication as runtimeBootApplication,
  runApplication as runtimeRunApplication,
} from "./main.runtime.js";

export interface ApplicationFeatureFlags {
  forceGlb: boolean;
  forceProcedural: boolean;
}

export interface ApplicationBootConfig {
  baseUrl: string;
  districtRuleCandidates: readonly string[];
  queryParams: URLSearchParams;
  featureFlags: ApplicationFeatureFlags;
}

export const applicationBootConfig: ApplicationBootConfig =
  runtimeApplicationBootConfig;

const _bootOptions: ApplicationBootOptions = {
  baseUrl: applicationBootConfig.baseUrl,
  districtRuleCandidates: [...applicationBootConfig.districtRuleCandidates],
  queryParams: applicationBootConfig.queryParams,
  forceGlb: applicationBootConfig.featureFlags.forceGlb,
  forceProc: applicationBootConfig.featureFlags.forceProcedural,
};

export type ApplicationRunResult = Awaited<ReturnType<Application["run"]>>;
export type ApplicationRunner = () => Promise<ApplicationRunResult>;

export const runApplication: ApplicationRunner =
  runtimeRunApplication as ApplicationRunner;

const bootApplication = runtimeBootApplication as ApplicationRunner;

void bootApplication();

void _bootOptions;
