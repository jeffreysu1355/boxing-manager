import type { Boxer } from '../db/db';

export interface BoxerExport {
  exportVersion: 1;
  boxer: Omit<Boxer, 'id'>;
}

export function exportBoxer(boxer: Boxer): void {
  const { id: _id, ...rest } = boxer;
  const payload: BoxerExport = { exportVersion: 1, boxer: rest };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `boxer-${boxer.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
