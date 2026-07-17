"use client";

import { Loader2, Play, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/layout/Spinner";
import { ErrorState } from "@/components/layout/ErrorState";
import { TopBar } from "@/components/layout/TopBar";
import { useSearches, useCreateSearch, useDeleteSearch, useRunSearch } from "@/hooks/useSearches";
import { useUIStore } from "@/stores/useUIStore";
import { newSearchSchema, type NewSearchInput } from "@/lib/form-schemas";
import { cn, formatRelative } from "@/lib/utils";
import type { Search as SearchType } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800 animate-pulse",
  done: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

function SearchCard({ search }: { search: SearchType }) {
  const { setActiveSearch, activeSearchId } = useUIStore();
  const router = useRouter();
  const deleteSearch = useDeleteSearch();
  const runSearch = useRunSearch();
  const isActive = activeSearchId === search.id;
  const isRunning = search.status === "running" || runSearch.isPending;

  const openLeads = () => {
    setActiveSearch(search.id);
    router.push("/leads");
  };

  return (
    <Card
      className={cn("transition-colors cursor-pointer hover:bg-muted/50", isActive && "ring-2 ring-primary")}
      onClick={openLeads}
      role="button"
      title="View leads for this search"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{search.name}</CardTitle>
            <CardDescription>{search.bizType} · {search.area}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-sm text-xs font-medium", STATUS_COLORS[search.status])}>
              {search.status}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              disabled={isRunning}
              title="Scrape leads"
              onClick={(e) => { e.stopPropagation(); runSearch.mutate(search.id); }}
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); deleteSearch.mutate(search.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{formatRelative(search.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

function NewSearchDialog() {
  const [open, setOpen] = useState(false);
  const createSearch = useCreateSearch();
  const form = useForm<NewSearchInput>({ resolver: zodResolver(newSearchSchema) });

  const onSubmit = form.handleSubmit((data) => {
    createSearch.mutate(data, { onSuccess: () => { setOpen(false); form.reset(); } });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Search</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Search</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input placeholder="Cafés in Pune" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Business Type</Label>
            <Input placeholder="cafe, restaurant, salon…" {...form.register("bizType")} />
            {form.formState.errors.bizType && <p className="text-xs text-destructive">{form.formState.errors.bizType.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Area</Label>
            <Input placeholder="Pune, Mumbai, Koregaon Park…" {...form.register("area")} />
            {form.formState.errors.area && <p className="text-xs text-destructive">{form.formState.errors.area.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={createSearch.isPending}>
            {createSearch.isPending ? "Creating…" : "Create Search"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SearchesPage() {
  const { data: searches, isPending, isError } = useSearches();

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Searches" />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{searches?.length ?? 0} searches</p>
          <NewSearchDialog />
        </div>
        {isPending && <Spinner />}
        {isError && <ErrorState message="Failed to load searches." />}
        {searches?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Search className="h-10 w-10 opacity-40" />
            <p className="text-sm">No searches yet — create one to get started.</p>
            <NewSearchDialog />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {searches?.map((s) => <SearchCard key={s.id} search={s} />)}
        </div>
      </div>
    </div>
  );
}
