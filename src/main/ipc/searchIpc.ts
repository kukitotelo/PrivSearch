// ============================================================
// PrivSearch – Search IPC Handlers
// ============================================================

import { ipcMain } from 'electron';
import { SearchEngine } from '../../search/SearchEngine';
import { QueryClassifier } from '../../search/QueryClassifier';

export function registerSearchIpc(searchEngine: SearchEngine): void {
  const classifier = new QueryClassifier();

  ipcMain.handle('search:query', async (_event, rawQuery: string) => {
    if (typeof rawQuery !== 'string') return { error: 'Invalid query' };
    const trimmed = rawQuery.trim();
    if (!trimmed) return { error: 'Empty query' };
    if (trimmed.length > 2000) return { error: 'Query too long' };

    try {
      const results = await searchEngine.search(trimmed);
      return { ok: true, results };
    } catch (err: any) {
      return { error: err.message, results: null };
    }
  });

  ipcMain.handle('search:classify', async (_event, rawQuery: string) => {
    if (typeof rawQuery !== 'string') return { error: 'Invalid input' };
    return classifier.classify(rawQuery);
  });
}
