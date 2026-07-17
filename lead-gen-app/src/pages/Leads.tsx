import {
  ExternalLink, Phone, Globe, Sparkles, Copy, Check, Loader2,
  Map as MapIcon, X, Wand2, Pencil, Trash2, Plus, Filter, Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/layout/Spinner";
import { ErrorState } from "@/components/layout/ErrorState";
import { TopBar } from "@/components/layout/TopBar";
import { useLeads } from "@/hooks/useLeads";
import { useGeneratePitch } from "@/hooks/usePitch";
import { useProducts } from "@/hooks/useProducts";
import {
  useGroups,
  useAutoGroup,
  useCreateGroup,
  useRenameGroup,
  useDeleteGroup,
  useMoveLead,
} from "@/hooks/useGroups";
import { GroupPitchDrawer } from "@/components/pitches/GroupPitchDrawer";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Group, GroupKind, Lead } from "@/types";

// ── Filter types ─────────────────────────────────────────────────────────────

type FilterKey = "has_phone" | "has_email" | "has_website" | "no_contact" | "ungrouped";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "has_phone",    label: "Has phone" },
  { key: "has_email",   label: "Has email" },
  { key: "has_website", label: "Has website" },
  { key: "no_contact",  label: "No contact" },
  { key: "ungrouped",   label: "Ungrouped" },
];

function applyFilters(leads: Lead[], filters: Set<FilterKey>): Lead[] {
  if (!filters.size) return leads;
  return leads.filter((l) => {
    if (filters.has("has_phone")    && !l.phone?.trim())                                 return false;
    if (filters.has("has_email")   && !l.email?.trim())                                 return false;
    if (filters.has("has_website") && !l.website?.trim())                               return false;
    if (filters.has("no_contact")  && (l.phone?.trim() || l.email?.trim()))             return false;
    if (filters.has("ungrouped")   && l.groupId !== null)                               return false;
    return true;
  });
}

// ── Constants ────────────────────────────────────────────────────────────────

const isMessageable = (lead: Lead) => !!lead.phone && lead.phone.trim() !== "";

const GROUP_BADGE: Record<GroupKind, { label: string; className: string }> = {
  has_email:  { label: "Email + phone", className: "bg-emerald-100 text-emerald-700" },
  phone_only: { label: "Phone only",    className: "bg-blue-100 text-blue-700" },
  no_contact: { label: "No phone",      className: "bg-muted text-muted-foreground" },
  manual:     { label: "Custom",        className: "bg-violet-100 text-violet-700" },
};

// ── Generate pitch dialog ────────────────────────────────────────────────────

