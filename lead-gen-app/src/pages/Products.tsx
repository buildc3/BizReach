import { Loader2, Package, Plus, Sparkles, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/layout/Spinner";
import { ErrorState } from "@/components/layout/ErrorState";
import { TopBar } from "@/components/layout/TopBar";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useAiFillProduct } from "@/hooks/useProducts";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const CATEGORIES = [
  { value: "website", label: "Website" },
  { value: "menu", label: "Menu Card" },
  { value: "other", label: "Other" },
] as const;

function ProductForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<ProductInput>;
  onSubmit: (data: ProductInput) => void;
  isPending: boolean;
}) {
  const [rawDesc, setRawDesc] = useState("");
  const aiFill = useAiFillProduct();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProductInput>({
    // z.coerce.number() widens the schema's input type, so cast the resolver to the output type.
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: { category: "other", ...defaultValues },
  });

  const selectedCategory = watch("category");

  const handleAiFill = async () => {
    if (!rawDesc.trim()) return;
    const result = await aiFill.mutateAsync(rawDesc);
    setValue("name", result.name, { shouldValidate: true });
    setValue("description", result.description, { shouldValidate: true });
    const cat = result.category as ProductInput["category"];
    setValue("category", cat, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Describe your product (for AI)</Label>
        <div className="flex gap-2">
          <Textarea
            rows={2}
            placeholder="e.g. I build websites for local restaurants and shops"
            value={rawDesc}
            onChange={(e) => setRawDesc(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-end shrink-0"
            disabled={!rawDesc.trim() || aiFill.isPending}
            onClick={handleAiFill}
          >
            {aiFill.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Sparkles className="h-4 w-4 mr-1" />AI Fill</>}
          </Button>
        </div>
        {aiFill.isError && <p className="text-xs text-destructive">AI fill failed. Try again.</p>}
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="space-y-1">
          <Label>Product name</Label>
          <Input {...register("name")} placeholder="e.g. Restaurant Website" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea rows={2} {...register("description")} placeholder="One sentence describing what you offer." />
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setValue("category", c.value, { shouldValidate: true })}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  selectedCategory === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Price (optional)</Label>
          <Input type="number" min={0} step={0.01} {...register("price")} placeholder="e.g. 15000" />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Save Product
      </Button>
    </form>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();

  return (
    <Card className={cn(!product.active && "opacity-50")}>
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{product.name}</p>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              product.category === "website" ? "bg-blue-100 text-blue-800" :
              product.category === "menu" ? "bg-orange-100 text-orange-800" :
              "bg-gray-100 text-gray-800"
            )}>
              {CATEGORIES.find(c => c.value === product.category)?.label ?? product.category}
            </span>
            {!product.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
          </div>
          {product.description && <p className="text-xs text-muted-foreground mt-0.5">{product.description}</p>}
          {product.price != null && <p className="text-xs text-muted-foreground mt-0.5">₹{product.price.toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
              <ProductForm
                defaultValues={{
                  name: product.name,
                  description: product.description ?? undefined,
                  price: product.price ?? undefined,
                  category: product.category as ProductInput["category"],
                }}
                isPending={updateProduct.isPending}
                onSubmit={(data) =>
                  updateProduct.mutate(
                    { id: product.id, data: { ...data, active: product.active } },
                    { onSuccess: () => setEditOpen(false) }
                  )
                }
              />
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            disabled={deleteProduct.isPending}
            onClick={() => deleteProduct.mutate(product.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: products, isPending, isError } = useProducts();
  const createProduct = useCreateProduct();

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Products"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
              <ProductForm
                isPending={createProduct.isPending}
                onSubmit={(data) =>
                  createProduct.mutate(data, { onSuccess: () => setCreateOpen(false) })
                }
              />
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {isPending && <Spinner />}
        {isError && <ErrorState message="Failed to load products." />}
        {products?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-sm">No products yet. Add one to get started.</p>
          </div>
        )}
        {products?.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
