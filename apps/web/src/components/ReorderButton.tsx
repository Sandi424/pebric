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
  const { cartItems, addToCart, updateQuantity } = useCart();
  const navigate = useNavigate();

  const handleReorder = async () => {
    setIsReordering(true);
    try {
      const groups = new Map<
        string,
        { productId: string; ownerSize: string; petSize: string; quantity: number }
      >();

      for (const item of orderItems) {
        if (!item.product_id) continue;

        const ownerSize = CartItemModel.normalizeSize(item.size ?? "N/A");
        const petSize = CartItemModel.normalizeSize(item.pet_size ?? "N/A");
        const key = CartItemModel.generateKey(item.product_id, ownerSize, petSize);
        const existing = groups.get(key);
        const quantity = (existing?.quantity || 0) + (item.quantity || 0);
        groups.set(key, { productId: item.product_id, ownerSize, petSize, quantity });
      }

      const productIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.productId)));
      if (productIds.length === 0) {
        toast.error("No items to reorder");
        return;
      }

      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, slug, is_active")
        .in("id", productIds);

      if (error) throw error;

      const byId = new Map<string, (typeof products)[number]>();
      (products || []).forEach((p) => byId.set(p.id, p));

      let addedCount = 0;
      let skippedCount = 0;
      let processedCount = 0;

      for (const group of groups.values()) {
        const product = byId.get(group.productId);
        if (!product || product.is_active === false) {
          skippedCount++;
          continue;
        }
        processedCount++;

        const ownerSize = group.ownerSize;
        const petSize = group.petSize;
        const basePrice = Number(product.price || 0);
        const isMatchingSet = ownerSize !== "N/A" && petSize !== "N/A";
        const price = isMatchingSet ? basePrice : Math.round(basePrice * 0.5);
        const name = isMatchingSet
          ? `${product.name} (Matching Set)`
          : ownerSize !== "N/A"
            ? `${product.name} (Owner Only)`
            : `${product.name} (Pet Only)`;

        // Derive per-slot quantities correctly:
        // For a matching set (combo) both owner and pet get the full quantity.
        // For owner-only, only ownerQty is set; for pet-only, only petQty is set.
        const ownerQty = ownerSize !== "N/A" ? group.quantity : 0;
        const petQty = petSize !== "N/A" ? group.quantity : 0;

        const existingInCart = cartItems.find((ci) =>
          CartItemModel.generateKey(ci.id, ci.ownerSize, ci.petSize) ===
          CartItemModel.generateKey(product.id, ownerSize, petSize)
        );

        const targetOwnerQty = (existingInCart?.ownerQuantity || 0) + ownerQty;
        const targetPetQty = (existingInCart?.petQuantity || 0) + petQty;

        if (!existingInCart) {
          addToCart({
            id: product.id,
            name,
            price,
            image: product.image_url || "/product-1.jpg",
            ownerSize,
            petSize,
            slug: product.slug,
            ownerQuantity: ownerQty,
            petQuantity: petQty,
          });
          addedCount++;
        }

        if (targetOwnerQty > 0 || targetPetQty > 0) {
          await updateQuantity(product.id, ownerSize, petSize, targetOwnerQty, targetPetQty);
        }
      }

      if (processedCount > 0) {
        if (skippedCount > 0) {
          toast.warning(`Some items were unavailable (${skippedCount}). Review your cart.`, {
            description: "We added what we could from your previous order.",
          });
          navigate("/cart");
          return;
        }

        toast.success("Reorder ready for checkout");
        navigate("/checkout");
      } else {
        toast.error("Items are no longer available");
      }
    } catch (error) {
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
