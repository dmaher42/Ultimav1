export interface ApplicationBootOptions {
  baseUrl?: string;
  districtRuleCandidates?: string[];
  queryParams?: URLSearchParams;
  forceGlb?: boolean;
  forceProc?: boolean;
}

export class Application {
  constructor(options?: ApplicationBootOptions);
  run(): Promise<void>;
}
