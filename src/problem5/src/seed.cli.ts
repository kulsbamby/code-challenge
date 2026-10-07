import { config } from "./config.js";
import { openDb } from "./db.js";
import { seedIfEmpty } from "./seed.js";

const n = seedIfEmpty(openDb(config.dbFile));
console.log(n ? `Seeded ${n} resources` : "Table not empty, skipped seeding");
