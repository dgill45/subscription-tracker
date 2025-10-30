// web/src/server/storage.ts
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Subscription, SubscriptionInput, SubStatus } from "@/lib/types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "subscriptions.json");
const DEMO_USER = "demo-user"; // TODO: replace with Cognito subject

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    const seed = { subscriptions: [] as Subscription[] };
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readAll(): Promise<{ subscriptions: Subscription[] }> {
  await ensureFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  try {
    const data = JSON.parse(raw);
    // guard against malformed file
    if (!data || !Array.isArray(data.subscriptions)) {
      return { subscriptions: [] };
    }
    return { subscriptions: data.subscriptions as Subscription[] };
  } catch {
    // if corrupted, reset to empty
    return { subscriptions: [] };
  }
}

async function writeAll(data: { subscriptions: Subscription[] }) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

/** LIST */
export async function listSubscriptions(userId = DEMO_USER): Promise<Subscription[]> {
  const db = await readAll();
  return db.subscriptions
    .filter((s) => s.userId === userId)
    .sort((a, b) => a.merchant.localeCompare(b.merchant));
}

/** CREATE */
export async function createSubscription(input: SubscriptionInput, userId = DEMO_USER): Promise<Subscription> {
  const now = new Date().toISOString();
  const sub: Subscription = {
    id: randomUUID(),
    userId,
    merchant: input.merchant.trim(),
    amount: Number(input.amount),
    period: input.period,
    nextBillDate: input.nextBillDate,
    notes: input.notes?.trim() || undefined,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const db = await readAll();
  db.subscriptions.push(sub);
  await writeAll(db);
  return sub;
}

/** READ by id */
export async function getSubscriptionById(id: string, userId = DEMO_USER): Promise<Subscription | null> {
  const db = await readAll();
  return db.subscriptions.find((s) => s.userId === userId && s.id === id) ?? null;
}

/** UPDATE (partial) */
export async function updateSubscription(
  id: string,
  patch: Partial<SubscriptionInput>,
  userId = DEMO_USER
): Promise<Subscription | null> {
  const db = await readAll();
  const idx = db.subscriptions.findIndex((s) => s.userId === userId && s.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const current = db.subscriptions[idx];
  const updated: Subscription = {
    ...current,
    merchant: patch.merchant ?? current.merchant,
    amount: patch.amount ?? current.amount,
    period: patch.period ?? current.period,
    nextBillDate: patch.nextBillDate ?? current.nextBillDate,
    notes: patch.notes === undefined ? current.notes : patch.notes,
    updatedAt: now,
  };

  db.subscriptions[idx] = updated;
  await writeAll(db);
  return updated;
}

/** DELETE */
export async function deleteSubscription(id: string, userId = DEMO_USER): Promise<boolean> {
  const db = await readAll();
  const before = db.subscriptions.length;
  db.subscriptions = db.subscriptions.filter((s) => !(s.userId === userId && s.id === id));
  const changed = db.subscriptions.length !== before;
  if (changed) await writeAll(db);
  return changed;
}

/** STATUS change (active/canceled) */
export async function setSubscriptionStatus(
  id: string,
  status: SubStatus,
  userId = DEMO_USER
): Promise<Subscription | null> {
  const db = await readAll();
  const idx = db.subscriptions.findIndex((s) => s.userId === userId && s.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  db.subscriptions[idx] = { ...db.subscriptions[idx], status, updatedAt: now };
  await writeAll(db);
  return db.subscriptions[idx];
}
