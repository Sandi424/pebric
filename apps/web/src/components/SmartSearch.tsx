import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { fuzzyMatch } from "@/lib/searchUtils";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";

interface SmartSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartSearch({ isOpen, onClose }: SmartSearchProps) {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();

  const trendingSearches = ["Summer Collection", "Raincoat", "Matching Set", "Dog Sweater"];

  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const filteredProducts = query.trim()
    ? products
        .filter(
          (p) =>
            fuzzyMatch(query, p.name) ||
            fuzzyMatch(query, p.description || "") ||
            fuzzyMatch(query, p.category?.name || "")
        )
        .slice(0, 6)
    : [];

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
    
    navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
    onClose();
    setQuery("");
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="Search products, collections..."
              className="w-full border-b-2 border-foreground bg-transparent py-4 pl-14 pr-4 font-display text-2xl placeholder:text-muted-foreground focus:outline-none md:text-3xl"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Left Column - Suggestions */}
          <div className="space-y-8">
            {/* Recent Searches */}
            {recentSearches.length > 0 && !query && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-body text-sm uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Recent Searches
                  </h3>
                  <button
                    onClick={clearRecentSearches}
                    className="font-body text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search) => (
                    <button
                      key={search}
                      onClick={() => handleSearch(search)}
                      className="rounded-full border border-border px-4 py-2 font-body text-sm transition-colors hover:bg-muted"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {!query && (
              <div>
                <h3 className="mb-4 flex items-center gap-2 font-body text-sm uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Trending
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((search) => (
                    <button
                      key={search}
                      onClick={() => handleSearch(search)}
                      className="rounded-full bg-muted px-4 py-2 font-body text-sm transition-colors hover:bg-muted/80"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Categories */}
            {!query && (
              <div>
                <h3 className="mb-4 font-body text-sm uppercase tracking-wider text-muted-foreground">
                  Browse Categories
                </h3>
                <div className="space-y-2">
                  {["Summer Collection", "Winter Collection", "Rainy Day Collection"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleSearch(cat)}
                      className="flex w-full items-center justify-between border-b border-border py-3 font-body text-lg transition-colors hover:text-primary"
                    >
                      {cat}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Results */}
          <div>
            {query && (
              <div>
                <h3 className="mb-4 font-body text-sm uppercase tracking-wider text-muted-foreground">
                  {filteredProducts.length > 0 ? `${filteredProducts.length} Products Found` : "No Results"}
                </h3>
                <div className="space-y-4">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        navigate(`/product/${product.slug}`);
                        onClose();
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-4 border border-border p-3 text-left transition-colors hover:bg-muted"
                    >
                      <OptimizedImage
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        priority={false}
                        sizes="64px"
                        className="h-16 w-16 object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.category?.name || "Uncategorized"}
                        </p>
                      </div>
                      <p className="font-medium">₹{product.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>

                {filteredProducts.length > 0 && (
                  <button
                    onClick={() => handleSearch(query)}
                    className="mt-4 flex w-full items-center justify-center gap-2 bg-foreground py-3 font-body text-sm text-background transition-opacity hover:opacity-90"
                  >
                    View all results
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
