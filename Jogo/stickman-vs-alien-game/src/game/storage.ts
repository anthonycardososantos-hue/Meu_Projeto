export interface ScoreEntry {
  name: string;
  score: number;
  wave: number;
  kills: number;
  date: number;
}

const KEY = 'stickarena.highscores.v1';
const SETTINGS_KEY = 'stickarena.settings.v1';

export interface Settings {
  music: number;
  sfx: number;
  shake: number;
  touch: 'auto' | 'on' | 'off';
}

export const defaultSettings: Settings = { music: 0.6, sfx: 0.75, shake: 1, touch: 'auto' };

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e?.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores();
  list.push(entry);
  const next = list.sort((a, b) => b.score - a.score).slice(0, 8);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function isHighScore(score: number): boolean {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < 8 || score > list[list.length - 1].score;
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
