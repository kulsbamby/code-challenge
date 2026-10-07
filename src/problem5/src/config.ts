export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbFile: process.env.DB_FILE ?? "data/app.db",
  seedOnStart: process.env.SEED_ON_START === "true",
};
