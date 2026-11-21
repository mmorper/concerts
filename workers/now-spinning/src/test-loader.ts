// Test helper: an in-memory loader over the frozen fixture in test/fixtures/index/.
// Regenerate the fixture (only when the matching rules change) with:
//   npx tsx scripts/build-now-spinning-index.ts --out workers/now-spinning/test/fixtures/index \
//     --only depeche-mode,tears-for-fears,blancmange,echo-and-the-bunnymen,joan-jett-the-blackhearts,brian-setzer,wham,oingo-boingo,devo,the-twilight-sad,run-dmc,billy-idol,x,foals \
//     --covers wham,oingoboingo,davidbowie,queendavidbowie,koolgang,rollingstones,rundmc,depechemode
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Loader } from "./identify.js";

export const FIXTURE_DIR = join(__dirname, "..", "test", "fixtures", "index");

export const fixtureLoader: Loader = async (path) => {
  try {
    return JSON.parse(readFileSync(join(FIXTURE_DIR, path), "utf-8"));
  } catch {
    return null;
  }
};

/** A loader that serves the fixture but alters or withholds chosen files. */
export function alteredLoader(changes: Record<string, (x: any) => any>): Loader {
  return async (path) => {
    const x = await fixtureLoader(path);
    return path in changes ? changes[path](x) : x;
  };
}
