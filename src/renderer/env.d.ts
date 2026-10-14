import type { TrainerApi } from '../shared/types/api';

declare global {
  interface Window {
    api: TrainerApi;
  }
}

export {};
