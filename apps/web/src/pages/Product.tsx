import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Minus,
  Plus,
  Star,
  Truck,
  Shield,
  RotateCcw,
  GitCompare,
} from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { useProduct, useProductsByCollection } from "@/hooks/useProducts";
import { useProductReviewSummary } from "@/hooks/useReviews";
import { ProductCard } from "@/components/ProductCard";
import { SizeRecommendation } from "@/components/SizeRecommendation";
import { ProductFabricInfo } from "@/components/ProductFabricInfo";
import { useTrackProductView } from "@/hooks/useRecentlyViewed";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { useCompare } from "@/hooks/useCompare";
import { ProductImageGallery } from "@/components/ProductImageGallery";


const ProductReviews = lazy(() =>
  import("@/components/ProductReviews").then((module) => ({
    default: module.ProductReviews,
  })),
);
const RecentlyViewed = lazy(() =>
  import("@/components/RecentlyViewed").then((module) => ({
    default: module.RecentlyViewed,
  })),
);

function ProductDetailSkeleton() {
  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-5 md:py-8">
        <div className="grid gap-6 md:gap-8 lg:gap-12 lg:grid-cols-[30%_1fr]">
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden bg-muted">
              <Skeleton className="h-full w-full rounded-none" />
            </div>
            <div className="grid min-w-0 grid-cols-5 gap-3 sm:flex sm:overflow-x-auto sm:pb-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`product-thumb-skeleton-${index}`}
                  className="aspect-square w-full overflow-hidden sm:w-16 sm:shrink-0 md:w-20"
                >
                  <Skeleton className="h-full w-full rounded-none" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5 md:space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-4/5" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-36" />
              </div>
            </div>

            <div className="space-y-4 md:space-y-5">
              {Array.from({ length: 2 }).map((_, sectionIndex) => (
                <div key={`product-size-skeleton-${sectionIndex}`}>
                  <Skeleton className="mb-3 h-3 w-24" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 5 }).map((_, optionIndex) => (
                      <Skeleton
                        key={`product-size-option-${sectionIndex}-${optionIndex}`}
                        className="h-10 w-14 md:h-12 md:w-16"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div className="w-full max-w-[220px] md:max-w-[260px]">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-10 w-full md:h-12" />
              </div>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <Skeleton className="h-14 w-full flex-1" />
                <Skeleton className="h-14 w-full flex-1" />
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:border-t lg:border-border lg:pt-8 lg:-mr-8 lg:pr-8">
            <Skeleton className="mb-4 h-7 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={`product-feature-skeleton-${index}`}
                  className="h-4 w-full"
                />
              ))}
            </div>
          </div>

          <div className="space-y-5 md:space-y-6 lg:border-t lg:border-border lg:pt-8 lg:-ml-8 lg:pl-8">
            <div className="border-t border-border pt-6 md:pt-8 lg:border-none lg:pt-0">
              <Skeleton className="mb-4 h-7 w-36" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={`product-description-skeleton-${index}`}
                    className="h-4 w-full"
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6 md:pt-8">
              <Skeleton className="mb-4 h-7 w-40" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={`product-fabric-skeleton-${index}`}
                    className="h-16 w-full"
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4 border-t border-border pt-6 md:pt-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`product-trust-skeleton-${index}`}
                  className="flex flex-col items-center gap-2"
                >
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </PageLayout>
  );
}

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug || "");
  const navigate = useNavigate();
  const [loadSecondaryContent, setLoadSecondaryContent] = useState(false);
  const { data: collectionProducts = [] } = useProductsByCollection(
    loadSecondaryContent ? product?.collection?.slug || "" : "",
  );
  const { data: reviewSummary } = useProductReviewSummary(product?.id || "");
  const averageRating = reviewSummary?.averageRating || 0;
  const totalReviews = reviewSummary?.totalReviews || 0;

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedPetSize, setSelectedPetSize] = useState("");
  const [parentQuantity, setParentQuantity] = useState(1);
  const [petQuantity, setPetQuantity] = useState(1);
  const { cartItems, addToCart, addToWishlist, removeFromWishlist, isInWishlist } =
    useCart();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const { user } = useAuth();
  const { mutate: trackProductView } = useTrackProductView();
  const trackedProductIdRef = useRef<string | null>(null);
  const halfPrice = Math.round(product?.price ? product.price * 0.5 : 0);
  const dynamicTotalPrice = useMemo(() => {
    if (!product) return 0;
    let sum = 0;
    if (selectedSize) {
      sum += parentQuantity * halfPrice;
    }
    if (selectedPetSize) {
      sum += petQuantity * halfPrice;
    }
    if (!selectedSize && !selectedPetSize) {
      return product.price;
    }
    return sum;
  }, [product, selectedSize, selectedPetSize, parentQuantity, petQuantity, halfPrice]);

  const isVariantInCart = useMemo(() => {
    if (!product || (!selectedSize && !selectedPetSize)) return false;
    return cartItems.some(item => 
      item.id === product.id && 
      item.ownerSize === (selectedSize || "N/A") && 
      item.petSize === (selectedPetSize || "N/A")
    );
  }, [cartItems, product, selectedSize, selectedPetSize]);

  /* Safe access for loading state */
  const images = useMemo(
    () =>
      product?.images?.length
        ? product.images
        : [product?.image_url || "/product-1.jpg"],
    [product?.images, product?.image_url],
  );
  const sizes = product?.sizes || ["XS", "S", "M", "L", "XL"];
  const petSizes = product?.pet_sizes || ["XS", "S", "M", "L"];
  const features = product?.features || [
    "Premium quality materials",
    "Matching design for you and your pet",
    "Machine washable",
  ];

  /* Removed numericId hack */
  const inWishlist = isInWishlist(product?.id || "");
  const inCompare = isInCompare(product?.id || "");

  const relatedProducts = collectionProducts
    .filter((p) => p.id !== product?.id)
    .slice(0, 3);

  useEffect(() => {
    setLoadSecondaryContent(false);

    const timer = window.setTimeout(() => {
      setLoadSecondaryContent(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [product?.id]);

  // Track product view once per product per mount (avoid refetch storms from unstable mutation deps)
  useEffect(() => {
    if (!product?.id || !user?.id) return;
    if (trackedProductIdRef.current === product.id) return;

    trackedProductIdRef.current = product.id;
    trackProductView(product.id);
  }, [product?.id, user?.id, trackProductView]);

  const productJsonLd = useMemo(() => {
    if (!product) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description:
        product.description ||
        `Premium matching outfit for you and your pet — ${product.name} by Pebric.`,
      image: images,
      brand: { "@type": "Brand", name: "Pebric" },
      offers: {
        "@type": "Offer",
        price: product.price,
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        url: `https://pebric.vercel.app/product/${slug}`,
      },
      ...(totalReviews > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: averageRating.toFixed(1),
          reviewCount: totalReviews,
        },
      }),
    };
  }, [product, images, slug, averageRating, totalReviews]);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <PageLayout>
        <div className="container mx-auto px-6 py-32 text-center">
          <h1 className="mb-4 font-display text-4xl">Product Not Found</h1>
          <Link
            to="/shop"
            className="font-body text-muted-foreground underline"
          >
            Return to Shop
          </Link>
        </div>
      </PageLayout>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize && !selectedPetSize) {
      toast.error("Please select at least one size", {
        description: "Choose owner size, pet size, or both.",
      });
      return;
    }

    const isMatchingSet = product.sizes && product.sizes.length > 0 && product.pet_sizes && product.pet_sizes.length > 0;

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url || "/product-1.jpg",
      ownerSize: selectedSize || "N/A",
      petSize: selectedPetSize || "N/A",
      slug: product.slug,
      type: isMatchingSet ? "combo" : "owner",
      ownerQuantity: selectedSize ? parentQuantity : 0,
      petQuantity: selectedPetSize ? petQuantity : 0,
    });

    const totalAdded = (selectedSize ? parentQuantity : 0) + (selectedPetSize ? petQuantity : 0);
    toast.success("Added to cart!", {
      description: `Added ${totalAdded} item(s) to your cart.`,
    });

    setSelectedSize("");
    setParentQuantity(1);
    setSelectedPetSize("");
    setPetQuantity(1);
  };

  const handleBuyNow = () => {
    if (!selectedSize && !selectedPetSize) {
      toast.error("Please select at least one size", {
        description: "Choose owner size, pet size, or both.",
      });
      return;
    }

    const isMatchingSet = product.sizes && product.sizes.length > 0 && product.pet_sizes && product.pet_sizes.length > 0;

    const buyNowItems = [{
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image_url || "/product-1.jpg",
      ownerSize: selectedSize || "N/A",
      petSize: selectedPetSize || "N/A",
      slug: product.slug,
      quantity: (selectedSize ? parentQuantity : 0) + (selectedPetSize ? petQuantity : 0),
      ownerQuantity: selectedSize ? parentQuantity : 0,
      petQuantity: selectedPetSize ? petQuantity : 0,
      type: isMatchingSet ? ("combo" as const) : ("owner" as const),
    }];

    navigate("/checkout", { state: { buyNowItems } });
  };

  const handleWishlist = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      toast.info("Removed from wishlist");
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image_url || "/product-1.jpg",
        category: product.category?.name || "Fashion",
        slug: product.slug,
      });
      toast.success("Added to wishlist!");
    }
  };

  const handleShare = async () => {
    const shareUrl = new URL(
      `/product/${product.slug}`,
      window.location.origin,
    ).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on Pebric.`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied!");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast.error("Couldn't share product link");
    }
  };

  const handleCompare = () => {
    if (inCompare) {
      removeFromCompare(product.id);
      toast.info("Removed from compare");
      return;
    }

    const added = addToCompare(product.id);

    if (added) {
      toast.success("Added to compare", {
        action: {
          label: "View",
          onClick: () => navigate("/compare"),
        },
      });
      return;
    }

    toast.error("Maximum 3 products can be compared");
  };

  return (
    <PageLayout>
      <SEOHead
        title={product.name}
        description={
          product.description ||
          `Shop ${product.name} — premium matching outfit for you and your pet at Pebric.`
        }
        keywords={`${product.name}, ${product.category?.name || "pet fashion"}, matching outfit, Pebric, pet clothing`}
        image={product.image_url || "/product-1.jpg"}
        type="product"
        jsonLd={productJsonLd}
      />
      <div className="container mx-auto px-4 md:px-6 py-5 md:py-8">
        <div className="grid gap-6 md:gap-8 lg:gap-12 lg:grid-cols-[30%_1fr]">
          {/* Image Gallery */}
          <ProductImageGallery
            images={images}
            productName={product.name}
            inWishlist={inWishlist}
            onWishlistToggle={handleWishlist}
            onShare={handleShare}
          />

          {/* Product Info */}
          <div className="space-y-5 md:space-y-6">
            <div>
              <p className="mb-2 font-body text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {product.category?.name || "Fashion"}
              </p>
              <h1 className="mb-4 font-display text-3xl font-medium tracking-tight md:text-4xl">
                {product.name}
              </h1>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= Math.floor(averageRating);
                    const halfFilled =
                      star === Math.ceil(averageRating) &&
                      averageRating % 1 >= 0.3 &&
                      averageRating % 1 < 0.8;

                    return (
                      <div key={star} className="relative">
                        <Star
                          className={`h-4 w-4 ${
                            filled
                              ? "fill-foreground text-foreground"
                              : "text-muted"
                          }`}
                        />
                        {halfFilled && (
                          <div
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: "50%" }}
                          >
                            <Star className="h-4 w-4 fill-foreground text-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className="font-body text-sm text-muted-foreground">
                  {averageRating > 0 ? averageRating.toFixed(1) : "0.0"} (
                  {totalReviews} reviews)
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl font-medium">
                    ₹{dynamicTotalPrice}
                  </span>
                  {product.original_price && (
                    <span className="font-body text-lg text-muted-foreground line-through">
                      ₹{product.original_price}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant={inCompare ? "default" : "outline"}
                  size="sm"
                  onClick={handleCompare}
                  className="h-10 shrink-0 gap-2 px-3 font-body text-[10px] uppercase tracking-[0.18em] md:px-4"
                >
                  <GitCompare className="h-4 w-4" />
                  {inCompare ? "In Compare" : "Add to Compare"}
                </Button>
              </div>
            </div>

            {/* Size & Quantity Selection */}
            <div className="space-y-6 md:space-y-8">
              {/* Parent Section */}
              <div className="space-y-3">
                <label className="block font-body text-xs uppercase tracking-[0.2em] text-foreground">
                  Your Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        setSelectedSize(selectedSize === size ? "" : size)
                      }
                      className={`h-10 min-w-[44px] px-3 text-xs md:h-12 md:min-w-[48px] md:px-4 md:text-sm border font-body transition-colors ${
                        selectedSize === size
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {/* Parent Quantity Selector */}
                {selectedSize && (
                  <div className="w-full max-w-[180px] pt-1">
                    <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Parent Quantity
                    </label>
                    <div className="flex h-9 items-center border border-border">
                      <button
                        onClick={() => setParentQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="flex-1 text-center font-body text-xs">
                        {parentQuantity}
                      </span>
                      <button
                        onClick={() => setParentQuantity((q) => q + 1)}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pet Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-body text-xs uppercase tracking-[0.2em] text-foreground">
                    Pet Size
                  </label>
                  <SizeRecommendation
                    onSizeSelect={setSelectedPetSize}
                    availableSizes={petSizes}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {petSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        setSelectedPetSize(selectedPetSize === size ? "" : size)
                      }
                      className={`h-10 min-w-[44px] px-3 text-xs md:h-12 md:min-w-[48px] md:px-4 md:text-sm border font-body transition-colors ${
                        selectedPetSize === size
                          ? "border-foreground bg-foreground text-background"
                          : "border-border hover:border-foreground"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {/* Pet Quantity Selector */}
                {selectedPetSize && (
                  <div className="w-full max-w-[180px] pt-1">
                    <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Pet Quantity
                    </label>
                    <div className="flex h-9 items-center border border-border">
                      <button
                        onClick={() => setPetQuantity((q) => Math.max(1, q - 1))}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="flex-1 text-center font-body text-xs">
                        {petQuantity}
                      </span>
                      <button
                        onClick={() => setPetQuantity((q) => q + 1)}
                        className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex flex-col gap-3 pt-4">

              {/* Action Buttons */}
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                {isVariantInCart ? (
                  <Button
                    onClick={() => navigate("/cart")}
                    variant="hero"
                    className="h-14 w-full flex-1 sm:w-auto"
                  >
                    Go to Cart
                  </Button>
                ) : (
                  <Button
                    onClick={handleAddToCart}
                    variant="hero"
                    className="h-14 w-full flex-1 sm:w-auto"
                  >
                    Add to Cart
                  </Button>
                )}
                <Button
                  onClick={handleBuyNow}
                  variant="hero-outline"
                  className="h-14 w-full flex-1 sm:w-auto"
                >
                  Buy Now
                </Button>
              </div>
            </div>
          </div>

          {/* Features (Desktop - Row 2 Left) */}
          <div className="hidden lg:block lg:border-t lg:border-border lg:pt-8 lg:-mr-8 lg:pr-8">
            <h3 className="mb-4 font-display text-lg font-medium">Features</h3>
            <ul className="space-y-2 leading-relaxed">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 font-body text-muted-foreground"
                >
                  <span className="h-1 w-1 rounded-full bg-foreground" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Description & Additional Info (Row 2 Right) */}
          <div className="space-y-5 md:space-y-6 lg:border-t lg:border-border lg:pt-8 lg:-ml-8 lg:pl-8">
            {/* Features (Mobile) */}
            <div className="border-t border-border pt-6 md:pt-8 lg:hidden">
              <h3 className="mb-4 font-display text-lg font-medium">
                Features
              </h3>
              <ul className="space-y-2">
                {features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 font-body text-muted-foreground"
                  >
                    <span className="h-1 w-1 rounded-full bg-foreground" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Description */}
            <div className="border-t border-border pt-6 md:pt-8 lg:border-none lg:pt-0">
              <h3 className="mb-4 font-display text-lg font-medium">
                Description
              </h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                {product.description ||
                  "A beautiful matching set for you and your furry companion. Made with premium materials for comfort and style."}
              </p>
            </div>

            {/* Fabric & Care Info */}
            <ProductFabricInfo
              fabricType={(product as any).fabric_type}
              breathability={(product as any).breathability}
              stretchLevel={(product as any).stretch_level}
              isAllergySafe={(product as any).is_allergy_safe}
              careWash={(product as any).care_wash}
              careDry={(product as any).care_dry}
              durabilityRating={(product as any).durability_rating}
              seasonalTags={(product as any).seasonal_tags}
            />

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 border-t border-border pt-6 md:pt-8">
              <div className="text-center">
                <Truck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">
                  Free Shipping
                </p>
              </div>
              <div className="text-center">
                <Shield className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">
                  Quality Guarantee
                </p>
              </div>
              <div className="text-center">
                <RotateCcw className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="font-body text-xs text-muted-foreground">
                  Easy Returns
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Reviews */}
        <Suspense
          fallback={
            <div className="mt-16 h-64 animate-pulse rounded-xl bg-muted" />
          }
        >
          {loadSecondaryContent && (
            <ProductReviews
              productId={product.id}
              productName={product.name}
              productSlug={slug || ""}
            />
          )}
        </Suspense>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 text-center font-display text-3xl font-medium">
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {relatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        <Suspense fallback={null}>
          {loadSecondaryContent && <RecentlyViewed />}
        </Suspense>
      </div>
    </PageLayout>
  );
}
