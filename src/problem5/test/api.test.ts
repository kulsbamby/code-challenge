import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

test("CRUD flow", async () => {
  const server = createApp(openDb(":memory:")).listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const call = (path: string, method = "GET", body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    let r = await call("/resources", "POST", { name: "Widget", description: "blue thing" });
    assert.equal(r.status, 201);
    const created = (await r.json()) as { id: number; status: string };
    assert.equal(created.status, "active");

    assert.equal((await call("/resources", "POST", {})).status, 400);
    await call("/resources", "POST", { name: "Gadget", status: "inactive" });

    let list = (await (await call("/resources?status=inactive")).json()) as { total: number };
    assert.equal(list.total, 1);
    list = (await (await call("/resources?q=blue")).json()) as { total: number };
    assert.equal(list.total, 1);

    r = await call(`/resources/${created.id}`);
    assert.equal(((await r.json()) as { name: string }).name, "Widget");

    r = await call(`/resources/${created.id}`, "PATCH", { status: "inactive" });
    assert.equal(((await r.json()) as { status: string }).status, "inactive");

    assert.equal((await call(`/resources/${created.id}`, "DELETE")).status, 204);
    assert.equal((await call(`/resources/${created.id}`)).status, 404);
    assert.equal((await call("/resources/abc")).status, 400);
  } finally {
    server.close();
  }
});

test("seed only fills an empty table", async () => {
  const { seedIfEmpty } = await import("../src/seed.js");
  const db = openDb(":memory:");
  assert.equal(seedIfEmpty(db), 10);
  assert.equal(seedIfEmpty(db), 0);
});
