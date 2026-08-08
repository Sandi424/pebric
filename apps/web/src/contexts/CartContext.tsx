import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useRef,
} from "react";
import { supabase } from "@/integrations/client";
import { useAuth } from "./AuthContext";
import { CartService } from "@/services/CartService";
import {
  CartItemModel,
  type RawCartItemRecord,
} from "@/domain/models/CartItem";
import { toast } from "sonner";
import { useRealtimeChannel } from "@/hooks/useRealtime";
import {
  clearTrackedAbandonedCart,
  getAbandonedCartSessionId,
  trackAbandonedCartSnapshot,
} from "@/hooks/useAbandonedCarts";
import type { Database } from "@/integrations/types";

export interface CartItem {
  id: number | string;
  name: string;
  price: number;
  image: string;
  ownerSize: string;
  petSize: string;
  quantity: number;
  slug: string;
  type: "owner" | "pet" | "combo";
  ownerQuantity: number;
  petQuantity: number;
}

export interface WishlistItem {
  id: number | string;
  name: string;
  price: number;
  image: string;
  category: string;
  slug: string;
}

interface CartContextType {
  cartItems: CartItem[];
  wishlistItems: WishlistItem[];
  addToCart: (
    item: Omit<CartItem, "quantity" | "ownerQuantity" | "petQuantity"> & {
      ownerQuantity?: number;
      petQuantity?: number;
    },
    quantity?: number
  ) => void;
  removeFromCart: (
    id: number | string,
    ownerSize: string,
    petSize: string
  ) => Promise<void>;
  updateQuantity: (
    id: number | string,
    ownerSize: string,
    petSize: string,
    ownerQuantity: number,
    petQuantity: number
  ) => Promise<void>;
  clearCart: () => void;
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: number | string) => void;
  isInWishlist: (id: number | string) => boolean;
  cartTotal: number;
  cartCount: number;
  removeComboPart: (
    id: number | string,
    ownerSize: string,
    petSize: string,
    partToRemove: "owner" | "pet"
  ) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type WishlistQueryRow = {
  product:
    | (Pick<
        Database["public"]["Tables"]["products"]["Row"],
        "id" | "name" | "price" | "image_url" | "slug"
      > & {
        category?: { name: string | null } | null;
      })
    | null;
};

function mapWishlistItems(rows: WishlistQueryRow[]): WishlistItem[] {
  return rows
    .filter(
      (
        item,
      ): item is WishlistQueryRow & {
        product: NonNullable<WishlistQueryRow["product"]>;
      } => Boolean(item.product),
    )
    .map((item) => ({
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      image: item.product.image_url || "",
      category: item.product.category?.name || "Product",
      slug: item.product.slug,
    }));
}

function getInitialCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    // 1. Try active cart first (most recent across all actions)
    const active = localStorage.getItem("pebric_active_cart");
    if (active) {
      const parsed = JSON.parse(active);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // 2. Try guest cart
    const guest = localStorage.getItem("guest_cart");
    if (guest) {
      const parsed = JSON.parse(guest);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // 3. Try any user_cart
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("user_cart_")) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load initial cart state:", e);
  }
  return [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCartItems);

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [isMerged, setIsMerged] = useState(false);
  const [isCartReady, setIsCartReady] = useState(false);
  const isHydratedRef = useRef(false);
  const abandonedCartSessionIdRef = useRef<string | null>(
    typeof window !== "undefined" ? getAbandonedCartSessionId() : null,
  );
  const previousUserIdRef = useRef<string | null>(user?.id ?? null);
  const previousEmailRef = useRef<string | null>(
    profile?.email || user?.email || null,
  );
  const previousCartItemsRef = useRef<CartItem[]>(cartItems);
  const skipNextEmptyCartClearRef = useRef(false);

  const cartService = useMemo(
    () => new CartService(user?.id ?? null),
    [user?.id],
  );

  const currentUserId = user?.id ?? null;

  // Persist cart to localStorage only when cart is ready / hydrated to avoid wiping state on mount
  useEffect(() => {
    if (!isCartReady) {
      return;
    }
    try {
      if (currentUserId) {
        localStorage.setItem(`user_cart_${currentUserId}`, JSON.stringify(cartItems));
      } else {
        localStorage.setItem("guest_cart", JSON.stringify(cartItems));
      }
      localStorage.setItem("pebric_active_cart", JSON.stringify(cartItems));
    } catch (e) {
      console.warn("Failed to save cart to localStorage:", e);
    }
  }, [cartItems, currentUserId, isCartReady]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!currentUserId) {
      const saved = localStorage.getItem("pebric_active_cart") || localStorage.getItem("guest_cart");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCartItems(parsed);
          }
        } catch {}
      }
      setWishlistItems([]);
      setIsMerged(false);
      setIsCartReady(true);
      isHydratedRef.current = true;
      return;
    }

    setIsCartReady(false);

    const syncAndLoadData = async () => {
      try {
        const guestCartJson = localStorage.getItem("guest_cart") || localStorage.getItem("pebric_active_cart");
        if (guestCartJson && !isMerged) {
          try {
            const guestItems: CartItem[] = JSON.parse(guestCartJson);
            if (guestItems.length > 0) {
              for (const item of guestItems) {
                await cartService.addItem(item);
              }
            }
          } catch {}
          localStorage.removeItem("guest_cart");
          setIsMerged(true);
        }

        const { data: cartData, error: cartError } = await supabase
          .from("cart_items")
          .select(
            `
            *,
            product:products (
              id,
              name,
              price,
              image_url,
              images,
              slug,
              sizes,
              pet_sizes
            )
          `,
          )
          .eq("user_id", currentUserId);

        if (!cartError && cartData && cartData.length > 0) {
          const groupedItems = cartService.groupCartItems(
            cartData as unknown as RawCartItemRecord[],
          );
          setCartItems(groupedItems);
          try {
            localStorage.setItem(`user_cart_${currentUserId}`, JSON.stringify(groupedItems));
            localStorage.setItem("pebric_active_cart", JSON.stringify(groupedItems));
          } catch {}
        } else {
          const savedUserCart = localStorage.getItem(`user_cart_${currentUserId}`) || localStorage.getItem("pebric_active_cart");
          if (savedUserCart) {
            try {
              const parsed = JSON.parse(savedUserCart);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setCartItems((prev) => (prev.length > 0 ? prev : parsed));
                for (const item of parsed) {
                  cartService.addItem(item).catch(() => {});
                }
              }
            } catch {
              // ignore
            }
          }
        }

        const { data: wishlistData } = await supabase
          .from("wishlist_items")
          .select(
            `
            product:products (
              id,
              name,
              price,
              image_url,
              slug,
              category:categories(name)
            )
          `,
          )
          .eq("user_id", currentUserId);

        if (wishlistData) {
          setWishlistItems(mapWishlistItems(wishlistData as WishlistQueryRow[]));
        }
      } catch (err) {
        console.warn("Cart sync warning:", err);
      } finally {
        setIsCartReady(true);
        isHydratedRef.current = true;
      }
    };

    syncAndLoadData();
  }, [currentUserId, isAuthLoading, isMerged, cartService]);

  useEffect(() => {
    if (!isCartReady || typeof document === "undefined") return;

    if (!abandonedCartSessionIdRef.current) {
      abandonedCartSessionIdRef.current = getAbandonedCartSessionId();
    }

    const identity = {
      userId: user?.id,
      sessionId: abandonedCartSessionIdRef.current,
    };

    const clearTrackedCart = () => {
      void clearTrackedAbandonedCart(identity).catch((error) => {
        console.warn("Failed to clear abandoned cart tracking:", error);
      });
    };

    if (cartItems.length === 0) {
      if (skipNextEmptyCartClearRef.current) {
        skipNextEmptyCartClearRef.current = false;
        return;
      }

      clearTrackedCart();
      return;
    }

    const trackCurrentCart = () => {
      void trackAbandonedCartSnapshot({
        ...identity,
        email: profile?.email || user?.email,
        cart_total: cartTotal,
        cart_items: cartItems.map((item) => {
          const isMatchingSet = item.ownerSize !== 'N/A' && item.petSize !== 'N/A';
          const halfPrice = Math.round(item.price * 0.5);
          const itemTotal = isMatchingSet
            ? (item.ownerSize !== 'N/A' ? item.ownerQuantity * halfPrice : 0) +
              (item.petSize !== 'N/A' ? item.petQuantity * halfPrice : 0)
            : item.price * item.quantity;

          return {
            product_id: String(item.id),
            product_name: item.name,
            quantity: item.quantity,
            price: item.quantity > 0 ? Math.round(itemTotal / item.quantity) : item.price,
            image_url: item.image,
          };
        }),
      }).catch((error) => {
        console.warn("Failed to track abandoned cart:", error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        trackCurrentCart();
      }
    };

    const handlePageHide = () => {
      trackCurrentCart();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [cartItems, isCartReady, profile?.email, user?.email, user?.id]);

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const userJustLoggedOut = Boolean(previousUserId) && !user?.id;

    if (
      userJustLoggedOut &&
      previousCartItemsRef.current.length > 0 &&
      abandonedCartSessionIdRef.current
    ) {
      skipNextEmptyCartClearRef.current = true;

      void trackAbandonedCartSnapshot({
        userId: previousUserId,
        sessionId: abandonedCartSessionIdRef.current,
        email: previousEmailRef.current || undefined,
        cart_total: previousCartItemsRef.current.reduce(
          (sum, item) => {
            const isMatchingSet = item.ownerSize !== 'N/A' && item.petSize !== 'N/A';
            const halfPrice = Math.round(item.price * 0.5);
            const itemTotal = isMatchingSet
              ? (item.ownerSize !== 'N/A' ? item.ownerQuantity * halfPrice : 0) +
                (item.petSize !== 'N/A' ? item.petQuantity * halfPrice : 0)
              : item.price * item.quantity;
            return sum + itemTotal;
          },
          0,
        ),
        cart_items: previousCartItemsRef.current.map((item) => {
          const isMatchingSet = item.ownerSize !== 'N/A' && item.petSize !== 'N/A';
          const halfPrice = Math.round(item.price * 0.5);
          const itemTotal = isMatchingSet
            ? (item.ownerSize !== 'N/A' ? item.ownerQuantity * halfPrice : 0) +
              (item.petSize !== 'N/A' ? item.petQuantity * halfPrice : 0)
            : item.price * item.quantity;

          return {
            product_id: String(item.id),
            product_name: item.name,
            quantity: item.quantity,
            price: item.quantity > 0 ? Math.round(itemTotal / item.quantity) : item.price,
            image_url: item.image,
          };
        }),
      }).catch((error) => {
        console.warn("Failed to track abandoned cart on logout:", error);
      });
    }

    previousUserIdRef.current = user?.id ?? null;
    previousEmailRef.current = profile?.email || user?.email || null;
    previousCartItemsRef.current = cartItems;
  }, [cartItems, profile?.email, user?.email, user?.id]);

  useRealtimeChannel(
    user ? `cart-wishlist-realtime-${user.id}` : "cart-wishlist-realtime-guest",
    user
      ? [
          { table: "cart_items", event: "*", filter: `user_id=eq.${user.id}` },
          {
            table: "wishlist_items",
            event: "*",
            filter: `user_id=eq.${user.id}`,
          },
        ]
      : [],
    async () => {
      if (!user) return;

      const { data: cartData } = await supabase
        .from("cart_items")
        .select(
          `
          *,
          product:products (
            id,
            name,
            price,
            image_url,
            images,
            slug,
            sizes,
            pet_sizes
          )
        `,
        )
        .eq("user_id", user.id);

      if (cartData && cartData.length > 0) {
        const groupedItems = cartService.groupCartItems(
          cartData as unknown as RawCartItemRecord[],
        );
        setCartItems(groupedItems);
      }

      const { data: wishlistData } = await supabase
        .from("wishlist_items")
        .select(
          `
          product:products (
            id,
            name,
            price,
            image_url,
            slug,
            category:categories(name)
          )
        `,
        )
        .eq("user_id", user.id);

      if (wishlistData) {
        setWishlistItems(mapWishlistItems(wishlistData as WishlistQueryRow[]));
      }
    },
    !!user,
  );

  const addToCart = async (
    item: Omit<CartItem, "quantity" | "ownerQuantity" | "petQuantity"> & {
      ownerQuantity?: number;
      petQuantity?: number;
    },
    quantity = 1
  ) => {
    const ownerSize = CartItemModel.normalizeSize(item.ownerSize);
    const petSize = CartItemModel.normalizeSize(item.petSize);

    const isCombo = ownerSize !== "N/A" && petSize !== "N/A";
    const itemOwnerQty = item.ownerQuantity !== undefined ? item.ownerQuantity : (ownerSize !== "N/A" ? quantity : 0);
    const itemPetQty = item.petQuantity !== undefined ? item.petQuantity : (petSize !== "N/A" ? quantity : 0);
    const combinedQuantity = itemOwnerQty + itemPetQty;

    const newItem: CartItem = {
      ...item,
      ownerSize,
      petSize,
      ownerQuantity: itemOwnerQty,
      petQuantity: itemPetQty,
      quantity: combinedQuantity,
      type: isCombo ? "combo" : (ownerSize !== "N/A" ? "owner" : "pet"),
    };

    setCartItems((prev) => {
      let updated = [...prev];
      const existing = updated.find(
        (i) =>
          i.id === newItem.id &&
          i.ownerSize === newItem.ownerSize &&
          i.petSize === newItem.petSize
      );
      if (existing) {
        updated = updated.map((i) =>
          i === existing
            ? {
                ...i,
                ownerQuantity: i.ownerQuantity + newItem.ownerQuantity,
                petQuantity: i.petQuantity + newItem.petQuantity,
                quantity: i.quantity + newItem.quantity,
              }
            : i
        );
      } else {
        updated.push(newItem);
      }
      try {
        if (currentUserId) {
          localStorage.setItem(`user_cart_${currentUserId}`, JSON.stringify(updated));
        } else {
          localStorage.setItem("guest_cart", JSON.stringify(updated));
        }
        localStorage.setItem("pebric_active_cart", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user) {
      try {
        await cartService.addItem(newItem);
      } catch (error) {
        console.warn("Could not sync cart item to account:", error);
      }
    }
  };

  const removeFromCart = async (
    id: number | string,
    ownerSize: string,
    petSize: string
  ) => {
    const normalizedOwnerSize = CartItemModel.normalizeSize(ownerSize);
    const normalizedPetSize = CartItemModel.normalizeSize(petSize);

    setCartItems((prev) => {
      const updated = prev.filter(
        (i) =>
          !(i.id === id &&
            i.ownerSize === normalizedOwnerSize &&
            i.petSize === normalizedPetSize)
      );
      try {
        if (currentUserId) {
          localStorage.setItem(`user_cart_${currentUserId}`, JSON.stringify(updated));
        } else {
          localStorage.setItem("guest_cart", JSON.stringify(updated));
        }
        localStorage.setItem("pebric_active_cart", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user) {
      try {
        await cartService.removeItem(id, normalizedOwnerSize, normalizedPetSize);
      } catch (error) {
        console.error("Failed to sync cart:", error);
      }
    }
  };

  const removeComboPart = async (
    id: number | string,
    ownerSize: string,
    petSize: string,
    partToRemove: "owner" | "pet"
  ) => {
    const normalizedOwnerSize = CartItemModel.normalizeSize(ownerSize);
    const normalizedPetSize = CartItemModel.normalizeSize(petSize);

    const comboItem = cartItems.find(
      (i) =>
        i.id === id &&
        i.ownerSize === normalizedOwnerSize &&
        i.petSize === normalizedPetSize
    );

    if (!comboItem) return;

    // 1. Remove the combo item completely
    await removeFromCart(id, normalizedOwnerSize, normalizedPetSize);

    // 2. Add back the remaining part with its quantity
    if (partToRemove === "owner") {
      // Keep pet part only
      await addToCart({
        id: comboItem.id,
        name: comboItem.name,
        price: comboItem.price,
        image: comboItem.image,
        ownerSize: "N/A",
        petSize: normalizedPetSize,
        slug: comboItem.slug,
        type: "pet",
        ownerQuantity: 0,
        petQuantity: comboItem.petQuantity,
      });
    } else {
      // Keep owner part only
      await addToCart({
        id: comboItem.id,
        name: comboItem.name,
        price: comboItem.price,
        image: comboItem.image,
        ownerSize: normalizedOwnerSize,
        petSize: "N/A",
        slug: comboItem.slug,
        type: "owner",
        ownerQuantity: comboItem.ownerQuantity,
        petQuantity: 0,
      });
    }
  };

  const updateQuantity = async (
    id: number | string,
    ownerSize: string,
    petSize: string,
    ownerQuantity: number,
    petQuantity: number
  ) => {
    const normalizedOwnerSize = CartItemModel.normalizeSize(ownerSize);
    const normalizedPetSize = CartItemModel.normalizeSize(petSize);

    if (ownerQuantity < 1 && petQuantity < 1) {
      await removeFromCart(
        id,
        normalizedOwnerSize,
        normalizedPetSize
      );
      return;
    }

    setCartItems((prev) => {
      const updated = prev.map((i) =>
        i.id === id &&
        i.ownerSize === normalizedOwnerSize &&
        i.petSize === normalizedPetSize
          ? {
              ...i,
              ownerQuantity: Math.max(0, ownerQuantity),
              petQuantity: Math.max(0, petQuantity),
              quantity: Math.max(0, ownerQuantity) + Math.max(0, petQuantity),
            }
          : i,
      );
      try {
        if (currentUserId) {
          localStorage.setItem(`user_cart_${currentUserId}`, JSON.stringify(updated));
        } else {
          localStorage.setItem("guest_cart", JSON.stringify(updated));
        }
        localStorage.setItem("pebric_active_cart", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user) {
      try {
        await cartService.updateQuantity(
          id,
          normalizedOwnerSize,
          normalizedPetSize,
          ownerQuantity,
          petQuantity
        );
      } catch (error) {
        console.error("Failed to sync cart:", error);
      }
    }
  };

  const clearCart = async () => {
    setCartItems([]);
    try {
      if (currentUserId) {
        localStorage.removeItem(`user_cart_${currentUserId}`);
      }
      localStorage.removeItem("guest_cart");
      localStorage.removeItem("pebric_active_cart");
    } catch {}
    if (user) {
      try {
        await cartService.clearCart();
      } catch (error) {
        console.error("Failed to clear cart DB:", error);
      }
    }
  };

  const addToWishlist = async (item: WishlistItem) => {
    setWishlistItems((prev) => {
      if (prev.find((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });

    if (user) {
      await supabase.from("wishlist_items").insert({
        user_id: user.id,
        product_id: item.id as unknown as string,
      });
    }
  };

  const removeFromWishlist = async (id: number | string) => {
    setWishlistItems((prev) => prev.filter((i) => i.id !== id));

    if (user) {
      await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", id as unknown as string);
    }
  };

  const isInWishlist = (id: number | string) =>
    wishlistItems.some((i) => i.id === id);

  const { subtotal: cartTotal, itemCount: cartCount } =
    CartService.calculateTotals(cartItems);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        wishlistItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        cartTotal,
        cartCount,
        removeComboPart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
