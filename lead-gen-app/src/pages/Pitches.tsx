import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/layout/Spinner";
import { ErrorState } from "@/components/layout/ErrorState";
import { TopBar } from "@/components/layout/TopBar";
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useAiGenerateTemplate } from "@/hooks/useTemplates";
import { useProducts } from "@/hooks/useProducts";
import { templateSchema, type TemplateInput } from "@/lib/schemas";
import { cn, formatRelative } from "@/lib/utils";
import type { Template } from "@/types";

const PLACEHOLDERS = ["{business_name}", "{owner_name}", "{area}", "{phone}", "{website}"];

function TemplateDialog({ template, onClose }: { template?: Template; onClose: () => void }) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const aiGenerate = useAiGenerateTemplate();
  const { data: products } = useProducts();
  const activeProducts = products?.filter((p) => p.active) ?? [];
  const [aiPrompt, setAiPrompt] = useState("");
  const isPending = create.isPending || update.isPending;

  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateSchema),
    defaultValues: template
      ? { name: template.name, body: template.body, productId: template.productId ?? "" }
      : { name: "", body: "", productId: "" },
  });

  const productId = form.watch("productId");

  const onSubmit = form.handleSubmit((data) => {
    if (template) {
      update.mutate({ id: template.id, data }, { onSuccess: onClose });
    } else {
      create.mutate(data, { onSuccess: onClose });
    }
  });

  const insertPlaceholder = (ph: string) => {
    const current = form.getValues("body") ?? "";
    form.setValue("body", current + ph);
  };

  const onAiGenerate = async () => {
    if (!productId || !aiPrompt.trim()) return;
    const body = await aiGenerate.mutateAsync({ productId, description: aiPrompt.trim() });
    form.setValue("body", body, { shouldValidate: true });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Product</Label>
          {activeProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active products. Add one on the Products page first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => form.setValue("productId", p.id, { shouldValidate: true })}
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
          )}
          {form.formState.errors.productId && <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>}
        </div>

        <div className="space-y-1.5 rounded-md border border-dashed p-3">
          <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate with AI</Label>
          <p className="text-xs text-muted-foreground">Describe the message you want. The selected product's details are added automatically.</p>
          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="e.g. Friendly intro offering a free demo, keep it short"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end shrink-0"
              disabled={!productId || !aiPrompt.trim() || aiGenerate.isPending}
              onClick={onAiGenerate}
            >
              {aiGenerate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
          {aiGenerate.isError && <p className="text-xs text-destructive">Generation failed. Try again.</p>}
        </div>

        <div className="space-y-1">
          <Label>Name</Label>
          <Input placeholder="Cold outreach — cafés" {...form.register("name")} />
          {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Body</Label>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((ph) => (
              <button key={ph} type="button" onClick={() => insertPlaceholder(ph)}
                className="text-xs px-2 py-0.5 rounded-sm bg-muted text-muted-foreground hover:bg-accent cursor-pointer">
                {ph}
              </button>
            ))}
          </div>
          <Textarea rows={6} placeholder="Hi {owner_name}, I noticed {business_name}…" {...form.register("body")} />
          {form.formState.errors.body && <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Saving…" : template ? "Save Changes" : "Create Template"}
        </Button>
      </form>
    </DialogContent>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteTemplate = useDeleteTemplate();
  const { data: products } = useProducts();
  const productName = products?.find((p) => p.id === template.productId)?.name;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{template.name}</CardTitle>
            {productName && (
              <span className="text-xs text-muted-foreground">for {productName}</span>
            )}
          </div>
          <div className="flex gap-1">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
              </DialogTrigger>
              <TemplateDialog template={template} onClose={() => setEditOpen(false)} />
            </Dialog>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
              onClick={() => deleteTemplate.mutate(template.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground line-clamp-3">{template.body}</p>
        <p className="text-xs text-muted-foreground">{formatRelative(template.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

export function PitchesPage() {
  const { data: templates, isPending, isError } = useTemplates();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Pitch Templates" />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{templates?.length ?? 0} templates</p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Template</Button>
            </DialogTrigger>
            <TemplateDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        </div>
        {isPending && <Spinner />}
        {isError && <ErrorState message="Failed to load templates." />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates?.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      </div>
    </div>
  );
}
