import type { LoadingScreenOptions } from "@app/types";

declare function showLoadingScreen(options?: LoadingScreenOptions): void;
declare function updateLoadingStatus(message: string): void;
declare function updateLoadingProgress(current?: number, total?: number): void;
declare function showLoadingError(message?: string): void;
declare function hideLoadingScreen(): void;

export { showLoadingScreen, updateLoadingStatus, updateLoadingProgress, showLoadingError, hideLoadingScreen };
