export interface LandmarkConfig {
  enabled?: boolean;
  name?: string;
  id?: string;
  placement?: { position?: unknown };
}

export interface LandmarkGroupConfig {
  landmarks?: LandmarkConfig[];
}

export const athensLayoutConfig: {
  groups?: LandmarkGroupConfig[];
} | null;
