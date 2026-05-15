# Export / Import Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Export and Import save buttons to the Info page that let users download and restore the full game state as a versioned JSON file.

**Architecture:** A new `src/db/saveData.ts` utility reads all IndexedDB stores and serialises them into a versioned envelope for export, and reverses the process for import (clear + repopulate). The Info page gets a new "Save Data" section with the two buttons; all async logic stays in the utility, keeping the component thin.

**Tech Stack:** TypeScript, idb (already used), React, CSS Modules

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/db/saveData.ts` | Export/import logic; versioned envelope type |
| Modify | `src/pages/Info/InfoPage.tsx` | Add "Save Data" section with Export + Import buttons |
| Modify | `src/pages/Info/InfoPage.module.css` | Styles for the new section |

---

### Task 1: saveData utility — export

**Files:**
- Create: `src/db/saveData.ts`

- [ ] **Step 1: Create `src/db/saveData.ts` with the SaveFile type and `exportSave` function**

```ts
import { getDB } from './db';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  exportedAt: string;
  stores: {
    boxers: unknown[];
    coaches: unknown[];
    gym: unknown[];
    federations: unknown[];
    fights: unknown[];
    fightContracts: unknown[];
    ppvNetworks: unknown[];
    titles: unknown[];
    calendarEvents: unknown[];
    federationEvents: unknown[];
    transactions: unknown[];
  };
}