function GeneratePitchDialog({ lead }: { lead: Lead }) {
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [instructions, setInstructions] = useState("");
  const [copied, setCopied] = useState(false);
  const generate = useGeneratePitch();
  const { data: products } = useProducts();
  const activeProducts = products?.filter((p) => p.active) ?? [];

  const onCopy = () => {
    if (!generate.data) return;
    navigator.clipboard.writeText(generate.data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>AI Pitch — {lead.name}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        {activeProducts.length > 0 && (
          <div className="space-y-1.5">
            <Label>What are we offering?</Label>
            <div className="flex flex-wrap gap-2">
              {activeProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(productId === p.id ? undefined : p.id)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    productId === p.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label>Extra instructions (optional)</Label>
          <Textarea
            rows={2}
            placeholder="e.g. Keep it casual, mention a free demo."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={generate.isPending}
          onClick={() => generate.mutate({ leadId: lead.id, productId, instructions: instructions || undefined })}
        >
          {generate.isPending
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating…</>
            : <><Sparkles className="h-4 w-4 mr-1" />{generate.data ? "Regenerate" : "Generate"}</>}
        </Button>
        {generate.isError && <ErrorState message="Failed to generate. Check that the Groq API key is set." />}
        {generate.data && (
          <div className="space-y-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{generate.data}</div>
            <Button variant="outline" size="sm" onClick={onCopy}>
              {copied ? <><Check className="h-3.5 w-3.5 mr-1" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

// ── Map drawer ───────────────────────────────────────────────────────────────

type MapDrawerState = { embedUrl: string; pageUrl: string; title: string };

function MapDrawer({ embedUrl, pageUrl, title, onClose }: MapDrawerState & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl bg-background shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="font-medium text-sm truncate">{title}</span>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />Open in browser
            </a>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe
          src={embedUrl}
          className="flex-1 w-full border-0"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

function buildEmbedUrl(lat: number, lon: number) {
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`;
}
function buildGoogleMapsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps/@${lat},${lon},17z`;
}

// ── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  activeFilters,
  onToggle,
  onClear,
  visibleCount,
  totalCount,
  selectedCount,
  allVisibleSelected,
  onSelectAll,
}: {
  activeFilters: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  onClear: () => void;
  visibleCount: number;
  totalCount: number;
  selectedCount: number;
  allVisibleSelected: boolean;
  onSelectAll: (checked: boolean) => void;
}) {
  const hasFilters = activeFilters.size > 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {FILTER_OPTIONS.map(({ key, label }) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            <X className="h-3 w-3" />Clear
          </button>
        )}
      </div>
      {hasFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleSelected && visibleCount > 0}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
            />
            {allVisibleSelected && visibleCount > 0 ? "Deselect all" : "Select all"}
          </label>
          <span>
            {visibleCount} of {totalCount} shown
            {selectedCount > 0 && ` · ${selectedCount} selected`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  groups,
  onMove,
  onOpenMap,
  selected,
  onSelect,
  groupBadge,
}: {
  lead: Lead;
  groups: Group[];
  onMove: (leadId: string, groupId: string | null) => void;
  onOpenMap: (s: MapDrawerState) => void;
  selected: boolean;
  onSelect: (id: string) => void;
  groupBadge?: { label: string; className: string } | null;
}) {
  const { setSelectedLead, selectedLeadId } = useUIStore();
  const isDetailSelected = selectedLeadId === lead.id;

  return (
    <Card
      className={cn(
        "transition-colors cursor-pointer hover:bg-muted/50",
        selected && "ring-2 ring-primary bg-primary/5",
        !selected && isDetailSelected && "ring-2 ring-primary",
      )}
      onClick={() => setSelectedLead(isDetailSelected ? null : lead.id)}
    >
      <CardContent className="p-4 flex items-center gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(lead.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded accent-primary border-border shrink-0 cursor-pointer"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-medium text-sm truncate">{lead.name}</p>
            {groupBadge && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0", groupBadge.className)}>
                {groupBadge.label}
              </span>
            )}
          </div>
          {lead.address && <p className="text-xs text-muted-foreground truncate">{lead.address}</p>}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lead.phone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />{lead.phone}
            </span>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <Globe className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </a>
          )}
          {lead.lat != null && lead.lon != null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="View on map"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMap({
                  embedUrl: buildEmbedUrl(lead.lat!, lead.lon!),
                  pageUrl: buildGoogleMapsUrl(lead.lat!, lead.lon!),
                  title: lead.name,
                });
              }}
            >
              <MapIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {!lead.phone && !lead.email && (
            <span className="text-xs text-muted-foreground italic">No contact</span>
          )}
          <select
            className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-muted-foreground"
            value={lead.groupId ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onMove(lead.id, e.target.value === "" ? null : e.target.value);
            }}
            title="Move to group"
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                title="Generate AI pitch"
                onClick={(e) => e.stopPropagation()}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <GeneratePitchDialog lead={lead} />
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({
  group,
  count,
  selectedCount,
  allSelected,
  onSelectAll,
  onRename,
  onDelete,
  onOpenPitches,
}: {
  group: Group;
  count: number;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenPitches: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const badge = GROUP_BADGE[group.kind];

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 pt-2">
      {/* Group select-all checkbox */}
      <input
        type="checkbox"
        checked={allSelected && count > 0}
        onChange={(e) => onSelectAll(e.target.checked)}
        className="h-3.5 w-3.5 rounded accent-primary cursor-pointer shrink-0"
        title="Select / deselect all in this group"
      />
      {editing ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setName(group.name); setEditing(false); }
          }}
          className="h-7 w-56 text-sm"
        />
      ) : (
        <h3 className="text-sm font-semibold">{group.name}</h3>
      )}
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badge.className)}>{badge.label}</span>
      <span className="text-xs text-muted-foreground">
        {count}{selectedCount > 0 && ` · ${selectedCount} selected`}
      </span>
      {!editing && (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" title="Rename group" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Delete group" onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
      <Button variant="outline" size="sm" className="h-6 ml-auto" title="Generate & review pitches for this group" onClick={onOpenPitches}>
        <Sparkles className="h-3 w-3 mr-1" />Pitches
      </Button>
    </div>
  );
}

// ── Selection action bar ──────────────────────────────────────────────────────

function SelectionBar({
  selectedIds,
  groups,
  onMove,
  onNewGroup,
  onClear,
}: {
  selectedIds: Set<string>;
  groups: Group[];
  onMove: (groupId: string | null) => void;
  onNewGroup: () => void;
  onClear: () => void;
}) {
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const count = selectedIds.size;

  return (
    <div className="border-t bg-background px-6 py-3 flex items-center gap-3 shrink-0 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-primary" />
        {count} lead{count !== 1 ? "s" : ""} selected
      </div>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        onClick={onNewGroup}
        title="Create a new group from selected leads"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />New group from selection
      </Button>
      <select
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
        value={targetGroupId}
        onChange={(e) => setTargetGroupId(e.target.value)}
      >
        <option value="">Move to group…</option>
        <option value="__none__">Remove from group (ungroup)</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!targetGroupId}
        onClick={() => {
          onMove(targetGroupId === "__none__" ? null : targetGroupId);
          setTargetGroupId("");
        }}
      >
        Apply
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Clear selection" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LeadsPage() {
  const { activeSearchId } = useUIStore();
  const searchId = activeSearchId ?? "";
  const { data: leads, isPending, isError } = useLeads(searchId);
  const { data: groups } = useGroups(searchId);
  const autoGroup = useAutoGroup(searchId);
  const createGroup = useCreateGroup(searchId);
  const renameGroup = useRenameGroup(searchId);
  const deleteGroup = useDeleteGroup(searchId);
  const moveLead = useMoveLead(searchId);
  const [mapDrawer, setMapDrawer] = useState<MapDrawerState | null>(null);
  const [pitchGroup, setPitchGroup] = useState<Group | null>(null);

  // Filter state
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      setSelectedIds(new Set()); // clear selection when filters change
      return next;
    });
  };
  const clearFilters = () => { setActiveFilters(new Set()); setSelectedIds(new Set()); };

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const qc = useQueryClient();
  const bulkMove = useMutation({
    mutationFn: async (groupId: string | null) => {
      await Promise.all([...selectedIds].map((id) => api.leads.moveGroup(id, groupId)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", searchId] });
      qc.invalidateQueries({ queryKey: ["leads", searchId] });
      setSelectedIds(new Set());
    },
  });

  const bulkNewGroup = async () => {
    const name = window.prompt("Name for new group");
    if (!name?.trim()) return;
    const group = await api.groups.create(searchId, name.trim());
    await Promise.all([...selectedIds].map((id) => api.leads.moveGroup(id, group.id)));
    qc.invalidateQueries({ queryKey: ["groups", searchId] });
    qc.invalidateQueries({ queryKey: ["leads", searchId] });
    setSelectedIds(new Set());
  };

  const groupList = groups ?? [];
  const allLeads = leads ?? [];
  const filtersActive = activeFilters.size > 0;

  const filteredLeads = useMemo(
    () => applyFilters(allLeads, activeFilters),
    [allLeads, activeFilters]
  );

  // Group lookup for badges in flat view
  const groupById = useMemo(() => {
    const m = new Map<string, Group>();
    groupList.forEach((g) => m.set(g.id, g));
    return m;
  }, [groupList]);

  // Leads organised into group buckets for grouped view
  const byGroup = useMemo(() => {
    const m = new Map<string | null, Lead[]>();
    for (const lead of allLeads) {
      const key = lead.groupId ?? null;
      const bucket = m.get(key) ?? [];
      bucket.push(lead);
      m.set(key, bucket);
    }
    return m;
  }, [allLeads]);

  const ungrouped = byGroup.get(null) ?? [];

  const move = (leadId: string, groupId: string | null) => moveLead.mutate({ leadId, groupId });

  // Select-all helpers
  const allVisibleSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.has(l.id));
  const selectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredLeads.forEach((l) => (checked ? next.add(l.id) : next.delete(l.id)));
      return next;
    });
  };

  const groupLeadsSelected = (groupId: string) => {
    const gl = byGroup.get(groupId) ?? [];
    return gl.filter((l) => selectedIds.has(l.id)).length;
  };
  const groupAllSelected = (groupId: string) => {
    const gl = byGroup.get(groupId) ?? [];
    return gl.length > 0 && gl.every((l) => selectedIds.has(l.id));
  };
  const selectAllInGroup = (groupId: string, checked: boolean) => {
    const gl = byGroup.get(groupId) ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      gl.forEach((l) => (checked ? next.add(l.id) : next.delete(l.id)));
      return next;
    });
  };

  if (!activeSearchId) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Leads" />
        <div className="flex flex-col items-center justify-center gap-2 flex-1 text-muted-foreground">
          <ExternalLink className="h-10 w-10 opacity-30" />
          <p className="text-sm">Select a search from the Searches page to view its leads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Leads" />

      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {isPending && <Spinner />}
        {isError && <ErrorState message="Failed to load leads." />}

        {!isPending && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {allLeads.length} leads · {groupList.length} groups
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={autoGroup.isPending || allLeads.length === 0}
                  onClick={() => autoGroup.mutate()}
                  title="Sort ungrouped leads into contact-channel buckets"
                >
                  {autoGroup.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Grouping…</>
                    : <><Wand2 className="h-3.5 w-3.5 mr-1" />Auto-group</>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={createGroup.isPending}
                  onClick={() => {
                    const name = window.prompt("New group name");
                    if (name?.trim()) createGroup.mutate(name.trim());
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />New group
                </Button>
              </div>
            </div>

            {/* Filter bar */}
            <FilterBar
              activeFilters={activeFilters}
              onToggle={toggleFilter}
              onClear={clearFilters}
              visibleCount={filteredLeads.length}
              totalCount={allLeads.length}
              selectedCount={selectedIds.size}
              allVisibleSelected={allVisibleSelected}
              onSelectAll={selectAllVisible}
            />
          </>
        )}

        {!isPending && allLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <p className="text-sm">No leads found for this search yet.</p>
          </div>
        )}

        {/* ── Flat filtered view ────────────────────────────────────────── */}
        {!isPending && filtersActive && (
          <>
            {filteredLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">
                No leads match the active filters.
              </p>
            ) : (
              filteredLeads.map((lead) => {
                const group = lead.groupId ? groupById.get(lead.groupId) : null;
                const badge = group ? GROUP_BADGE[group.kind] : null;
                return (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    groups={groupList}
                    onMove={move}
                    onOpenMap={setMapDrawer}
                    selected={selectedIds.has(lead.id)}
                    onSelect={toggleSelect}
                    groupBadge={badge ? { label: group!.name, className: badge.className } : null}
                  />
                );
              })
            )}
          </>
        )}

        {/* ── Grouped view ─────────────────────────────────────────────── */}
        {!isPending && !filtersActive && (
          <>
            {groupList.map((group) => {
              const groupLeads = byGroup.get(group.id) ?? [];
              return (
                <div key={group.id} className="space-y-2">
                  <GroupHeader
                    group={group}
                    count={groupLeads.length}
                    selectedCount={groupLeadsSelected(group.id)}
                    allSelected={groupAllSelected(group.id)}
                    onSelectAll={(checked) => selectAllInGroup(group.id, checked)}
                    onRename={(name) => renameGroup.mutate({ id: group.id, name })}
                    onDelete={() => deleteGroup.mutate(group.id)}
                    onOpenPitches={() => setPitchGroup(group)}
                  />
                  {groupLeads.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-1">No leads in this group.</p>
                  ) : (
                    groupLeads.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        groups={groupList}
                        onMove={move}
                        onOpenMap={setMapDrawer}
                        selected={selectedIds.has(lead.id)}
                        onSelect={toggleSelect}
                        groupBadge={null}
                      />
                    ))
                  )}
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={ungrouped.every((l) => selectedIds.has(l.id))}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        ungrouped.forEach((l) => (e.target.checked ? next.add(l.id) : next.delete(l.id)));
                        return next;
                      });
                    }}
                    className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                    title="Select / deselect all ungrouped"
                  />
                  <h3 className="text-sm font-semibold text-muted-foreground">Ungrouped</h3>
                  <span className="text-xs text-muted-foreground">{ungrouped.length}</span>
                </div>
                {ungrouped.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    groups={groupList}
                    onMove={move}
                    onOpenMap={setMapDrawer}
                    selected={selectedIds.has(lead.id)}
                    onSelect={toggleSelect}
                    groupBadge={null}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Selection action bar ─────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <SelectionBar
          selectedIds={selectedIds}
          groups={groupList}
          onMove={(groupId) => bulkMove.mutate(groupId)}
          onNewGroup={bulkNewGroup}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {mapDrawer && (
        <MapDrawer {...mapDrawer} onClose={() => setMapDrawer(null)} />
      )}

      {pitchGroup && (
        <GroupPitchDrawer
          group={pitchGroup}
          messageableCount={(byGroup.get(pitchGroup.id) ?? []).filter(isMessageable).length}
          onClose={() => setPitchGroup(null)}
        />
      )}
    </div>
  );
}
