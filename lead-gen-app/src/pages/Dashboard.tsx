import { BarChart3, Mail, Search, TrendingUp } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/layout/Spinner";
import { useSearches } from "@/hooks/useSearches";
import { useMessages, useFollowups } from "@/hooks/useMessages";
import { TopBar } from "@/components/layout/TopBar";

function StatCard({ label, value, icon: Icon, gradient }: { label: string; value: number; icon: React.ElementType; gradient: string }) {
  return (
    <Card className={`${gradient} border-0 shadow-lg`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-xl bg-white/25 flex items-center justify-center">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data: searches, isPending: loadingSearches } = useSearches();
  const { data: messages, isPending: loadingMessages } = useMessages();
  const { data: followups } = useFollowups();

  const totalLeads = searches?.reduce((acc, _) => acc, 0) ?? 0;
  const sentMessages = messages?.filter((m) => m.status !== "queued").length ?? 0;
  const repliedMessages = messages?.filter((m) => m.status === "replied").length ?? 0;
  const replyRate = sentMessages > 0 ? Math.round((repliedMessages / sentMessages) * 100) : 0;

  if (loadingSearches || loadingMessages) return <><TopBar title="Dashboard" /><Spinner /></>;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Searches Run" value={searches?.length ?? 0} icon={Search} gradient="bg-gradient-to-br from-blue-500 to-blue-600" />
          <StatCard label="Leads Gathered" value={totalLeads} icon={BarChart3} gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" />
          <StatCard label="Messages Sent" value={sentMessages} icon={Mail} gradient="bg-gradient-to-br from-amber-500 to-amber-600" />
          <StatCard label="Reply Rate" value={replyRate} icon={TrendingUp} gradient="bg-gradient-to-br from-rose-500 to-rose-600" />
        </div>

        {/* Follow-ups alert */}
        {(followups?.length ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 font-medium">
                {followups!.length} message{followups!.length > 1 ? "s" : ""} need follow-up — check the Messages page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Weekly messages chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={messages?.slice(-7).map((_, i) => ({ day: `Day ${i + 1}`, count: 1 })) ?? []}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
