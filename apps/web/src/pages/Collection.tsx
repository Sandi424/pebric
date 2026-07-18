import { useState, useMemo } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { ProductCard } from "@/components/ProductCard";
import { useProductsByCollection, useCollections, useCategories } from "@/hooks/useProducts";
import { SEOHead } from "@/components/SEOHead";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ListFilter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type SortOption = "featured" | "price-low" | "price-high" | "newest";

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

export default function Collection() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine slug from URL path if not provided as param
  // For routes like /summer, /winter, /rainy defined in App.tsx
  const pathSlug = location.pathname.split('/')[1];
  const collectionSlug = slug || (["summer", "winter", "rainy", "twinning"].includes(pathSlug) ? pathSlug : "summer");
  

  const { data: products = [], isLoading: productsLoading } = useProductsByCollection(collectionSlug);
  const { data: collections = [] } = useCollections();

  
  const collection = collections.find(c => c.slug === collectionSlug);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  
  const [selectedPetSize, setSelectedPetSize] = useState<string>("all");
  const [selectedOwnerSize, setSelectedOwnerSize] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const { data: categories = [] } = useCategories();
  const petSizes = ["XS", "S", "M", "L"];
  const ownerSizes = ["XS", "S", "M", "L"];

  // Fallback images
  const fallbackImages: Record<string, string> = {
    summer: "/collection-summer.jpg",
    winter: "/collection-winter.jpg",
    rainy: "/collection-rainy.jpg",
    twinning: "/collection-summer.jpg",
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesPetSize = selectedPetSize === "all" ||
        (p.pet_sizes && p.pet_sizes.includes(selectedPetSize));

      const matchesOwnerSize = selectedOwnerSize === "all" ||
        (p.sizes && p.sizes.includes(selectedOwnerSize));

      const matchesCategory = selectedCategory === "all" ||
        p.category?.id === selectedCategory;

      return matchesPetSize && matchesOwnerSize && matchesCategory;
    });
  }, [products, selectedPetSize, selectedOwnerSize, selectedCategory]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    switch (sortBy) {
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      case "newest":
        return sorted.sort((a, b) => (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0));
      default:
        return sorted;
    }
  }, [filteredProducts, sortBy]);

  const collectionImage = collection?.image_url || fallbackImages[collectionSlug] || "/collection-summer.jpg";
  const collectionName = collectionSlug === "twinning"
    ? "Twinning Sets"
    : (collection?.name || `${collectionSlug.charAt(0).toUpperCase() + collectionSlug.slice(1)} Collection`);
  const collectionDescription = collection?.description || "Explore our curated collection of matching outfits for you and your pet.";

  return (
    <PageLayout>
      <SEOHead
        title={`${collectionName} — Matching Pet & Owner Outfits`}
        description={collectionDescription}
        keywords={`${collectionSlug} pet outfits, ${collectionSlug} matching clothes, Pebric ${collectionSlug}, pet fashion ${collectionSlug}`}
        image={collectionImage}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: collectionName,
          description: collectionDescription,
          url: `https://pebric.vercel.app/collection/${collectionSlug}`,
        }}
      />
      
      {/* Breadcrumb & Header */}
      <div className="container mx-auto px-6 pt-10 pb-6">
        <div className="hidden sm:flex items-center text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-foreground transition-colors">Shop All Products</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-semibold">{collectionName}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {collectionName}
          </h1>
          <div className="hidden lg:block w-[180px]">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
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
                    setSortBy(option.value as SortOption);
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
          <SheetContent side="right" className="w-[85vw] sm:max-w-md overflow-y-auto p-0">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/20 bg-background/95 px-6 py-4 backdrop-blur-sm">
              <SheetTitle className="font-display text-xl">Filters</SheetTitle>
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
                        checked={collectionSlug === col}
                        onChange={() => {
                          if (col === "all") navigate("/shop");
                          else navigate(`/${col}`);
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
              <div className="mb-6 pb-6 border-b border-border/20">
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

              {/* Color (Soon) */}
              <div className="mb-6 pb-6">
                <div className="flex items-center justify-between font-semibold mb-4 text-sm opacity-50">
                  <span>Color (Soon)</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8L6 4.5L9.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="flex flex-wrap gap-2 opacity-50">
                  {['#cc8b86', '#7d8ca3', '#f2efe9', '#ae988e'].map((color) => (
                    <div key={color} className="w-[18px] h-[18px] rounded-[3px] shadow-sm cursor-not-allowed" style={{ backgroundColor: color }}></div>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Layout */}
      <section className="container mx-auto px-6 py-4 flex flex-col lg:flex-row gap-8 lg:gap-16">
        
        {/* Sidebar Filters (Desktop) */}
        <aside className="hidden lg:block w-48 flex-shrink-0">
          <h2 className="font-display text-lg font-bold mb-6">Filters</h2>

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
                    checked={collectionSlug === col}
                    onChange={() => {
                      if (col === "all") navigate("/shop");
                      else navigate(`/${col}`);
                    }}
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
            <div className="flex flex-wrap gap-2 opacity-50">
              {['#cc8b86', '#7d8ca3', '#f2efe9', '#ae988e'].map((color) => (
                <div key={color} className="w-[16px] h-[16px] rounded-[3px] shadow-sm cursor-not-allowed" style={{ backgroundColor: color }}></div>
              ))}
            </div>
          </div>

        </aside>

        {/* Product Grid Area */}
        <div className="flex-1 pb-24">
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <>
              {sortedProducts.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="font-body text-lg text-muted-foreground">
                    No products found in this collection.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
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
