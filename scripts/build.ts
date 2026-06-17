import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from '../src/utils.js';
import { runPipeline } from '../src/pipeline.js';
import { defaultSources } from '../src/registry.js';

const ROOT      = process.cwd();
const LISTS_DIR = join(ROOT, 'lists');

async function main(): Promise<void> {
  log('Building 1list token lists...\n');

  await mkdir(LISTS_DIR, { recursive: true });

  const { chains, unified } = await runPipeline(defaultSources, { root: ROOT });

  const writes: Promise<void>[] = [];

  for (const [slug, list] of Object.entries(chains)) {
    writes.push(writeFile(join(LISTS_DIR, `${slug}.tokenlist.json`), JSON.stringify(list, null, 2)));
  }

  writes.push(writeFile(join(LISTS_DIR, 'all.tokenlist.json'), JSON.stringify(unified, null, 2)));

  await Promise.all(writes);

  log('\n✓ Lists written to lists/');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
