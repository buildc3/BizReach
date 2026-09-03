"use client";

import { Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/layout/Spinner";
import { ErrorState } from "@/components/layout/ErrorState";
import { TopBar } from "@/components/layout/TopBar";
import { useMessages, useFollowups } from "@/hooks/useMessages";
import { cn, formatDate } from "@/lib/utils";
import type { MessageStatus } from "@/types";

const STATUS_COLORS: Record<MessageStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  reviewed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-gray-100 text-gray-500 line-through",
  queued: "bg-yellow-100 text-yellow-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-indigo-100 text-indigo-800",
  replied: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function MessagesPage() {
  const { data: messages, isPending, isError } = useMessages();
  const { data: followups } = useFollowups();

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Messages" />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Follow-ups */}
        {(followups?.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Follow-ups Due ({followups!.length})
            </h2>
            {followups!.map((m) => (
              <Card key={m.id} className="border-amber-200 bg-amber-50">
                <CardContent className="p-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-amber-900 line-clamp-1">{m.body}</p>
                  <span className={cn("px-2 py-0.5 rounded-sm text-xs font-medium flex-shrink-0", STATUS_COLORS[m.status])}>
                    {m.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {/* All messages */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">All Messages</h2>
          {isPending && <Spinner />}
          {isError && <ErrorState message="Failed to load messages." />}
          {messages?.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Mail className="h-10 w-10 opacity-30" />
              <p className="text-sm">No messages sent yet.</p>
            </div>
          )}
          {messages?.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{m.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {m.sentAt ? formatDate(m.sentAt) : formatDate(m.createdAt)}
                  </p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-sm text-xs font-medium flex-shrink-0", STATUS_COLORS[m.status])}>
                  {m.status}
                </span>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
