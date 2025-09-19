import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { Subscription, SubscriptionInput } from "@/lib/types";


const DATA_DIR = path.join(process.cwd(), "web", ".data");
const DB_PATH = path.join(DATA_DIR, "subscriptions.json");


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
return JSON.parse(raw);
}


async function writeAll(data: { subscriptions: Subscription[] }) {
await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}


const DEMO_USER = "demo-user"; // TODO(#issue-1): replace with Cognito subject


export async function listSubscriptions(userId = DEMO_USER): Promise<Subscription[]> {
const db = await readAll();
return db.subscriptions.filter((s) => s.userId === userId).sort((a, b) => a.merchant.localeCompare(b.merchant));
}


export async function createSubscription(input: SubscriptionInput, userId = DEMO_USER): Promise<Subscription> {
const now = new Date().toISOString();
const sub: Subscription = {
id: crypto.randomUUID(),
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