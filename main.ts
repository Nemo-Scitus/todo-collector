import { Plugin, TFile, debounce } from "obsidian";

const OUTPUT = "_TODO.md";
const TODO_LINE = /^\s*- \[ \] ?(.*)$/;

interface NoteTodos {
  file: TFile;
  items: string[];
}

export default class TodoCollector extends Plugin {
  // Notes that currently contain open todos. Lets us ignore edits to notes
  // that neither had nor now have any, which is most edits.
  private notesWithTodos = new Set<string>();
  private running = false;
  private rerun = false;

  // Wait for 1s of quiet before rebuilding, so typing doesn't trigger constant rewrites.
  private rebuildSoon = debounce(() => this.rebuild(), 1000, true);

  async onload() {
    this.addCommand({
      id: "rebuild",
      name: "Rebuild _TODO.md",
      callback: () => this.rebuild(),
    });

    this.app.workspace.onLayoutReady(() => {
      this.rebuild();

      // "changed" fires after Obsidian has re-indexed a note, so its todo info is fresh.
      this.registerEvent(
        this.app.metadataCache.on("changed", (file, _data, cache) => {
          if (file.path === OUTPUT) return;
          const hasTodos = !!cache.listItems?.some((i) => i.task === " ");
          if (hasTodos || this.notesWithTodos.has(file.path)) this.rebuildSoon();
        })
      );
      this.registerEvent(this.app.vault.on("delete", () => this.rebuildSoon()));
      this.registerEvent(this.app.vault.on("rename", () => this.rebuildSoon()));
    });
  }

  onunload() {
    this.rebuildSoon.cancel();
  }

  /** Runs one build at a time; a request that arrives mid-build triggers one more pass. */
  async rebuild() {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        await this.build();
      } while (this.rerun);
    } finally {
      this.running = false;
    }
  }

  private async build() {
    const { vault, metadataCache } = this.app;
    const found: NoteTodos[] = [];
    const notesWithTodos = new Set<string>();

    for (const file of vault.getMarkdownFiles()) {
      if (file.path === OUTPUT) continue;
      // Obsidian's index already knows which lines are open tasks (and skips code
      // blocks), so we only read the notes that actually contain some.
      const lines = metadataCache
        .getFileCache(file)
        ?.listItems?.filter((i) => i.task === " ")
        .map((i) => i.position.start.line);
      if (!lines?.length) continue;
      notesWithTodos.add(file.path);

      const text = (await vault.cachedRead(file)).split("\n");
      const items: string[] = [];
      for (const n of lines) {
        const m = text[n]?.match(TODO_LINE);
        if (m && m[1].trim()) items.push(m[1].trim());
      }
      if (items.length) found.push({ file, items });
    }

    this.notesWithTodos = notesWithTodos;
    found.sort((a, b) => comparePaths(a.file.path, b.file.path));
    await this.write(render(found));
  }

  private async write(content: string) {
    const { vault } = this.app;
    const existing = vault.getAbstractFileByPath(OUTPUT);
    if (existing instanceof TFile) {
      if ((await vault.read(existing)) !== content) await vault.modify(existing, content);
    } else {
      await vault.create(OUTPUT, content);
    }
  }
}

/**
 * Turns the todos into nested headings: one heading level per folder, then the note.
 *
 *   # Projects
 *   ## Website
 *   ### [[Projects/Website/Launch|Launch]]
 *   - [ ] Buy domain
 */
function render(found: NoteTodos[]): string {
  if (!found.length) return "No open todos.\n";

  const out: string[] = [];
  const heading = (level: number, text: string) => `${"#".repeat(Math.min(level, 6))} ${text}`;
  let prevFolders: string[] = [];

  for (const { file, items } of found) {
    const folders = file.path.split("/").slice(0, -1);

    // Only print the folder headings that differ from the previous note's.
    let shared = 0;
    while (shared < folders.length && folders[shared] === prevFolders[shared]) shared++;
    for (let i = shared; i < folders.length; i++) out.push(heading(i + 1, folders[i]), "");

    // Root notes link by name; nested ones need the full path but display just the name.
    const link = folders.length ? `[[${file.path.slice(0, -3)}|${file.basename}]]` : `[[${file.basename}]]`;
    out.push(heading(folders.length + 1, link), "");
    for (const item of items) out.push(`- [ ] ${item}`);
    out.push("");

    prevFolders = folders;
  }

  return out.join("\n").trimEnd() + "\n";
}

/** Alphabetical, but a folder's own notes come before its sub-folders. */
function comparePaths(a: string, b: string): number {
  const x = a.split("/");
  const y = b.split("/");
  for (let i = 0; ; i++) {
    const xIsNote = i === x.length - 1;
    const yIsNote = i === y.length - 1;
    if (xIsNote !== yIsNote) return xIsNote ? -1 : 1;
    const c = x[i].localeCompare(y[i], undefined, { numeric: true, sensitivity: "base" });
    if (c !== 0 || xIsNote) return c;
  }
}
