import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { seedIfEmpty } from "./seed.js";

const db = openDb(config.dbFile);
if (config.seedOnStart) console.log(`Seeded ${seedIfEmpty(db)} resources`);

createApp(db).listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port} (db: ${config.dbFile})`);
});
