/**
 * Rate-limited WhatsApp send queue.
 *
 * A single in-process worker drains queued message IDs one at a time,
 * sleeping a jittered 20-40s between sends so traffic looks human and the
 * WhatsApp number is not flagged. All bulk sends go through here — never
 * loop-and-send directly.
 *
 * The queue array + running flag live on `globalThis` so Next.js dev-mode
 * hot-reloads reuse the same worker instead of spawning a duplicate one.
 */
import { prisma } from "@/lib/db";
import * as messagesRepo from "@/lib/repo/messages";
import * as leadsRepo from "@/lib/repo/leads";
import * as whatsapp from "@/lib/services/whatsapp";

interface QueueState {
  queue: string[];
  running: boolean;
  started: boolean;
}

const globalForQueue = globalThis as unknown as { sendQueue?: QueueState };

const state: QueueState = globalForQueue.sendQueue ?? { queue: [], running: false, started: false };
if (process.env.NODE_ENV !== "production") {
  globalForQueue.sendQueue = state;
}

/** A jittered delay in 20_000..=40_000 ms. */
function jitterMs(): number {
  return 20_000 + Math.floor(Math.random() * 20_001);
}

/**
 * Returns true if a send was attempted (so the worker should pace),
 * false if the job was skipped without contacting WhatsApp.
 */
async function processOne(messageId: string): Promise<boolean> {
  const msg = await messagesRepo.getMessageInternal(messageId).catch(() => null);
  if (!msg || msg.status !== "queued") return false; // already handled or cancelled

  const lead = await leadsRepo.getLeadInternal(msg.leadId).catch(() => null);
  const phone = lead?.phone?.trim();
  if (!phone) {
    await messagesRepo.updateMessageStatusInternal(messageId, "failed");
    return false;
  }

  try {
    await whatsapp.sendMessage(phone, msg.body);
    await messagesRepo.updateMessageStatusInternal(messageId, "sent");
    return true;
  } catch (e) {
    await messagesRepo.updateMessageStatusInternal(messageId, "failed");
    console.warn(`send queue: message ${messageId} failed:`, e);
    return true; // still attempted a send — pace the next one
  }
}

async function drain(): Promise<void> {
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.length > 0) {
      const messageId = state.queue.shift()!;
      const attempted = await processOne(messageId);
      if (attempted) {
        await new Promise((r) => setTimeout(r, jitterMs()));
      }
    }
  } finally {
    state.running = false;
  }
}

/** Hand a queued message to the worker. */
export function enqueue(messageId: string): void {
  state.queue.push(messageId);
  void drain();
}

/**
 * Re-enqueue any messages left in `queued` status from a previous server
 * run (crash/restart) so they aren't silently stranded. Call once on boot.
 */
export async function resumeOnBoot(): Promise<void> {
  if (state.started) return;
  state.started = true;
  const stranded = await prisma.message.findMany({ where: { status: "queued" }, select: { id: true } });
  for (const { id } of stranded) enqueue(id);
}
