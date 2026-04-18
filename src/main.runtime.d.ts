import type {
  ApplicationBootConfig,
  ApplicationRunResult,
  ApplicationRunner,
} from "./main";

export interface ApplicationBootHandlers {
  readonly onSuccess?: (result: ApplicationRunResult) => void;
  readonly onError?: (error: unknown) => void;
}

export const applicationBootConfig: ApplicationBootConfig;
export const defaultBootHandlers: Required<ApplicationBootHandlers>;
export const runApplication: ApplicationRunner;
export function bootApplication(
  handlers?: ApplicationBootHandlers,
): Promise<ApplicationRunResult>;
