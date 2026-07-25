import { useNavigate, useLocation } from "react-router-dom";
import { GitCompare, X } from "lucide-react";
import { useCompare } from "@/hooks/useCompare";
import { useProducts } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";

export function CompareBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const { data: products = [] } = useProducts();

  const compareProducts = products.filter((p) => compareIds.includes(p.id));

  const hiddenPaths = ["/compare", "/gallery", "/support", "/login", "/signup", "/forgot-password", "/reset-password"];

  if (compareIds.length === 0 || hiddenPaths.includes(location.pathname)) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border bg-background shadow-xl lg:bottom-0">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              <span className="font-body text-sm font-medium">
                Compare ({compareIds.length}/3)
              </span>
            </div>

            {/* Product Thumbnails */}
            <div className="hidden items-center gap-2 sm:flex">
              {compareProducts.map((product) => (
                <div
                  key={product.id}
                  className="group relative h-12 w-12 overflow-hidden border border-border"
                >
                  <OptimizedImage
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    priority={false}
                    sizes="48px"
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeFromCompare(product.id)}
                    className="absolute inset-0 flex items-center justify-center bg-foreground/80 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4 text-background" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearCompare}
              className="border border-border px-4 py-2 font-body text-sm transition-colors hover:bg-muted"
            >
              Clear
            </button>
            <button
              onClick={() => navigate("/compare")}
              className={cn(
                "bg-foreground px-6 py-2 font-body text-sm text-background transition-opacity",
                compareIds.length < 2 ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
              )}
              disabled={compareIds.length < 2}
            >
              Compare Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
