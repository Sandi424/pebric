import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GalleryPost,
  useGalleryPosts,
  useCreateGalleryPost,
  useLikeGalleryPost,
  useIsPostLiked,
  usePostLikesCount,
  usePetOfTheWeek,
  useUserGalleryPosts,
} from "@/hooks/useGallery";
import { usePets } from "@/hooks/usePets";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import {
  Heart,
  MessageCircle,
  Upload,
  Camera,
  Crown,
  Image as ImageIcon,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { OptimizedImage } from "@/components/ui/optimized-image";

/* ─── Lightbox for full-size photo view ─── */
function PhotoLightbox({
  post,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  post: GalleryPost;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const { user } = useAuth();
  const { data: isLiked } = useIsPostLiked(post.id);
  const { data: likesCount = 0 } = usePostLikesCount(post.id);
  const likeMutation = useLikeGalleryPost();

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    setOptimisticLiked(null);
  }, [isLiked]);
  useEffect(() => {
    setOptimisticCount(null);
  }, [likesCount]);

  const displayLiked = optimisticLiked !== null ? optimisticLiked : !!isLiked;
  const displayCount = optimisticCount !== null ? optimisticCount : likesCount;

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const handleLike = () => {
    if (!user) {
      toast.error("Please log in to like photos");
      return;
    }
    const newLiked = !displayLiked;
    setOptimisticLiked(newLiked);
    setOptimisticCount(
      newLiked ? displayCount + 1 : Math.max(0, displayCount - 1),
    );
    likeMutation.mutate(post.id, {
      onError: () => {
        setOptimisticLiked(null);
        setOptimisticCount(null);
        toast.error("Failed to like");
      },
    });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(post.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pebric-${post.pet?.name || "pet"}-${post.id.slice(0, 8)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Photo downloaded!");
    } catch {
      toast.error("Failed to download photo");
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && hasNext) {
      onNext();
    }

    if (isRightSwipe && hasPrev) {
      onPrev();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Prev / Next arrows */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 z-50 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:left-6"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 z-50 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:right-6"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Content */}
      <div
        className="relative flex max-h-[90vh] max-w-5xl flex-col items-center gap-4 overflow-y-auto px-4 md:flex-row md:gap-6 md:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div
          className="flex max-h-[50vh] flex-1 items-center justify-center touch-pan-y md:max-h-[85vh]"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <OptimizedImage
            src={post.image_url}
            alt={post.caption || "Pet photo"}
            className="max-h-[50vh] max-w-full rounded-lg object-contain shadow-2xl md:max-h-[85vh]"
            sizes="(max-width: 768px) 100vw, 800px"
          />
        </div>

        {/* Info panel */}
        <div className="w-full max-h-[30vh] flex-shrink-0 space-y-3 overflow-y-auto rounded-lg bg-white/5 p-4 text-white backdrop-blur-sm md:max-h-none md:w-72 md:overflow-visible">
          {post.pet?.name && (
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">
                Pet
              </p>
              <p className="text-lg font-medium">{post.pet.name}</p>
              {post.pet.breed && (
                <p className="text-sm text-white/60">{post.pet.breed}</p>
              )}
            </div>
          )}

          {post.caption && (
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">
                Caption
              </p>
              <p className="text-sm leading-relaxed text-white/80">
                {post.caption}
              </p>
            </div>
          )}

          {post.product && (
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">
                Wearing
              </p>
              <Link
                to={`/product/${post.product.slug}`}
                className="text-sm text-white/80 underline underline-offset-2 hover:text-white"
                onClick={onClose}
              >
                {post.product.name}
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/10">
            <button
              onClick={handleLike}
              disabled={likeMutation.isPending}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
            >
              <Heart
                className={`h-4 w-4 ${displayLiked ? "fill-red-500 text-red-500" : ""}`}
              />
              {displayCount}
            </button>
            {user && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                Save
              </button>
            )}
          </div>

          {post.is_featured && (
            <div className="flex items-center gap-2 rounded-full bg-yellow-500/20 px-3 py-1.5 text-sm text-yellow-300">
              <Crown className="h-4 w-4" />
              Featured
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Gallery Card ─── */
function GalleryCard({
  post,
  onOpen,
  showApprovalStatus = false,
}: {
  post: GalleryPost;
  onOpen: () => void;
  showApprovalStatus?: boolean;
}) {
  const { user } = useAuth();
  const { data: isLiked } = useIsPostLiked(post.id);
  const { data: likesCount = 0 } = usePostLikesCount(post.id);
  const likeMutation = useLikeGalleryPost();

  // Optimistic state for instant UI feedback
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  // Sync optimistic state with server data when it arrives
  useEffect(() => {
    setOptimisticLiked(null);
  }, [isLiked]);
  useEffect(() => {
    setOptimisticCount(null);
  }, [likesCount]);

  const displayLiked = optimisticLiked !== null ? optimisticLiked : !!isLiked;
  const displayCount = optimisticCount !== null ? optimisticCount : likesCount;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to like photos");
      return;
    }

    // Instant optimistic update
    const newLiked = !displayLiked;
    setOptimisticLiked(newLiked);
    setOptimisticCount(
      newLiked ? displayCount + 1 : Math.max(0, displayCount - 1),
    );

    likeMutation.mutate(post.id, {
      onError: (error) => {
        // Revert on failure
        setOptimisticLiked(null);
        setOptimisticCount(null);
        console.error("Like failed:", error);
        toast.error("Failed to like", { description: error.message });
      },
    });
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const response = await fetch(post.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pebric-${post.pet?.name || "pet"}-${post.id.slice(0, 8)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Photo downloaded!");
    } catch {
      toast.error("Failed to download photo");
    }
  };

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg bg-card break-inside-avoid mb-2"
      onClick={onOpen}
    >
      <div className="overflow-hidden bg-muted">
        <OptimizedImage
          src={post.image_url}
          alt={post.caption || "Pet photo"}
          className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
        />
      </div>

      {/* Action buttons - always visible */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <button
          onClick={handleLike}
          className="flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105"
          disabled={likeMutation.isPending}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${displayLiked ? "fill-red-500 text-red-500" : ""}`}
          />
          <span>{displayCount}</span>
        </button>
        {user && (
          <button
            onClick={handleDownload}
            className="flex items-center rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105"
            title="Download photo"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Gradient - pointer-events-none so it doesn't block clicks */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Hover info overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
        <div className="text-white">
          {post.pet?.name && <p className="font-medium">{post.pet.name}</p>}
          {post.caption && (
            <p className="text-sm text-white/80 line-clamp-2">{post.caption}</p>
          )}
        </div>
        {post.product && (
          <Link
            to={`/product/${post.product.slug}`}
            className="mt-2 inline-block text-xs text-white/70 hover:text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            Wearing: {post.product.name}
          </Link>
        )}
      </div>

      {/* Status / featured badges */}
      <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-2">
        {showApprovalStatus && (
          <div
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-lg ${
              post.is_approved
                ? "bg-emerald-500 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {post.is_approved ? "Live" : "Pending"}
          </div>
        )}
        {post.is_featured && (
          <div className="rounded-full bg-yellow-500 p-1.5 shadow-lg">
            <Crown className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

function UploadDialog() {
  const { user } = useAuth();
  const { data: pets = [] } = usePets();
  const { data: products = [] } = useProducts();
  const createPost = useCreateGalleryPost();

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [petId, setPetId] = useState("");
  const [productId, setProductId] = useState("");
  const [caption, setCaption] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    const selectedPet = pets.find((p) => p.id === petId);
    const selectedProduct = products.find((p) => p.id === productId);

    await createPost.mutateAsync({
      imageFile: file,
      petId: petId || undefined,
      productId: productId || undefined,
      caption: caption || undefined,
      petDetails: selectedPet ? { name: selectedPet.name, breed: selectedPet.breed } : undefined,
      productDetails: selectedProduct ? { name: selectedProduct.name, slug: selectedProduct.slug } : undefined,
    });

    setOpen(false);
    setFile(null);
    setPreview(null);
    setPetId("");
    setProductId("");
    setCaption("");
  };

  if (!user) {
    return (
      <Link to="/login">
        <Button variant="hero">
          <Upload className="mr-2 h-4 w-4" />
          Share Your Pet
        </Button>
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero">
          <Upload className="mr-2 h-4 w-4" />
          Share Your Pet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {preview ? (
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <img
                src={preview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <span className="mt-2 text-sm text-muted-foreground">
                Click to upload
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}

          <Select
            value={petId}
            onValueChange={(val) => setPetId(val === "none" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your pet (optional)" />
            </SelectTrigger>
            <SelectContent>
              {pets.length > 0 ? (
                <>
                  <SelectItem value="none">None (No pet)</SelectItem>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name} {pet.species ? `(${pet.species})` : ""}
                    </SelectItem>
                  ))}
                </>
              ) : (
                <SelectItem value="none">
                  No pets registered yet (optional)
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select
            value={productId}
            onValueChange={(val) => setProductId(val === "none" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tag a product (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (No product)</SelectItem>
              {products.slice(0, 50).map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            rows={3}
          />

          <Button
            onClick={handleSubmit}
            disabled={!file || createPost.isPending}
            className="w-full"
          >
            {createPost.isPending ? "Uploading..." : "Submit"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Photos appear directly in the community gallery
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Gallery() {
  const { user } = useAuth();
  const [limit, setLimit] = useState(10);
  const { data: posts = [], isLoading } = useGalleryPosts(undefined, limit);

  // Lightbox state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleOpen = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);
  const handleClose = useCallback(() => setSelectedIndex(null), []);
  const handlePrev = useCallback(
    () => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i)),
    [],
  );
  const handleNext = useCallback(
    () =>
      setSelectedIndex((i) =>
        i !== null && i < posts.length - 1 ? i + 1 : i,
      ),
    [posts.length],
  );

  return (
    <PageLayout>
      <SEOHead
        title="The Pebric Pack"
        description="A curated gallery of our community. Share your moments in Pebric luxury."
        keywords="pet gallery, pet photos, Pebric pets, pet fashion photos, The Pebric Pack"
      />
      {/* Lightbox */}
      {selectedIndex !== null && posts[selectedIndex] && (
        <PhotoLightbox
          post={posts[selectedIndex]}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < posts.length - 1}
        />
      )}

      {/* Hero */}
      <section className="bg-background pt-24 pb-12">
        <div className="container mx-auto px-6 text-center">
          <h1 className="font-display text-4xl font-medium text-foreground md:text-5xl lg:text-6xl">
            The Pebric Pack
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-body text-sm text-muted-foreground md:text-base">
            A curated gallery of our community. Share your moments in Pebric luxury.
          </p>
          <div className="mt-8 mb-4">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.3em] text-[#C6A87C] md:text-xs">
              #PEBRICLIFE
            </span>
          </div>
          <div className="mt-8">
            <UploadDialog />
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="container mx-auto px-6 py-6 md:py-8">
        {isLoading && posts.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl">
              No photos yet
            </h3>
            <p className="mt-2 text-muted-foreground">
              Be the first to share your pet!
            </p>
          </div>
        ) : (
          <>
            <div className="columns-1 gap-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5">
              {posts.map((post, index) => (
                <GalleryCard
                  key={post.id}
                  post={post}
                  onOpen={() => handleOpen(index)}
                  showApprovalStatus={false}
                />
              ))}
            </div>
            
            {!isLoading && posts.length >= limit && (
              <div className="mt-16 flex justify-center pb-8">
                <Button
                  variant="outline"
                  onClick={() => setLimit((l) => l + 10)}
                  className="h-12 border-foreground px-8 font-body text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-foreground hover:text-background"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </PageLayout>
  );
}
