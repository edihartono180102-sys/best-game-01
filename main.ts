// NOVA DRIFT — entrypoint for make.fun's best-game-01.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the kit's
// vendored library (vendor/makefun-game.ts, unchanged).
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts   (local run; the grader uses /output)

import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function copyTree(src: string, dst: string): void {
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dst, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else if (st.isFile()) {
      cpSync(from, to);
    }
    // Anything else (symlink, socket, ...) is left out on purpose:
    // the scorer refuses non-plain entries in game/.
  }
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir)) throw new Error(`no game/ directory in ${repoRoot}`);
  if (!existsSync(shotsDir)) throw new Error(`no screenshots/ directory in ${repoRoot}`);

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  copyTree(gameDir, join(outputDir, 'game'));
  copyTree(shotsDir, join(outputDir, 'screenshots'));

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`wrote ${outputDir}/dossier.json (${dossier.length} bytes)`);
}

main();
