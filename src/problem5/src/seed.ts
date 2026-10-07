import type { DatabaseSync } from "node:sqlite";
import { ResourceRepository } from "./resources/resource.repository.js";
import type { ResourceInput } from "./resources/resource.types.js";

const SEED: Required<ResourceInput>[] = [
  { name: "Mechanical Keyboard", description: "Hot-swappable 75% keyboard with brown switches", status: "active" },
  { name: "Wireless Mouse", description: "Ergonomic mouse, 2.4GHz and Bluetooth", status: "active" },
  { name: "27in 4K Monitor", description: "IPS panel, USB-C docking", status: "active" },
  { name: "USB-C Hub", description: "7-in-1 hub with HDMI and card reader", status: "active" },
  { name: "Webcam HD", description: "1080p webcam with privacy shutter", status: "inactive" },
  { name: "Laptop Stand", description: "Adjustable aluminium stand", status: "active" },
  { name: "Noise-Cancelling Headphones", description: "Over-ear, 30h battery", status: "active" },
  { name: "Desk Lamp", description: "LED lamp with dimmer", status: "inactive" },
  { name: "Standing Desk Mat", description: "Anti-fatigue mat", status: "active" },
  { name: "Portable SSD 1TB", description: "USB 3.2 external drive", status: "active" },
];

/** Inserts sample data only when the table is empty. Returns the number inserted. */
export function seedIfEmpty(db: DatabaseSync): number {
  const repo = new ResourceRepository(db);
  if (repo.list({ limit: 1, offset: 0 }).total > 0) return 0;
  SEED.forEach((r) => repo.insert(r));
  return SEED.length;
}
