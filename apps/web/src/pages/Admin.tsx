import { useCallback, useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout, adminNavGroups } from "@/components/layouts/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package,
  Users,
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  Save,
  Upload,
  X,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  IndianRupee,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCollections, useCategories } from "@/hooks/useProducts";
import { CouponsManager } from "@/components/admin/CouponsManager";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { LowStockAlerts } from "@/components/admin/LowStockAlerts";
import { ReturnsManager } from "@/components/admin/ReturnsManager";
import { SupportManager } from "@/components/admin/SupportManager";
import { AuditLogsViewer } from "@/components/admin/AuditLogsViewer";
import { FlashSalesManager } from "@/components/admin/FlashSalesManager";
import { ProductBundlesManager } from "@/components/admin/ProductBundlesManager";
import { DynamicPricingManager } from "@/components/admin/DynamicPricingManager";
import { AbandonedCartsManager } from "@/components/admin/AbandonedCartsManager";
import { GDPRRequestsManager } from "@/components/admin/GDPRRequestsManager";
import { SatisfactionDashboard } from "@/components/admin/SatisfactionDashboard";
import { RTOAnalytics } from "@/components/admin/RTOAnalytics";
import { CourierPanel } from "@/components/admin/CourierPanel";
import { PaymentReconciliation } from "@/components/admin/PaymentReconciliation";
import { RevenueDashboard } from "@/components/admin/RevenueDashboard";
import { CustomerLocationHeatmap } from "@/components/admin/CustomerLocationHeatmap";
import { DeliverySLADashboard } from "@/components/admin/DeliverySLADashboard";
import { CampaignManager } from "@/components/admin/CampaignManager";
import { InfluencerManager } from "@/components/admin/InfluencerManager";
import { ImageModerationLogs } from "@/components/admin/ImageModerationLogs";
import { RateLimitDashboard } from "@/components/admin/RateLimitDashboard";
import { HeroSlidesManager } from "@/components/admin/HeroSlidesManager";
import { PromoBannersManager } from "@/components/admin/PromoBannersManager";
import { FAQManager } from "@/components/admin/FAQManager";
import { FeaturesManager } from "@/components/admin/FeaturesManager";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";
import { NewsletterManager } from "@/components/admin/NewsletterManager";
import { InstagramManager } from "@/components/admin/InstagramManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { SEOHead } from "@/components/SEOHead";
import { useRealtimeChannel } from "@/hooks/useRealtime";
import { Separator } from "@/components/ui/separator";
import { compressImageToWebP } from "@/lib/image-compress";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  stock: number;
  category_id: string | null;
  collection_id: string | null;
  sizes: string[] | null;
  pet_sizes: string[] | null;
  features: string[] | null;
  images: string[] | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string | null;
  subtotal: number;
  shipping_cost: number | null;
  tax: number | null;
  total: number;
  created_at: string | null;
  updated_at: string | null;
  user_id: string | null;
  payment_method: string | null;
  payment_status: string | null;
  shipping_address: OrderAddress | null;
  billing_address: OrderAddress | null;
  notes: string | null;
  carrier: string | null;
  tracking_number: string | null;
  payment_id: string | null;
  gift_wrap: boolean | null;
  gift_message: string | null;
  gift_wrap_price: number | null;
  refund_status: string | null;
  refund_amount: number | null;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  size: string | null;
  pet_size: string | null;
  unit_price: number;
  total_price: number;
}

