"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Sparkles, Wand2, Check, ThumbsDown, Pencil, RefreshCw, Save, FileText, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/layout/ErrorState";
import { useTemplates } from "@/hooks/useTemplates";
import { useProducts } from "@/hooks/useProducts";
import { useGeneratePitch } from "@/hooks/usePitch";
import {
  useGroupPitches,
  useGenerateBatch,
  useUpdatePitch,
  useReviewPitch,
  useRejectPitch,
  useResendPitch,
  useSendGroup,
} from "@/hooks/usePitches";
import { cn } from "@/lib/utils";
import type { Group, MessageStatus, PitchMode, Pitch } from "@/types";

const STATUS_BADGE: Partial<Record<MessageStatus, { label: string; className: string }>> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-700" },
  reviewed: { label: "Reviewed", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-muted text-muted-foreground line-through" },
  queued: { label: "Queued", className: "bg-blue-100 text-blue-700" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  delivered: { label: "Delivered", className: "bg-teal-100 text-teal-700" },
  replied: { label: "Replied", className: "bg-violet-100 text-violet-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: MessageStatus }) {
  const b = STATUS_BADGE[status];
  if (!b) return null;
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", b.className)}>{b.label}</span>;
}

function PitchCard({
  pitch,
  groupId,
  productId,
  instructions,
}: {
  pitch: Pitch;
  groupId: string;
  productId?: string;
  instructions?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pitch.body);
  const update = useUpdatePitch(groupId);
  const review = useReviewPitch(groupId);
  const reject = useRejectPitch(groupId);
  const resend = useResendPitch(groupId);
  const single = useGeneratePitch();
  const regenerating = single.isPending && single.variables?.leadId === pitch.leadId;

  const save = () => {
    const body = draft.trim();
    if (body && body !== pitch.body) update.mutate({ id: pitch.id, body });
    setEditing(false);
  };

  const regenerate = async () => {
    const text = await single.mutateAsync({ leadId: pitch.leadId, productId, instructions });
    update.mutate({ id: pitch.id, body: text });
  };

  const isOpen = pitch.status === "draft" || pitch.status === "reviewed";

  return (
    <Card className={cn(pitch.status === "rejected" && "opacity-60")}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium truncate">{pitch.leadName}</span>
            {pitch.leadPhone && <span className="ml-2 text-xs text-muted-foreground">{pitch.leadPhone}</span>}
          </div>
          <StatusBadge status={pitch.status} />
        </div>

        {editing ? (
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-sm" />
        ) : (
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-2">{pitch.body}</p>
        )}

        {isOpen && (
          <div className="flex flex-wrap items-center gap-1.5">
            {editing ? (
              <>
                <Button size="sm" className="h-7" onClick={save} disabled={update.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" />Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setDraft(pitch.body); setEditing(false); }}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {pitch.status === "draft" && (
                  <Button size="sm" className="h-7" onClick={() => review.mutate(pitch.id)} disabled={review.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />Approve
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                </Button>
                <Button size="sm" variant="outline" className="h-7" onClick={regenerate} disabled={regenerating}>
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Regenerate
                </Button>
                {pitch.status === "draft" && (
                  <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => reject.mutate(pitch.id)} disabled={reject.isPending}>
                    <ThumbsDown className="h-3.5 w-3.5 mr-1" />Reject
                  </Button>
                )}
              </>
            )}
          </div>
        )}
        {pitch.status === "failed" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => resend.mutate(pitch.id)}
              disabled={resend.isPending || !pitch.leadPhone}
            >
              {resend.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
              Resend
            </Button>
            {!pitch.leadPhone && <span className="text-xs text-muted-foreground">No phone number on this lead</span>}
            {resend.isError && <span className="text-xs text-destructive">Couldn&apos;t resend. Try again.</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupPitchDrawer({
  group,
  messageableCount,
  onClose,
}: {
  group: Group;
  messageableCount: number;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PitchMode>("ai");
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [instructions, setInstructions] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: templates } = useTemplates();
  const { data: products } = useProducts();
  const activeProducts = products?.filter((p) => p.active) ?? [];
  const pitchesQ = useGroupPitches(group.id, generating);
  const genBatch = useGenerateBatch(group.id);

  // Stop polling once generation settles (count stable) or after a safety timeout.
  const prevCount = useRef(-1);
  const stableTicks = useRef(0);
  const startedAt = useRef(0);
  useEffect(() => {
    if (!generating) return;
    const count = pitchesQ.data?.length ?? 0;
    stableTicks.current = count > 0 && count === prevCount.current ? stableTicks.current + 1 : 0;
    prevCount.current = count;
    if ((count > 0 && stableTicks.current >= 2) || Date.now() - startedAt.current > 90_000) {
      setGenerating(false);
    }
  }, [pitchesQ.data, generating]);

  const onGenerate = () => {
    if (mode === "template" && !templateId) return;
    prevCount.current = -1;
    stableTicks.current = 0;
    startedAt.current = Date.now();
    setGenerating(true);
    genBatch.mutate(
      {
        mode,
        templateId: mode === "template" ? templateId : undefined,
        productId: mode === "ai" ? productId : undefined,
        instructions: instructions.trim() || undefined,
      },
      // The request now returns only when the whole batch is done.
      { onSettled: () => setGenerating(false) },
    );
  };

  const pitches = pitchesQ.data ?? [];
  const drafts = pitches.filter((p) => p.status === "draft");
  const reviewed = pitches.filter((p) => p.status === "reviewed");
  const failed = pitches.filter((p) => p.status === "failed" && p.leadPhone);
  const resendAll = useResendPitch(group.id);
  const retryFailed = () => failed.forEach((p) => resendAll.mutate(p.id));
  const reviewAll = useReviewPitch(group.id);
  const approveAll = () => drafts.forEach((p) => reviewAll.mutate(p.id));
  const sendGroup = useSendGroup(group.id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <p className="font-medium text-sm">Pitches — {group.name}</p>
            <p className="text-xs text-muted-foreground">
              {messageableCount} messageable · {drafts.length} draft · {reviewed.length} reviewed
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Generate panel */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={cn("flex-1 rounded-md border px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5",
                mode === "ai" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
            >
              <Sparkles className="h-4 w-4" />AI per lead
            </button>
            <button
              type="button"
              onClick={() => setMode("template")}
              className={cn("flex-1 rounded-md border px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5",
                mode === "template" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
            >
              <FileText className="h-4 w-4" />Template merge
            </button>
          </div>

          {mode === "template" ? (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <select
                className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={templateId ?? ""}
                onChange={(e) => setTemplateId(e.target.value || undefined)}
              >
                <option value="">Select a template…</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              {activeProducts.length > 0 && (
                <div className="space-y-1.5">
                  <Label>What are we offering? (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {activeProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProductId(productId === p.id ? undefined : p.id)}
                        className={cn("rounded-md border px-3 py-1.5 text-sm transition-colors",
                          productId === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>One instruction for the whole group (optional)</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Keep it casual, mention a free demo this week."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </>
          )}

          <Button
            className="w-full"
            onClick={onGenerate}
            disabled={generating || genBatch.isPending || (mode === "template" && !templateId) || messageableCount === 0}
          >
            {generating
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating… {pitches.length}/{messageableCount}</>
              : <><Wand2 className="h-4 w-4 mr-1" />Generate {messageableCount} pitches</>}
          </Button>
          {genBatch.isError && <ErrorState message="Failed to start generation." />}
        </div>

        {/* Review list */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
          {(drafts.length > 0 || reviewed.length > 0 || failed.length > 0) && (
            <div className="flex justify-end gap-2">
              {failed.length > 0 && (
                <Button size="sm" variant="outline" className="h-7" onClick={retryFailed} disabled={resendAll.isPending}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Retry {failed.length} failed
                </Button>
              )}
              {drafts.length > 0 && (
                <Button size="sm" variant="outline" className="h-7" onClick={approveAll} disabled={reviewAll.isPending}>
                  <Check className="h-3.5 w-3.5 mr-1" />Approve all drafts ({drafts.length})
                </Button>
              )}
              {reviewed.length > 0 && (
                <Button size="sm" className="h-7" onClick={() => sendGroup.mutate()} disabled={sendGroup.isPending}>
                  {sendGroup.isPending
                    ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    : <Send className="h-3.5 w-3.5 mr-1" />}
                  Send {reviewed.length} reviewed
                </Button>
              )}
            </div>
          )}
          {pitchesQ.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!pitchesQ.isPending && pitches.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pitches yet. Pick a mode above and generate.
            </p>
          )}
          {pitches.map((p) => (
            <PitchCard key={p.id} pitch={p} groupId={group.id} productId={productId} instructions={instructions.trim() || undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
