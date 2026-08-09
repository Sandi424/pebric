import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OptimizedImage } from "@/components/ui/optimized-image";

export function AddSubscriptionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: products = [], isLoading } = useProducts();
  const navigate = useNavigate();

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Add Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Product to Subscribe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">No products found</div>
            ) : (
              filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border"
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/product/${product.slug}?subscribe=true`);
                  }}
                >
                  <OptimizedImage
                    src={product.image_url || "/product-1.jpg"}
                    alt={product.name}
                    wrapperClassName="h-12 w-12 rounded overflow-hidden flex-shrink-0"
                    className="object-cover"
                    sizes="48px"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">₹{product.price}</p>
                  </div>
                  <Button size="sm" variant="secondary">Select</Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
