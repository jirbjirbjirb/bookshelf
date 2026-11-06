// Generates lib/lexicon from the lexicon JSON, then adjusts lex-cli's output for this app:
// - index.ts is removed: its client wrapper needs com.atproto.repo schemas we do not vendor, and
//   writes go through @atproto/api's Agent.
// - "./x.js" imports lose the extension, because Turbopack does not resolve them to .ts files.
import { execFileSync } from "node:child_process";
import { globSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = "lib/lexicon";

execFileSync(
  "npx",
  ["lex", "gen-api", "--yes", OUT, ...globSync("lexicons/**/*.json")],
  { stdio: "inherit" },
);

rmSync(`${OUT}/index.ts`);

for (const file of globSync(`${OUT}/**/*.ts`)) {
  const src = readFileSync(file, "utf8");
  writeFileSync(file, src.replace(/from '(\.[^']*)\.js'/g, "from '$1'"));
}
