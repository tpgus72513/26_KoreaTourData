import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Node.js 24 local collection utility. It reuses the tested production adapters.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = new URL('../src/', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

let stage = 'configuration';
try {
  const envPath = resolve(repoRoot, '.env.local');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const key = process.env.TOUR_API_SERVICE_KEY?.trim();
  if (!key) throw new Error('missing key');
  const defaultDate = new Date();
  defaultDate.setUTCDate(defaultDate.getUTCDate() - 30);
  const date = process.argv.find((arg) => arg.startsWith('--date='))?.slice(7) ?? defaultDate.toISOString().slice(0, 10).replaceAll('-', '');
  stage = 'module loading';
  const { capturePublicTourismData, readPublicTourismCapture } = await import('../src/lib/tourism/capture.ts');
  // Accept either portal key representation and encode it once inside the HTTP adapter.
  const decodedKey = key.includes('%') ? decodeURIComponent(key) : key;
  stage = 'API collection';
  const capture = await capturePublicTourismData({ serviceKey: decodedKey, date });
  stage = 'publication validation';
  if (!readPublicTourismCapture(capture)) throw new Error('invalid publication');
  const output = JSON.stringify(capture, null, 2) + '\n';
  if (output.includes(key) || output.includes(decodedKey)) throw new Error('credential in output');
  const target = resolve(repoRoot, 'src/data/tourism-publication.json');
  const temporary = `${target}.tmp`;
  stage = 'publication write';
  writeFileSync(temporary, output, 'utf8');
  renameSync(temporary, target);
  console.log(JSON.stringify({ status: 'published', collectedAt: capture.collectedAt, sourceDate: capture.sourceDate, placeCount: capture.snapshot.places.length, visitorRecordCount: capture.visitorRecordCount }));
} catch (error) {
  const code = typeof error?.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'unavailable';
  console.error(`Tourism collection failed at ${stage} (code: ${code}). Check the local key approval, source date and connectivity. The last public capture was preserved. No credential or response URL was logged.`);
  process.exitCode = 1;
}
