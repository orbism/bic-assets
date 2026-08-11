import "dotenv/config";
import { db } from "../src/lib/db";
import { scanAssets } from "../src/lib/assets";

const r = await scanAssets({ label: "scan script" });

console.log(`assets:    ${r.assets} (${r.created} new)`);
console.log(`links:     ${r.links} new`);
console.log(`missing:   ${r.missing}`);
console.log(`unmatched: ${r.unmatched.length}`);
for (const u of r.unmatched) console.log(`  ${u}`);

await db.$disconnect();
