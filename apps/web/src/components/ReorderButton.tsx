import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/client";
import { useCart } from "@/contexts/CartContext";
import { CartItemModel } from "@/domain/models/CartItem";
import type { OrderItem } from "@/hooks/useOrders";

interface ReorderButtonProps {
  orderItems: OrderItem[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function ReorderButton({ orderItems, variant = "outline", size = "sm" }: ReorderButtonProps) {
  const [isReordering, setIsReordering] = useState(false);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const handleReorder = async () => {
    setIsReordering(true);
    try {
      const validItems = (orderItems || []).filter((item) => Boolean(item && item.product_id));
      if (validItems.length === 0) {
        toast.error("No items to reorder");
        return;
      }

      // Group items by product_id + ownerSize + petSize
      const groups = new Map<
        string,
        {
          productId: string;
          productName: string;
          productImage: string;
          unitPrice: number;
          ownerSize: string;
          petSize: string;
          quantity: number;
        }
      >();

      for (const item of validItems) {
        const ownerSize = CartItemModel.normalizeSize(item.size ?? "N/A");
        const petSize = CartItemModel.normalizeSize(item.pet_size ?? "N/A");
        const key = CartItemModel.generateKey(item.product_id!, ownerSize, petSize);
        const existing = groups.get(key);
        const quantity = (existing?.quantity || 0) + (item.quantity || 1);

        groups.set(key, {
          productId: item.product_id!,
          productName: item.product_name || "Product",
          productImage: item.product_image || "/product-1.jpg",
          unitPrice: item.unit_price || 0,
          ownerSize,
          petSize,
          quantity,
        });
      }

      const productIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.productId)));

      // Fetch live product catalog to ensure product is active and get latest pricing/slug
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, slug, is_active")
        .in("id", productIds);

      if (error) {
        console.warn("Could not query products table during reorder:", error);
      }

      const byId = new Map<string, any>();
      (products || []).forEach((p) => byId.set(p.id, p));

      let addedCount = 0;
      let skippedCount = 0;

      for (const group of groups.values()) {
        const product = byId.get(group.productId);
        if (product && product.is_active === false) {
          skippedCount++;
          continue;
        }

        const ownerSize = group.ownerSize;
        const petSize = group.petSize;
        const isMatchingSet = ownerSize !== "N/A" && petSize !== "N/A";
        const isStandard = ownerSize === "N/A" && petSize === "N/A";

        const basePrice = product ? Number(product.price || 0) : group.unitPrice;
        const price = (isMatchingSet || isStandard) ? basePrice : Math.round(basePrice * 0.5);
        const name = product
          ? (isMatchingSet
              ? `${product.name} (Matching Set)`
              : ownerSize !== "N/A"
                ? `${product.name} (Owner Only)`
                : petSize !== "N/A"
                  ? `${product.name} (Pet Only)`
                  : product.name)
          : group.productName;

        const image = product?.image_url || group.productImage || "/product-1.jpg";
        const slug = product?.slug || "product";

        const ownerQty = isStandard
          ? group.quantity
          : (ownerSize !== "N/A" ? group.quantity : 0);
        const petQty = isStandard
          ? 0
          : (petSize !== "N/A" ? group.quantity : 0);

        await addToCart({
          id: group.productId,
          name,
          price,
          image,
          ownerSize,
          petSize,
          slug,
          ownerQuantity: ownerQty,
          petQuantity: petQty,
        });

        addedCount++;
      }

      if (addedCount > 0) {
        if (skippedCount > 0) {
          toast.warning(`Some items were unavailable (${skippedCount}). Review your cart.`, {
            description: "We added available items to your cart.",
          });
        } else {
          toast.success("Items added to cart from your previous order!");
        }
        navigate("/cart");
      } else {
        toast.error("Items from this order are no longer available");
      }
    } catch (error) {
      console.error("Reorder error:", error);
      toast.error("Failed to reorder items");
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleReorder} disabled={isReordering}>
      {isReordering ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Reorder
    </Button>
  );
}
