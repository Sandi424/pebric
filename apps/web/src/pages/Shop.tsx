import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts, useCategories } from "@/hooks/useProducts";
import { SlidersHorizontal, X, Search, ChevronDown, ArrowUpDown, ListFilter } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { SEOHead } from "@/components/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function ProductCardSkeleton() {
  return (
    <div className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted rounded-2xl">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="mt-3 space-y-1.5 px-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export default function Shop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCollection, setSelectedCollection] = useState<string>(
    searchParams.get("collection") || "all"
  );
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "featured"
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("search") || ""
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedPetSize, setSelectedPetSize] = useState<string>("all");
  const [selectedOwnerSize, setSelectedOwnerSize] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();

  // Calculate price bounds
  const priceBounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 500 };
    const prices = products.map(p => p.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  const petSizes = ["XS", "S", "M", "L"];
  const ownerSizes = ["XS", "S", "M", "L"];

  // Sync URL params with state
  useEffect(() => {
    const collection = searchParams.get("collection");
    const sort = searchParams.get("sort");
    const search = searchParams.get("search");

    if (collection) {
      const lowercaseCol = collection.toLowerCase();
      if (lowercaseCol === "twinning" || lowercaseCol === "pebric") {
        navigate("/twinning", { replace: true });
        return;
      }
      setSelectedCollection(collection);
    } else {
      setSelectedCollection("all");
    }
    if (sort) setSortBy(sort);
    if (search !== null) setSearchQuery(search);
  }, [searchParams, navigate]);

  // Update price range when products load
  useEffect(() => {
    if (products.length > 0 && priceRange[0] === 0 && priceRange[1] === 500) {
      setPriceRange([priceBounds.min, priceBounds.max]);
    }
  }, [priceBounds, products.length, priceRange]);

  const filteredProducts = products.filter((p) => {
    // Map common frontend route slugs to actual database slugs
    const slugAliasMap: Record<string, string> = {
      "summer": "summer-vibes",
      "winter": "cozy-winter",
      "rainy": "rainy-days"
    };
    const actualSelectedCollection = slugAliasMap[selectedCollection] || selectedCollection;

    const matchesCollection =
      selectedCollection === "all" || p.collection?.slug === actualSelectedCollection;

    const normalizedSearchQuery = searchQuery.toLowerCase().replace(/[- ]/g, '');
    const normalizeString = (str?: string) => str ? str.toLowerCase().replace(/[- ]/g, '') : '';

    const matchesSearch =
      !searchQuery.trim() ||
      normalizeString(p.name).includes(normalizedSearchQuery) ||
      normalizeString(p.category?.name).includes(normalizedSearchQuery) ||
      normalizeString(p.collection?.name).includes(normalizedSearchQuery) ||
      normalizeString(p.description).includes(normalizedSearchQuery);

    const matchesPrice = p.price >= priceRange[0] && p.price <= priceRange[1];

    const matchesPetSize = selectedPetSize === "all" ||
      (p.pet_sizes && p.pet_sizes.includes(selectedPetSize));

    const matchesOwnerSize = selectedOwnerSize === "all" ||
      (p.sizes && p.sizes.includes(selectedOwnerSize));

    const matchesCategory = selectedCategory === "all" ||
      p.category?.id === selectedCategory;

    return matchesCollection && matchesSearch && matchesPrice && matchesPetSize && matchesOwnerSize && matchesCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "newest":
        return (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0);
      default:
        return (b.is_best_seller ? 1 : 0) - (a.is_best_seller ? 1 : 0);
    }
  });

  const handleCollectionChange = (col: string) => {
    setSelectedCollection(col);
    if (col === "all") {
      navigate("/shop");
    } else {
      navigate(`/${col}`);
    }
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    const newParams = new URLSearchParams(searchParams);
    if (sort === "featured") {
      newParams.delete("sort");
    } else {
      newParams.set("sort", sort);
    }
    setSearchParams(newParams);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const newParams = new URLSearchParams(searchParams);
    if (!query.trim()) {
      newParams.delete("search");
    } else {
      newParams.set("search", query);
    }
    setSearchParams(newParams);
  };

  const clearSearch = () => {
    setSearchQuery("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    setSearchParams(newParams);
  };

  return (
    <PageLayout>
      <SEOHead
        title="Shop All Products"
        description="Browse the complete Pebric collection of premium matching outfits for pets and owners. Filter by collection, price, pet size, and more."
        keywords="shop pet outfits, buy matching pet clothes, Pebric shop, pet fashion store, dog matching outfits"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Shop All Products — Pebric",
          description: "Browse the complete Pebric collection of premium matching outfits for pets and owners.",
          url: "https://pebric.vercel.app/shop",
        }}
      />
      
      {/* Breadcrumb & Header */}
      <div className="container mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">

          {/* Top Search & Sort */}
          <div className="flex items-center gap-4">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search products..."
                className="w-full border border-border/60 bg-transparent py-2 pl-10 pr-8 font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8b6540] rounded-sm"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="hidden sm:block">
              <Select value={sortBy} onValueChange={(value) => handleSortChange(value)}>
                <SelectTrigger className="w-[180px] border-border/60 bg-transparent font-body text-sm focus:ring-1 focus:ring-[#8b6540] focus:ring-offset-0 rounded-sm">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="font-body">
                  <SelectItem value="featured" className="cursor-pointer focus:bg-[#e6f3fa]">Featured</SelectItem>
                  <SelectItem value="newest" className="cursor-pointer focus:bg-[#e6f3fa]">Newest First</SelectItem>
                  <SelectItem value="price-low" className="cursor-pointer focus:bg-[#e6f3fa]">Price: Low to High</SelectItem>
                  <SelectItem value="price-high" className="cursor-pointer focus:bg-[#e6f3fa]">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {searchQuery ? `Results for "${searchQuery}"` : "All Products"}
        </h1>
        {searchQuery && (
          <p className="mt-2 text-sm text-muted-foreground">
            Found {sortedProducts.length} result{sortedProducts.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Mobile Sort & Filter Bar */}
      <div className="sticky top-[72px] lg:top-20 z-40 flex items-center border-y border-border/40 bg-background/95 backdrop-blur-sm lg:hidden">
        <Sheet open={mobileSortOpen} onOpenChange={setMobileSortOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-1 items-center justify-center gap-2 border-r border-border/40 py-3.5 font-body text-[13px] font-medium transition-colors hover:bg-muted/50 active:bg-muted focus:outline-none">
              <ArrowUpDown className="h-4 w-4" />
              <span>Sort</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6 sm:max-w-md mx-auto h-auto">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle className="font-display text-xl">Sort By</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1">
              {[
                { value: "featured", label: "Featured" },
                { value: "newest", label: "Newest First" },
                { value: "price-low", label: "Price: Low to High" },
                { value: "price-high", label: "Price: High to Low" }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    handleSortChange(option.value);
                    setMobileSortOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-4 py-3.5 text-sm transition-colors ${sortBy === option.value ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'}`}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <div className="h-2 w-2 rounded-full bg-[#8b6540]" />
                  )}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-1 items-center justify-center gap-2 py-3.5 font-body text-[13px] font-medium transition-colors hover:bg-muted/50 active:bg-muted focus:outline-none">
              <ListFilter className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] sm:max-w-md overflow-y-auto overflow-x-hidden p-0">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-background/95 px-6 py-4 backdrop-blur-sm">
              <SheetTitle className="font-display text-xl">Filters</SheetTitle>
              {(selectedCollection !== "all" || selectedPetSize !== "all" || selectedOwnerSize !== "all" || selectedCategory !== "all") && (
                <button 
                  onClick={() => {
                    handleCollectionChange("all");
                    setSelectedCategory("all");
                    setSelectedPetSize("all");
                    setSelectedOwnerSize("all");
                  }}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="p-6">
              {/* Collection Filter */}
              <div className="mb-6 border-b border-border/20 pb-6">
                <div className="flex items-center justify-between font-semibold mb-4 text-sm">
                  <span>Collection</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="space-y-3">
                  {["all", "summer", "winter", "rainy"].map((col) => (
                    <label key={col} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="mobile-collection"
                        checked={selectedCollection === col}
                        onChange={() => {
                          handleCollectionChange(col);
                          setMobileFilterOpen(false);
                        }}
                        className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                      />
                      <span className="text-[15px] font-medium font-body text-foreground/80 capitalize">{col === "all" ? "All Collections" : col}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div className="mb-6 border-b border-border/20 pb-6">
                <div className="flex items-center justify-between font-semibold mb-4 text-sm">
                  <span>Category</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="mobile-category"
                        checked={selectedCategory === "all"}
                        onChange={() => {
                          setSelectedCategory("all");
                          setMobileFilterOpen(false);
                        }}
                        className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                      />
                      <span className="text-[15px] font-medium font-body text-foreground/80">All Categories</span>
                  </label>
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="mobile-category"
                        checked={selectedCategory === cat.id}
                        onChange={() => {
                          setSelectedCategory(cat.id);
                          setMobileFilterOpen(false);
                        }}
                        className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                      />
                      <span className="text-[15px] font-medium font-body text-foreground/80">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pet Size */}
              <div className="mb-6 border-b border-border/20 pb-6">
                <div className="flex items-center justify-between font-semibold mb-4 text-sm">
                  <span>Pet Size</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="mobile-petsize"
                      checked={selectedPetSize === "all"}
                      onChange={() => {
                        setSelectedPetSize("all");
                        setMobileFilterOpen(false);
                      }}
                      className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                    />
                    <span className="text-[15px] font-medium font-body text-foreground/80 uppercase">All Sizes</span>
                  </label>
                  {petSizes.map((size) => (
                    <label key={size} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="mobile-petsize"
                        checked={selectedPetSize === size}
                        onChange={() => {
                          setSelectedPetSize(size);
                          setMobileFilterOpen(false);
                        }}
                        className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                      />
                      <span className="text-[15px] font-medium font-body text-foreground/80 uppercase">{size}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Owner Size */}
              <div className="mb-6 pb-6">
                <div className="flex items-center justify-between font-semibold mb-4 text-sm">
                  <span>Owner Size</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="mobile-ownersize"
                      checked={selectedOwnerSize === "all"}
                      onChange={() => {
                        setSelectedOwnerSize("all");
                        setMobileFilterOpen(false);
                      }}
                      className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                    />
                    <span className="text-[15px] font-medium font-body text-foreground/80 uppercase">All Sizes</span>
                  </label>
                  {ownerSizes.map((size) => (
                    <label key={size} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="mobile-ownersize"
                        checked={selectedOwnerSize === size}
                        onChange={() => {
                          setSelectedOwnerSize(size);
                          setMobileFilterOpen(false);
                        }}
                        className="w-[18px] h-[18px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors checked:border-[#8b6540]" 
                      />
                      <span className="text-[15px] font-medium font-body text-foreground/80 uppercase">{size}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <section className="container mx-auto px-6 py-4 flex flex-col lg:flex-row gap-8 lg:gap-16">
        
        {/* Sidebar Filters (Desktop) */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-bold">Filters</h2>
            {(selectedCollection !== "all" || selectedPetSize !== "all" || selectedCategory !== "all") && (
              <button 
                onClick={() => {
                  handleCollectionChange("all");
                  setSelectedCategory("all");
                  setSelectedPetSize("all");
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Collection Filter */}
          <div className="mb-6 border-b border-border/20 pb-6">
            <div className="flex items-center justify-between font-semibold mb-4 text-sm">
              <span>Collection</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="space-y-3">
              {["all", "summer", "winter", "rainy"].map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="collection"
                    checked={selectedCollection === col}
                    onChange={() => handleCollectionChange(col)}
                    className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                  />
                  <span className="text-sm font-medium font-body text-foreground/80 capitalize">{col === "all" ? "All Collections" : col}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6 border-b border-border/20 pb-6">
            <div className="flex items-center justify-between font-semibold mb-4 text-sm">
              <span>Category</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="category"
                    checked={selectedCategory === "all"}
                    onChange={() => setSelectedCategory("all")}
                    className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                  />
                  <span className="text-sm font-medium font-body text-foreground/80">All Categories</span>
              </label>
              {categories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="category"
                    checked={selectedCategory === cat.id}
                    onChange={() => setSelectedCategory(cat.id)}
                    className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                  />
                  <span className="text-sm font-medium font-body text-foreground/80">{cat.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Pet Size */}
          <div className="mb-6 border-b border-border/20 pb-6">
            <div className="flex items-center justify-between font-semibold mb-4 text-sm">
              <span>Pet Size</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="petsize"
                  checked={selectedPetSize === "all"}
                  onChange={() => setSelectedPetSize("all")}
                  className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                />
                <span className="text-sm font-medium font-body text-foreground/80 uppercase">All Sizes</span>
              </label>
              {petSizes.map((size) => (
                <label key={size} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="petsize"
                    checked={selectedPetSize === size}
                    onChange={() => setSelectedPetSize(size)}
                    className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                  />
                  <span className="text-sm font-medium font-body text-foreground/80 uppercase">{size}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Owner Size */}
          <div className="mb-6 border-b border-border/20 pb-6">
            <div className="flex items-center justify-between font-semibold mb-4 text-sm">
              <span>Owner Size</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="radio" 
                  name="ownersize"
                  checked={selectedOwnerSize === "all"}
                  onChange={() => setSelectedOwnerSize("all")}
                  className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                />
                <span className="text-sm font-medium font-body text-foreground/80 uppercase">All Sizes</span>
              </label>
              {ownerSizes.map((size) => (
                <label key={size} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="ownersize"
                    checked={selectedOwnerSize === size}
                    onChange={() => setSelectedOwnerSize(size)}
                    className="w-[16px] h-[16px] border-2 border-border/60 text-[#8b6540] focus:ring-0 focus:ring-offset-0 bg-transparent transition-colors group-hover:border-[#8b6540] checked:border-[#8b6540]" 
                  />
                  <span className="text-sm font-medium font-body text-foreground/80 uppercase">{size}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Simple Decorative Colors for aesthetic consistency */}
          <div className="mb-6 border-b border-border/20 pb-6 hidden lg:block">
            <div className="flex items-center justify-between font-semibold mb-4 text-sm opacity-50">
              <span>Color (Soon)</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex gap-2">
               <div className="w-[18px] h-[18px] rounded-[3px] bg-[#9e2a2b] shadow-sm opacity-50"></div>
               <div className="w-[18px] h-[18px] rounded-[3px] bg-[#0f2249] shadow-sm opacity-50"></div>
               <div className="w-[18px] h-[18px] rounded-[3px] bg-[#e8e4db] border border-border/40 shadow-sm opacity-50"></div>
               <div className="w-[18px] h-[18px] rounded-[3px] bg-[#6b4c3a] shadow-sm opacity-50"></div>
            </div>
          </div>
        </aside>

        {/* Product Grid Area */}
        <div className="flex-1 pb-24">
          {/* Mobile Search */}
          <div className="relative w-full mb-6 sm:hidden">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search products..."
                className="w-full border border-border/60 bg-transparent py-2 pl-10 pr-8 font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8b6540] rounded-sm"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <>
              {sortedProducts.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="font-display text-2xl mb-2">No products found</p>
                  <p className="font-body text-muted-foreground">
                    Try adjusting your search or filter criteria
                  </p>
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="mt-6 border border-border px-6 py-2 font-body text-sm transition-colors hover:bg-muted"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sortedProducts.map((product, index) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      priority={index < 4}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
