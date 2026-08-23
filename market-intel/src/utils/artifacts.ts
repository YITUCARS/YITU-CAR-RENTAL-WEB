import { mkdir, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Failure artifacts (screenshot + HTML snapshot) are what make a broken
 * selector debuggable a day later. Paths are recorded on the collection_errors
 * row; the files themselves stay on disk and are pruned by age.
 */
export class ArtifactStore {
  constructor(private readonly rootDir: string) {}

  private dirFor(sourceCode: string, when: Date): string {
    const day = when.toISOString().slice(0, 10);
    return path.join(this.rootDir, day, sourceCode);
  }

  async write(
    sourceCode: string,
    name: string,
    contents: string | Buffer,
    extension: string,
  ): Promise<string> {
    const when = new Date();
    const dir = this.dirFor(sourceCode, when);
    await mkdir(dir, { recursive: true });
    const stamp = when.toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${stamp}-${name}.${extension}`);
    await writeFile(file, contents);
    return file;
  }

  writeHtml(sourceCode: string, name: string, html: string): Promise<string> {
    return this.write(sourceCode, name, html, 'html');
  }

  writeScreenshot(sourceCode: string, name: string, png: Buffer): Promise<string> {
    return this.write(sourceCode, name, png, 'png');
  }

  writeJson(sourceCode: string, name: string, data: unknown): Promise<string> {
    return this.write(sourceCode, name, JSON.stringify(data, null, 2), 'json');
  }

  /** Delete artifact day-folders older than `days`. Returns folders removed. */
  async prune(days: number): Promise<number> {
    let removed = 0;
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch {
      return 0;
    }
    const cutoff = Date.now() - days * 86_400_000;
    for (const entry of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
      const full = path.join(this.rootDir, entry);
      const info = await stat(full).catch(() => null);
      if (!info?.isDirectory()) continue;
      if (Date.parse(entry) < cutoff) {
        await rm(full, { recursive: true, force: true });
        removed++;
      }
    }
    return removed;
  }
}
