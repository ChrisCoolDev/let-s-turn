const TOUR_STORAGE_KEY = 'lets_turn_tour_v1';

export interface TourState {
  hubDone: boolean;
  boardDone: boolean;
}

const DEFAULT_TOUR_STATE: TourState = {
  hubDone: false,
  boardDone: false,
};

export function loadTourState(): TourState {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return DEFAULT_TOUR_STATE;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      hubDone: Boolean(parsed.hubDone),
      boardDone: Boolean(parsed.boardDone),
    };
  } catch {
    return DEFAULT_TOUR_STATE;
  }
}

export function markTourDone(scope: 'hub' | 'board'): TourState {
  const current = loadTourState();
  const next: TourState = {
    ...current,
    ...(scope === 'hub' ? { hubDone: true } : { boardDone: true }),
  };
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures in restricted contexts
  }
  return next;
}