export async function exportSave(): Promise<void> {
  const db = await getDB();
  const save: SaveFile = {
    version: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    stores: {
      boxers:          await db.getAll('boxers'),
      coaches:         await db.getAll('coaches'),
      gym:             await db.getAll('gym'),
      federations:     await db.getAll('federations'),
      fights:          await db.getAll('fights'),
      fightContracts:  await db.getAll('fightContracts'),
      ppvNetworks:     await db.getAll('ppvNetworks'),
      titles:          await db.getAll('titles'),
      calendarEvents:  await db.getAll('calendarEvents'),
      federationEvents: await db.getAll('federationEvents'),
      transactions:    await db.getAll('transactions'),
    },
  };

  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `boxing-manager-save-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/saveData.ts
git commit -m "feat: add saveData utility with exportSave"
```

---

### Task 2: saveData utility — import

**Files:**
- Modify: `src/db/saveData.ts`

- [ ] **Step 1: Add `importSave` to `src/db/saveData.ts`**

Append the following to the end of `src/db/saveData.ts`:

```ts
export type ImportResult =
  | { ok: true; versionMismatch: false }
  | { ok: true; versionMismatch: true; fileVersion: number }
  | { ok: false; error: string };

export async function importSave(file: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('stores' in parsed) ||
    typeof (parsed as SaveFile).stores !== 'object'
  ) {
    return { ok: false, error: 'File does not look like a Boxing Manager save.' };
  }

  const save = parsed as SaveFile;
  const versionMismatch = save.version !== SAVE_VERSION;

  const db = await getDB();
  const tx = db.transaction(
    ['boxers','coaches','gym','federations','fights','fightContracts',
     'ppvNetworks','titles','calendarEvents','federationEvents','transactions'],
    'readwrite',
  );

  await Promise.all([
    tx.objectStore('boxers').clear(),
    tx.objectStore('coaches').clear(),
    tx.objectStore('gym').clear(),
    tx.objectStore('federations').clear(),
    tx.objectStore('fights').clear(),
    tx.objectStore('fightContracts').clear(),
    tx.objectStore('ppvNetworks').clear(),
    tx.objectStore('titles').clear(),
    tx.objectStore('calendarEvents').clear(),
    tx.objectStore('federationEvents').clear(),
    tx.objectStore('transactions').clear(),
  ]);

  const s = save.stores;
  await Promise.all([
    ...(s.boxers          as object[]).map(r => tx.objectStore('boxers').put(r as never)),
    ...(s.coaches         as object[]).map(r => tx.objectStore('coaches').put(r as never)),
    ...(s.gym             as object[]).map(r => tx.objectStore('gym').put(r as never)),
    ...(s.federations     as object[]).map(r => tx.objectStore('federations').put(r as never)),
    ...(s.fights          as object[]).map(r => tx.objectStore('fights').put(r as never)),
    ...(s.fightContracts  as object[]).map(r => tx.objectStore('fightContracts').put(r as never)),
    ...(s.ppvNetworks     as object[]).map(r => tx.objectStore('ppvNetworks').put(r as never)),
    ...(s.titles          as object[]).map(r => tx.objectStore('titles').put(r as never)),
    ...(s.calendarEvents  as object[]).map(r => tx.objectStore('calendarEvents').put(r as never)),
    ...(s.federationEvents as object[]).map(r => tx.objectStore('federationEvents').put(r as never)),
    ...(s.transactions    as object[]).map(r => tx.objectStore('transactions').put(r as never)),
  ]);

  await tx.done;

  return versionMismatch
    ? { ok: true, versionMismatch: true, fileVersion: save.version }
    : { ok: true, versionMismatch: false };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/saveData.ts
git commit -m "feat: add importSave to saveData utility"
```

---

### Task 3: Info page — Save Data section

**Files:**
- Modify: `src/pages/Info/InfoPage.tsx`
- Modify: `src/pages/Info/InfoPage.module.css`

- [ ] **Step 1: Add state and handlers to `InfoPage.tsx`**

At the top of the file, add the import:

```ts
import { useState, useRef } from 'react';
import { exportSave, importSave } from '../../db/saveData';
```

Replace the `export default function InfoPage()` signature and opening with:

```tsx
export default function InfoPage() {
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'warn' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    await exportSave();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'This will replace ALL current game data with the imported save. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setImporting(true);
    setImportMsg(null);
    const result = await importSave(file);
    setImporting(false);

    if (!result.ok) {
      setImportMsg({ type: 'error', text: result.error });
      return;
    }
    if (result.versionMismatch) {
      setImportMsg({
        type: 'warn',
        text: `Imported save is version ${result.fileVersion} (current: 1). Data loaded — some fields may be missing or incompatible.`,
      });
      setTimeout(() => window.location.reload(), 2000);
      return;
    }
    window.location.reload();
  }
```

- [ ] **Step 2: Add the Save Data section JSX**

Inside the returned JSX of `InfoPage`, after the closing `</div>` of the last section (Reputation Ladder) and before the closing `</div>` of the page, add:

```tsx
      {/* Save Data */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>Save Data</div>
        <div className={styles.sectionBody}>
          <div className={styles.saveRow}>
            <button type="button" className={styles.saveBtn} onClick={handleExport}>
              Export Save
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing…' : 'Import Save'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className={styles.hiddenInput}
              onChange={handleImportFile}
            />
          </div>
          {importMsg && (
            <div className={
              importMsg.type === 'error' ? styles.msgError :
              importMsg.type === 'warn'  ? styles.msgWarn  :
                                           styles.msgSuccess
            }>
              {importMsg.text}
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 3: Add CSS to `InfoPage.module.css`**

Append to the end of the file:

```css
.saveRow {
  display: flex;
  gap: 10px;
  align-items: center;
}

.saveBtn {
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.saveBtn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.saveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hiddenInput {
  display: none;
}

.msgError {
  font-size: 12px;
  color: var(--color-loss, #e74c3c);
}

.msgWarn {
  font-size: 12px;
  color: var(--color-warning, #e67e22);
}

.msgSuccess {
  font-size: 12px;
  color: var(--color-win, #2ecc71);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Info/InfoPage.tsx src/pages/Info/InfoPage.module.css
git commit -m "feat: add Export/Import Save section to Info page"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify export**

Navigate to Info page → click "Export Save" → confirm a `.json` file downloads and opens correctly, containing all 11 store arrays and a `version: 1` field.

- [ ] **Step 3: Verify import — version match**

Import the file you just exported → confirm dialog appears → confirm → page reloads and game state is intact.

- [ ] **Step 4: Verify import — version mismatch warning**

Edit the downloaded JSON and change `"version": 1` to `"version": 0`. Import it → confirm dialog → confirm → verify the yellow warning message appears briefly before reload.

- [ ] **Step 5: Verify import — bad file**

Import a non-JSON file (e.g., a `.txt`) → verify the error message appears and no reload happens.

- [ ] **Step 6: Verify import — cancel**

Click "Import Save", pick a file, then click Cancel in the confirm dialog → verify nothing changes.