interface OrderAddress {
  full_name?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

function formatCurrency(value: number | null | undefined) {
  return `₹${(value ?? 0).toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function formatEnumText(
  value: string | null | undefined,
  fallback = "Not available",
) {
  if (!value) return fallback;

  return value.replace(/_/g, " ");
}

function getAddressName(address: OrderAddress | null | undefined) {
  if (!address) return "Not provided";

  return (
    address.full_name ||
    [address.firstName, address.lastName].filter(Boolean).join(" ") ||
    "Not provided"
  );
}

function getAddressLines(address: OrderAddress | null | undefined) {
  if (!address) return [];

  const postalCode = address.postal_code || address.postalCode;

  return [
    getAddressName(address),
    address.address,
    [address.city, postalCode].filter(Boolean).join(", "),
    address.country,
    address.phone ? `Phone: ${address.phone}` : null,
    address.email ? `Email: ${address.email}` : null,
  ].filter((line): line is string => Boolean(line));
}

function getOrderStatusClass(status: string | null) {
  switch (status) {
    case "delivered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "shipped":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "confirmed":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getPaymentStatusClass(status: string | null) {
  switch (status) {
    case "paid":
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

const defaultSizes = ["XS", "S", "M", "L", "XL"];
const defaultPetSizes = ["XS", "S", "M", "L"];
const validAdminSections = new Set(
  adminNavGroups.flatMap((group) => group.items.map((item) => item.id)),
);

export default function Admin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const realtimeRefreshTimer = useRef<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string>("");
  const [isMigrating, setIsMigrating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { data: collections = [] } = useCollections();
  const { data: categories = [] } = useCategories();
  const sectionParam = searchParams.get("section");
  const activeSection =
    sectionParam && validAdminSections.has(sectionParam)
      ? sectionParam
      : "dashboard";
  const normalizedOrderSearchQuery = orderSearchQuery.trim().toLowerCase();
  const filteredOrders = normalizedOrderSearchQuery
    ? orders.filter((order) =>
        order.id.toLowerCase().includes(normalizedOrderSearchQuery),
      )
    : orders;
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;

  const [newProduct, setNewProduct] = useState({
    name: "",
    slug: "",
    price: 0,
    original_price: null as number | null,
    description: "",
    image_url: "",
    stock: 100,
    category_id: "",
    collection_id: "",
    sizes: defaultSizes,
    pet_sizes: defaultPetSizes,
    features: [
      "Premium quality materials",
      "Matching design",
      "Machine washable",
    ],
    is_active: true,
    is_best_seller: false,
    is_new_arrival: true,
    images: [] as string[],
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      toast.error("Access Denied", {
        description: "You do not have permission to view the admin panel.",
      });
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchData = useCallback(async () => {
    if (products.length === 0) setIsLoading(true);

    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .order("created_at", { ascending: false }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setProducts((productsRes.data ?? []) as Product[]);
      setOrders((ordersRes.data ?? []) as Order[]);
    } finally {
      setIsLoading(false);
    }
  }, [products.length]);

  const runImageMigration = async () => {
    setIsMigrating(true);
    setMigrationStatus("Fetching active products...");
    
    try {
      const { data: dbProducts, error: fetchError } = await supabase
        .from("products")
        .select("*");
      
      if (fetchError) throw fetchError;
      if (!dbProducts || dbProducts.length === 0) {
        setMigrationStatus("No products found.");
        setIsMigrating(false);
        return;
      }

      let migratedCount = 0;
      let totalImagesChecked = 0;

      for (let pIndex = 0; pIndex < dbProducts.length; pIndex++) {
        const product = dbProducts[pIndex];
        setMigrationStatus(`Checking product [${pIndex + 1}/${dbProducts.length}]: ${product.name}`);
        
        let needsUpdate = false;
        let newImageUrl = product.image_url;
        const newImages = [...(product.images || [])];

        // 1. Check main image_url
        if (product.image_url && product.image_url.includes("supabase.co") && !product.image_url.toLowerCase().endsWith(".webp")) {
          setMigrationStatus(`Compressing main image for ${product.name}...`);
          try {
            const compressedBlob = await compressImageToWebP(product.image_url, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
            const fileName = `${Date.now()}-migrated-${Math.random().toString(36).substring(7)}.webp`;
            const filePath = `products/${fileName}`;
            
            const { error: uploadErr } = await supabase.storage
              .from("product-images")
              .upload(filePath, compressedBlob, { contentType: "image/webp" });
            
            if (uploadErr) throw uploadErr;

            const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(filePath);
            newImageUrl = publicUrl;
            needsUpdate = true;
            migratedCount++;
          } catch (err) {
            console.error(`Failed to migrate main image for product ${product.id}:`, err);
          }
        }

        // 2. Check images gallery array
        for (let i = 0; i < newImages.length; i++) {
          totalImagesChecked++;
          const imgUrl = newImages[i];
          if (imgUrl && imgUrl.includes("supabase.co") && !imgUrl.toLowerCase().endsWith(".webp")) {
            setMigrationStatus(`Compressing gallery image [${i + 1}/${newImages.length}] for ${product.name}...`);
            try {
              const compressedBlob = await compressImageToWebP(imgUrl, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
              const fileName = `${Date.now()}-migrated-${Math.random().toString(36).substring(7)}.webp`;
              const filePath = `products/${fileName}`;
              
              const { error: uploadErr } = await supabase.storage
                .from("product-images")
                .upload(filePath, compressedBlob, { contentType: "image/webp" });
              
              if (uploadErr) throw uploadErr;

              const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(filePath);
              newImages[i] = publicUrl;
              needsUpdate = true;
              migratedCount++;
            } catch (err) {
              console.error(`Failed to migrate gallery image ${i} for product ${product.id}:`, err);
            }
          }
        }

        if (needsUpdate) {
          setMigrationStatus(`Saving product updates for ${product.name} to DB...`);
          const { error: updateErr } = await supabase
            .from("products")
            .update({
              image_url: newImageUrl,
              images: newImages
            })
            .eq("id", product.id);
          
          if (updateErr) {
            console.error(`Failed to save database update for product ${product.id}:`, updateErr);
          }
        }
      }

      setMigrationStatus(`Migration completed successfully! Processed all products. Optimized ${migratedCount} image(s).`);
      toast.success(`Optimized ${migratedCount} images to WebP!`);
      fetchData();
      // Auto-backup disabled — use the manual Backup Catalog button.
    } catch (err) {
      console.error("Migration error:", err);
      setMigrationStatus(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  // ─── MANUAL BACKUP ──────────────────────────────────────────────────────────
  // Only runs when admin clicks the "Backup Catalog" button.
  // Downloads all product images to the local backup/images folder and
  // writes the complete products_catalog.json with every product field.
  const triggerLocalBackup = async () => {
    try {
      toast.info("Fetching catalog from database...");

      const [productsRes, categoriesRes, collectionsRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase.from("collections").select("*").order("name")
      ]);

      if (productsRes.error) throw new Error(`Products fetch failed: ${productsRes.error.message}`);
      if (categoriesRes.error) throw new Error(`Categories fetch failed: ${categoriesRes.error.message}`);
      if (collectionsRes.error) throw new Error(`Collections fetch failed: ${collectionsRes.error.message}`);

      const allProducts = productsRes.data || [];
      const allCategories = categoriesRes.data || [];
      const allCollections = collectionsRes.data || [];

      if (allProducts.length === 0) {
        toast.warning("Backup skipped: catalog has no products. Add products first, then click Backup Catalog.");
        return;
      }

      toast.info(`Saving ${allProducts.length} product(s) + downloading images...`);

      // Send full payload to the Vite server-side backup plugin.
      // The plugin writes products_catalog.json AND downloads all
      // Supabase Storage images to backup/images/<slug>/
      const res = await fetch("/api/backup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: allProducts,
          categories: allCategories,
          collections: allCollections
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Server-side backup failed.");
      }

      console.log(`[Backup] ✓ Saved ${allProducts.length} product(s), ${allCategories.length} categories, ${allCollections.length} collections.`);
      toast.success(`✅ Backup complete: ${allProducts.length} product(s) saved to local catalog.`);
    } catch (err) {
      console.error("[Backup] Failed:", err);
      toast.error("Backup failed: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const uploadLocalImageToSupabase = async (localPath: string): Promise<string> => {
    const fetchUrl = localPath.replace("local://", "/api/backup/");
    const filename = localPath.split("/").pop() || "image.webp";
    
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`Failed to fetch local image: ${localPath}`);
    const blob = await response.blob();
    
    const fileExt = filename.split(".").pop() || "webp";
    const filePath = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`
      });
      
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return publicUrl;
  };

  const handleLocalRestore = async () => {
    setIsLoading(true);
    toast.info("Loading backup file...");
    try {
      const res = await fetch("/api/backup/load");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Backup file not found.");
      }
      
      const backupData = await res.json();
      const { products = [], categories = [], collections = [] } = backupData;

      if (products.length === 0) {
        toast.error("Backup has no products to restore. The backup was saved when the catalog was empty. Please add products and run Backup Catalog first.");
        return;
      }

      toast.info(`Restoring ${categories.length} categories...`);
      for (const cat of categories) {
        const { error } = await supabase.from("categories").upsert({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          image_url: cat.image_url
        }, { onConflict: "slug" });
        if (error) console.warn(`Category upsert warning (${cat.name}):`, error.message);
      }

      toast.info(`Restoring ${collections.length} collections...`);
      for (const col of collections) {
        const { error } = await supabase.from("collections").upsert({
          id: col.id,
          name: col.name,
          slug: col.slug,
          description: col.description,
          image_url: col.image_url
        }, { onConflict: "slug" });
        if (error) console.warn(`Collection upsert warning (${col.name}):`, error.message);
      }

      toast.info(`Restoring ${products.length} product(s)...`);
      let restoredCount = 0;
      let skippedCount = 0;

      for (const prod of products) {
        const restoredProduct = { ...prod };
        
        // Strip computed join fields that are not real columns
        delete restoredProduct.category;
        delete restoredProduct.collection;

        // Handle main image restore from local backup
        if (prod.image_url && prod.image_url.startsWith("local://")) {
          try {
            restoredProduct.image_url = await uploadLocalImageToSupabase(prod.image_url);
          } catch (err) {
            console.error(`Failed to restore main image for ${prod.name}:`, err);
            restoredProduct.image_url = null;
          }
        }
        
        // Handle gallery images restore
        if (Array.isArray(prod.images)) {
          const restoredGallery = [];
          for (const imgUrl of prod.images) {
            if (imgUrl && imgUrl.startsWith("local://")) {
              try {
                const newUrl = await uploadLocalImageToSupabase(imgUrl);
                restoredGallery.push(newUrl);
              } catch (err) {
                console.error(`Failed to restore gallery image ${imgUrl}:`, err);
                restoredGallery.push(imgUrl);
              }
            } else {
              restoredGallery.push(imgUrl);
            }
          }
          restoredProduct.images = restoredGallery;
        }
        
        const { error } = await supabase.from("products").upsert(restoredProduct, { onConflict: "slug" });
        if (error) {
          console.error(`Failed to restore product ${prod.name}:`, error.message);
          skippedCount++;
        } else {
          restoredCount++;
        }
      }
      
      const summary = skippedCount > 0
        ? `Restored ${restoredCount} product(s). ${skippedCount} skipped (already exist or error).`
        : `Successfully restored ${restoredCount} product(s)!`;

      toast.success(summary);
      fetchData();
    } catch (err) {
      console.error("[Restore] Catalog restoration failed:", err);
      toast.error("Restoration failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void fetchData().catch((error) => {
        console.error("Failed to load admin data:", error);
        toast.error("Failed to load admin data");
      });
    }
  }, [isAdmin, fetchData]);

  useRealtimeChannel(
    "admin-orders-products-realtime",
    isAdmin
      ? [
          { table: "orders", event: "*" },
          { table: "products", event: "*" },
        ]
      : [],
    () => {
      if (!isAdmin) return;
      if (realtimeRefreshTimer.current)
        window.clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = window.setTimeout(() => {
        void fetchData().catch((error) => {
          console.error("Failed to refresh admin data:", error);
        });
      }, 250);
    },
    isAdmin,
  );

  const handleSectionChange = (section: string) => {
    const nextSection = validAdminSections.has(section) ? section : "dashboard";
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextSection === "dashboard") {
      nextSearchParams.delete("section");
    } else {
      nextSearchParams.set("section", nextSection);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleRefreshOrders = async () => {
    setIsRefreshingOrders(true);

    try {
      await fetchData();
    } catch (error) {
      console.error("Failed to refresh orders:", error);
      toast.error("Failed to refresh orders");
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit = false,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      let uploadFile: File | Blob = file;
      let fileExt = "webp";
      
      try {
        uploadFile = await compressImageToWebP(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
      } catch (err) {
        console.error("Compression failed, uploading original:", err);
        fileExt = file.name.split(".").pop() || "png";
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, uploadFile, {
          contentType: `image/${fileExt}`
        });

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    if (isEdit) {
      const currentImages = editForm.images || [];
      const mainImage = editForm.image_url || uploadedUrls[0];
      setEditForm({
        ...editForm,
        images: [...currentImages, ...uploadedUrls],
        image_url: mainImage,
      });
    } else {
      const currentImages = newProduct.images || [];
      const mainImage = newProduct.image_url || uploadedUrls[0];
      setNewProduct({
        ...newProduct,
        images: [...currentImages, ...uploadedUrls],
        image_url: mainImage,
      });
    }

    toast.success("Images uploaded successfully");
    setUploading(false);
  };

  const removeImage = (index: number, isEdit: boolean) => {
    if (isEdit) {
      const currentImages = [...(editForm.images || [])];
      const removedUrl = currentImages[index];
      currentImages.splice(index, 1);
      let newMainImage = editForm.image_url;
      if (editForm.image_url === removedUrl) {
        newMainImage = currentImages.length > 0 ? currentImages[0] : null;
      }
      setEditForm({
        ...editForm,
        images: currentImages,
        image_url: newMainImage,
      });
    } else {
      const currentImages = [...(newProduct.images || [])];
      const removedUrl = currentImages[index];
      currentImages.splice(index, 1);
      let newMainImage = newProduct.image_url;
      if (newProduct.image_url === removedUrl) {
        newMainImage = currentImages.length > 0 ? currentImages[0] : "";
      }
      setNewProduct({
        ...newProduct,
        images: currentImages,
        image_url: newMainImage,
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product.id);
    setEditForm(product);
  };

  const invalidateProductQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product"] });
    queryClient.invalidateQueries({ queryKey: ["product-by-id"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["collections"] });
    try {
      localStorage.removeItem("pebric-query-cache-v3");
    } catch (e) {
      console.warn("Failed to clear local storage cache");
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    let finalStock = editForm.stock ?? 0;
    if (finalStock < 0) finalStock = 0;
    let finalIsActive = editForm.is_active;
    if (finalStock === 0) finalIsActive = false;

    const { error } = await supabase
      .from("products")
      .update({
        name: editForm.name,
        price: editForm.price,
        original_price: editForm.original_price,
        stock: finalStock,
        is_active: finalIsActive,
        is_best_seller: editForm.is_best_seller,
        is_new_arrival: editForm.is_new_arrival,
        image_url: editForm.image_url,
        images: editForm.images,
        description: editForm.description,
        category_id: editForm.category_id || null,
        collection_id: editForm.collection_id || null,
      })
      .eq("id", editingProduct);

    if (error) {
      toast.error("Failed to update product");
      return;
    }

    toast.success("Product updated");
    setEditingProduct(null);
    invalidateProductQueries();
    fetchData();
    // Auto-backup disabled — use the manual Backup Catalog button.
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // First clean up dependent records that don't have ON DELETE CASCADE
    await supabase.from("wishlist_items").delete().eq("product_id", id);
    await supabase.from("cart_items").delete().eq("product_id", id);
    await supabase.from("recently_viewed").delete().eq("product_id", id);
    await supabase.from("product_occasions").delete().eq("product_id", id);

    // Now delete the product itself
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      if (error.message.includes("foreign key constraint") || error.message.includes("order_items")) {
        toast.error(
          "Cannot delete product because it is part of an existing order.",
        );
      } else {
        toast.error(`Failed to delete product: ${error.message}`);
      }
      return;
    }

    toast.success("Product deleted successfully");
    invalidateProductQueries();
    fetchData();
    // NOTE: Do NOT trigger backup after delete — it would overwrite the backup with an empty catalog.
    // Use the manual "Backup Catalog" button before deleting if you want a snapshot.
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.slug || !newProduct.price) {
      toast.error("Please fill in all required fields");
      return;
    }

    let finalStock = newProduct.stock ?? 0;
    if (finalStock < 0) finalStock = 0;
    let finalIsActive = newProduct.is_active;
    if (finalStock === 0) finalIsActive = false;

    const { error } = await supabase.from("products").insert({
      name: newProduct.name,
      slug: newProduct.slug,
      price: newProduct.price,
      original_price: newProduct.original_price,
      description: newProduct.description,
      image_url: newProduct.image_url || null,
      stock: finalStock,
      category_id: newProduct.category_id || null,
      collection_id: newProduct.collection_id || null,
      sizes: newProduct.sizes,
      pet_sizes: newProduct.pet_sizes,
      features: newProduct.features,
      is_active: finalIsActive,
      is_best_seller: newProduct.is_best_seller,
      is_new_arrival: newProduct.is_new_arrival,
      images: newProduct.images,
    });

    if (error) {
      toast.error("Failed to add product");
      return;
    }

    toast.success("Product added");
    setIsAddingProduct(false);
    setNewProduct({
      name: "",
      slug: "",
      price: 0,
      original_price: null,
      description: "",
      image_url: "",
      stock: 100,
      category_id: "",
      collection_id: "",
      sizes: defaultSizes,
      pet_sizes: defaultPetSizes,
      features: [
        "Premium quality materials",
        "Matching design",
        "Machine washable",
      ],
      is_active: true,
      is_best_seller: false,
      is_new_arrival: true,
      images: [],
    });
    invalidateProductQueries();
    fetchData();
    // Auto-backup disabled — use the manual Backup Catalog button.
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        status: newStatus as
          | "pending"
          | "confirmed"
          | "processing"
          | "shipped"
          | "delivered"
          | "cancelled",
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order status");
      return;
    }

    toast.success("Order status updated");
    fetchData();
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      >
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) return null;

  // ─── Stat Cards ─────────────────────────────────────────────
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const activeProducts = products.filter((p) => p.is_active).length;
  const newOrders = orders.filter((o) => o.status === "confirmed").length;

  const statsCards = [
    {
      label: "Total Products",
      value: products.length,
      sub: `${activeProducts} active`,
      icon: <Package className="h-5 w-5" />,
      gradient: "from-blue-500/10 to-blue-600/5",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Orders",
      value: orders.length,
      sub: `${newOrders} new`,
      icon: <ShoppingBag className="h-5 w-5" />,
      gradient: "from-amber-500/10 to-amber-600/5",
      iconColor: "text-amber-600",
    },
    {
      label: "Revenue",
      value: `₹${totalRevenue.toLocaleString("en-IN")}`,
      sub: "All time",
      icon: <IndianRupee className="h-5 w-5" />,
      gradient: "from-emerald-500/10 to-emerald-600/5",
      iconColor: "text-emerald-600",
    },
    {
      label: "Live Chat",
      value: "Open",
      sub: "Support dashboard",
      icon: <MessageCircle className="h-5 w-5" />,
      gradient: "from-purple-500/10 to-purple-600/5",
      iconColor: "text-purple-600",
      clickable: true,
      onClick: () => navigate("/admin/chat"),
    },
  ];

  // ─── Section Content Renderer ───────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  onClick={card.onClick}
                  className={`group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${card.gradient} p-5 transition-all duration-200 ${
                    card.clickable
                      ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {card.sub}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg bg-background/80 p-2.5 ${card.iconColor}`}
                    >
                      {card.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleSectionChange("products")}>
                <Package className="mr-2 h-4 w-4" /> Manage Products
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSectionChange("orders")}
              >
                <ShoppingBag className="mr-2 h-4 w-4" /> View Orders
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSectionChange("analytics")}
              >
                <TrendingUp className="mr-2 h-4 w-4" /> Analytics
              </Button>
            </div>

            {/* Recent Orders Preview */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Orders</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSectionChange("orders")}
                >
                  View All →
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Order
                        </th>
                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.slice(0, 5).map((order) => (
                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-muted/20"
                        >
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {order.order_number}
                              </p>
                              <p className="break-all font-mono text-[11px] text-muted-foreground">
                                {order.id}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getAddressName(order.shipping_address)}
                              </p>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <div className="space-y-1">
                              <p className="text-sm text-foreground">
                                {order.created_at
                                  ? new Date(
                                      order.created_at,
                                    ).toLocaleDateString()
                                  : "Not available"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {order.created_at
                                  ? new Date(
                                      order.created_at,
                                    ).toLocaleTimeString()
                                  : ""}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-foreground">
                              {formatCurrency(order.total)}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {formatEnumText(
                                order.payment_method,
                                "Payment n/a",
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`capitalize ${getOrderStatusClass(order.status)}`}
                            >
                              {order.status || "pending"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );

      case "products":
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Products</h2>
                <p className="text-sm text-muted-foreground">
                  {products.length} products total
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={triggerLocalBackup}
                  className="border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Save className="mr-2 h-4 w-4" /> Backup Catalog
                </Button>

                <Button
                  variant="outline"
                  onClick={handleLocalRestore}
                  className="border-blue-600/30 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Upload className="mr-2 h-4 w-4" /> Restore Catalog
                </Button>

                <Button
                  variant="outline"
                  onClick={runImageMigration}
                  disabled={isMigrating}
                  className="border-[#8b6540]/30 text-[#8b6540] hover:bg-[#8b6540]/10 hover:text-[#8b6540]"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isMigrating ? "animate-spin" : ""}`} />
                  {isMigrating ? "Optimizing..." : "Optimize DB Images"}
                </Button>

                <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="slug">Slug *</Label>
                        <Input
                          id="slug"
                          value={newProduct.slug}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              slug: e.target.value,
                            })
                          }
                          placeholder="product-name"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="price">Price *</Label>
                        <Input
                          id="price"
                          type="number"
                          value={newProduct.price}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="original_price">Original Price</Label>
                        <Input
                          id="original_price"
                          type="number"
                          value={newProduct.original_price || ""}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              original_price: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newProduct.description}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="collection">Collection</Label>
                        <select
                          id="collection"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newProduct.collection_id}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              collection_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select collection</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newProduct.category_id}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              category_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label>Product Images</Label>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {newProduct.images &&
                          newProduct.images.length > 0 &&
                          newProduct.images.map((img, index) => (
                            <div
                              key={index}
                              className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted group"
                            >
                              <img
                                src={img}
                                alt={`Preview ${index}`}
                                className="h-full w-full object-cover"
                              />
                              <button
                                onClick={() => removeImage(index, false)}
                                className="absolute right-1 top-1 rounded-full bg-background p-1 opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              {newProduct.image_url === img && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white text-center py-0.5">
                                  Main
                                </div>
                              )}
                            </div>
                          ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploading ? "Uploading..." : "Upload Images"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, false)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="stock">Stock</Label>
                        <Input
                          id="stock"
                          type="number"
                          min="0"
                          value={newProduct.stock}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setNewProduct({
                              ...newProduct,
                              stock: val,
                              is_active:
                                val === 0
                                  ? false
                                  : newProduct.stock === 0 && val > 0
                                    ? true
                                    : newProduct.is_active,
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="is_best_seller"
                          checked={newProduct.is_best_seller}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              is_best_seller: e.target.checked,
                            })
                          }
                        />
                        <Label htmlFor="is_best_seller">Best Seller</Label>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="is_new_arrival"
                          checked={newProduct.is_new_arrival}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              is_new_arrival: e.target.checked,
                            })
                          }
                        />
                        <Label htmlFor="is_new_arrival">New Arrival</Label>
                      </div>
                    </div>

                    <Button onClick={handleAddProduct} className="w-full">
                      Add Product
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

              {/* Edit Product Dialog */}
              <Dialog
                open={!!editingProduct}
                onOpenChange={(open) => !open && setEditingProduct(null)}
              >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Edit Product: {editForm.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit-name">Product Name *</Label>
                        <Input
                          id="edit-name"
                          value={editForm.name || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-slug">Slug *</Label>
                        <Input
                          id="edit-slug"
                          value={editForm.slug || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, slug: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit-price">Price *</Label>
                        <Input
                          id="edit-price"
                          type="number"
                          value={editForm.price || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-original_price">
                          Original Price
                        </Label>
                        <Input
                          id="edit-original_price"
                          type="number"
                          value={editForm.original_price || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              original_price: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editForm.description || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit-collection">Collection</Label>
                        <select
                          id="edit-collection"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editForm.collection_id || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              collection_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select collection</option>
                          {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="edit-category">Category</Label>
                        <select
                          id="edit-category"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editForm.category_id || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              category_id: e.target.value,
                            })
                          }
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label>Product Images</Label>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {editForm.images &&
                          editForm.images.length > 0 &&
                          editForm.images.map((img, index) => (
                            <div
                              key={index}
                              className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted group"
                            >
                              <img
                                src={img}
                                alt={`Preview ${index}`}
                                className="h-full w-full object-cover"
                              />
                              <button
                                onClick={() => removeImage(index, true)}
                                className="absolute right-1 top-1 rounded-full bg-background p-1 opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              {editForm.image_url === img && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[10px] text-white text-center py-0.5">
                                  Main
                                </div>
                              )}
                            </div>
                          ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {uploading ? "Uploading..." : "Upload Images"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, true)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit-stock">Stock</Label>
                        <Input
                          id="edit-stock"
                          type="number"
                          min="0"
                          value={editForm.stock ?? ""}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setEditForm({
                              ...editForm,
                              stock: val,
                              is_active:
                                val === 0
                                  ? false
                                  : editForm.stock === 0 && val > 0
                                    ? true
                                    : editForm.is_active,
                            });
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-4 pt-6 sm:col-span-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.is_active || false}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                is_active: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm font-medium">
                            Active Status
                          </span>
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.is_best_seller || false}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  is_best_seller: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm">Best Seller</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.is_new_arrival || false}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  is_new_arrival: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm">New Arrival</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        onClick={() => setEditingProduct(null)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>Save Changes</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {migrationStatus && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 font-medium">
                {migrationStatus}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Product
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                        Price
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.image_url && (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <span className="font-medium text-sm">
                                {product.name}
                              </span>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                ₹{product.price}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="text-sm">₹{product.price}</span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-sm">{product.stock}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              product.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "orders":
        return (
          <>
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Orders</h2>
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredOrders.length} of {orders.length} orders
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 md:max-w-xl md:flex-row md:justify-end">
                  <div className="relative flex-1">
                    <Input
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search by order ID"
                      className={`h-10 ${orderSearchQuery ? "pr-10" : ""}`}
                    />
                    {orderSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOrderSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Clear order search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handleRefreshOrders();
                    }}
                    disabled={isRefreshingOrders}
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${isRefreshingOrders ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Order
                        </th>
                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.length > 0 ? (
                        filteredOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="transition-colors hover:bg-muted/20"
                          >
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {order.order_number}
                                </p>
                                <p className="break-all font-mono text-[11px] text-muted-foreground">
                                  {order.id}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {getAddressName(order.shipping_address)}
                                </p>
                                <p className="text-xs text-muted-foreground sm:hidden">
                                  {order.created_at
                                    ? formatDateTime(order.created_at)
                                    : "Not available"}
                                </p>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">
                              <div className="space-y-1">
                                <p className="text-sm text-foreground">
                                  {order.created_at
                                    ? new Date(
                                        order.created_at,
                                      ).toLocaleDateString()
                                    : "Not available"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {order.created_at
                                    ? new Date(
                                        order.created_at,
                                      ).toLocaleTimeString()
                                    : ""}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground">
                                {formatCurrency(order.total)}
                              </p>
                              <p className="text-xs capitalize text-muted-foreground">
                                {formatEnumText(
                                  order.payment_method,
                                  "Payment n/a",
                                )}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={order.status || "pending"}
                                onChange={(e) =>
                                  handleStatusChange(order.id, e.target.value)
                                }
                                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedOrderId(order.id)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-sm text-muted-foreground"
                          >
                            No orders found for that order ID.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <Dialog
              open={Boolean(selectedOrder)}
              onOpenChange={(open) => {
                if (!open) setSelectedOrderId(null);
              }}
            >
              <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden p-0">
                {selectedOrder && (
                  <>
                    <DialogHeader className="border-b border-border px-6 py-5 pr-14">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2 text-left">
                            <DialogTitle className="text-xl font-semibold">
                              Order Details
                            </DialogTitle>
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">
                                Placed on{" "}
                                {formatDateTime(selectedOrder.created_at)}
                              </p>
                              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Order ID
                                </span>
                                <span className="break-all font-mono text-xs text-foreground">
                                  {selectedOrder.id}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`capitalize ${getOrderStatusClass(selectedOrder.status)}`}
                            >
                              {selectedOrder.status || "pending"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`capitalize ${getPaymentStatusClass(selectedOrder.payment_status)}`}
                            >
                              {selectedOrder.payment_status || "unpaid"}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Customer
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {getAddressName(selectedOrder.shipping_address)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedOrder.shipping_address?.email ||
                                "Email not provided"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedOrder.shipping_address?.phone ||
                                "Phone not provided"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Payment
                            </p>
                            <p className="mt-2 text-sm font-medium capitalize text-foreground">
                              {formatEnumText(
                                selectedOrder.payment_method,
                                "Not specified",
                              )}
                            </p>
                            <p className="mt-1 text-sm capitalize text-muted-foreground">
                              {formatEnumText(
                                selectedOrder.payment_status,
                                "Pending",
                              )}
                            </p>
                            {selectedOrder.payment_id && (
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                Payment ID: {selectedOrder.payment_id}
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Fulfillment
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {selectedOrder.carrier || "Carrier pending"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedOrder.tracking_number ||
                                "Tracking number not assigned"}
                            </p>
                            {selectedOrder.updated_at && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Updated{" "}
                                {formatDateTime(selectedOrder.updated_at)}
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Order Summary
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {formatCurrency(selectedOrder.total)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedOrder.items?.length || 0} items
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Customer ID:{" "}
                              {selectedOrder.user_id || "Guest checkout"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-xl border border-border p-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            Shipping Address
                          </h3>
                          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            {getAddressLines(selectedOrder.shipping_address)
                              .length > 0 ? (
                              getAddressLines(
                                selectedOrder.shipping_address,
                              ).map((line) => <p key={line}>{line}</p>)
                            ) : (
                              <p>Not available</p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border p-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            Billing Address
                          </h3>
                          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            {getAddressLines(selectedOrder.billing_address)
                              .length > 0 ? (
                              getAddressLines(
                                selectedOrder.billing_address,
                              ).map((line) => <p key={line}>{line}</p>)
                            ) : (
                              <p>Not available</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator className="my-6" />

                      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
                        <div className="rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-foreground">
                              Order Items
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {selectedOrder.items?.length || 0} items
                            </span>
                          </div>
                          <div className="mt-4 space-y-3">
                            {selectedOrder.items &&
                            selectedOrder.items.length > 0 ? (
                              selectedOrder.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-3 rounded-lg border border-border/80 p-3"
                                >
                                  {item.product_image ? (
                                    <img
                                      src={item.product_image}
                                      alt={item.product_name}
                                      className="h-14 w-14 rounded-md border border-border object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                                      No image
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {item.product_name}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Qty {item.quantity}
                                      {item.size ? ` • Owner ${item.size}` : ""}
                                      {item.pet_size
                                        ? ` • Pet ${item.pet_size}`
                                        : ""}
                                    </p>
                                  </div>
                                  <p className="text-sm font-medium text-foreground">
                                    {formatCurrency(item.total_price)}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No order items available.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-xl border border-border p-4">
                            <h3 className="text-sm font-semibold text-foreground">
                              Totals
                            </h3>
                            <div className="mt-3 space-y-2 text-sm">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>
                                  {formatCurrency(selectedOrder.subtotal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Shipping</span>
                                <span>
                                  {formatCurrency(selectedOrder.shipping_cost)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Tax</span>
                                <span>{formatCurrency(selectedOrder.tax)}</span>
                              </div>
                              {(selectedOrder.gift_wrap ||
                                selectedOrder.gift_wrap_price) && (
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>Gift Wrap</span>
                                  <span>
                                    {formatCurrency(
                                      selectedOrder.gift_wrap_price,
                                    )}
                                  </span>
                                </div>
                              )}
                              <Separator className="my-3" />
                              <div className="flex items-center justify-between font-semibold text-foreground">
                                <span>Total</span>
                                <span>
                                  {formatCurrency(selectedOrder.total)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border p-4">
                            <h3 className="text-sm font-semibold text-foreground">
                              Additional Details
                            </h3>
                            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Customer ID
                                </p>
                                <p className="mt-1 break-all">
                                  {selectedOrder.user_id || "Guest checkout"}
                                </p>
                              </div>
                              {selectedOrder.notes && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Notes
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap">
                                    {selectedOrder.notes}
                                  </p>
                                </div>
                              )}
                              {selectedOrder.gift_message && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Gift Message
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap">
                                    {selectedOrder.gift_message}
                                  </p>
                                </div>
                              )}
                              {selectedOrder.refund_status && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Refund
                                  </p>
                                  <p className="mt-1 capitalize">
                                    {selectedOrder.refund_status}
                                    {selectedOrder.refund_amount
                                      ? ` • ${formatCurrency(selectedOrder.refund_amount)}`
                                      : ""}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </>
        );

      // ─── Content sections (render existing manager components) ──
      case "hero-slides":
        return <HeroSlidesManager />;
      case "promo-banners":
        return <PromoBannersManager />;
      case "faqs":
        return <FAQManager />;
      case "features":
        return <FeaturesManager />;
      case "testimonials":
        return <TestimonialsManager />;
      case "newsletter":
        return <NewsletterManager />;
      case "instagram":
        return <InstagramManager />;
      case "gallery":
        return <GalleryManager />;

      // ─── Marketing sections ──
      case "coupons":
        return <CouponsManager />;
      case "flash-sales":
        return <FlashSalesManager />;
      case "bundles":
        return <ProductBundlesManager />;
      case "pricing":
        return <DynamicPricingManager />;
      case "campaigns":
        return <CampaignManager />;
      case "influencers":
        return <InfluencerManager />;

      // ─── Operations sections ──
      case "courier":
        return <CourierPanel />;
      case "sla":
        return <DeliverySLADashboard />;
      case "returns":
        return <ReturnsManager />;
      case "rto":
        return <RTOAnalytics />;
      case "support":
        return <SupportManager />;
      case "abandoned":
        return <AbandonedCartsManager />;
      case "stock":
        return <LowStockAlerts />;

      // ─── Analytics sections ──
      case "analytics":
        return <AnalyticsDashboard />;
      case "revenue":
        return <RevenueDashboard />;
      case "locations":
        return <CustomerLocationHeatmap />;
      case "payments":
        return <PaymentReconciliation />;
      case "satisfaction":
        return <SatisfactionDashboard />;

      // ─── System sections ──
      case "moderation":
        return <ImageModerationLogs />;
      case "rate-limits":
        return <RateLimitDashboard />;
      case "gdpr":
        return <GDPRRequestsManager />;
      case "logs":
        return <AuditLogsViewer />;

      // ─── Customers sections ──
      case "users":
        return <UsersManager />;

      default:
        return (
          <div className="text-muted-foreground">
            Select a section from the sidebar.
          </div>
        );
    }
  };

  return (
    <AdminLayout
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      <SEOHead
        title="Admin Dashboard"
        description="Pebric admin panel."
        noindex={true}
      />
      {renderSection()}
    </AdminLayout>
  );
}
