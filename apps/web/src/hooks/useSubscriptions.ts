import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import type { Product } from "@/hooks/useProducts";

export interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  frequency: string;
  quantity: number;
  size: string | null;
  pet_size: string | null;
  status: string;
  next_delivery_date: string;
  last_order_id: string | null;
  created_at: string;
  updated_at: string;
  product?: Product | null;
}

const SUBSCRIPTIONS_STORAGE_PREFIX = "pebric_user_subscriptions_";

export function getLocalSubscriptions(userId: string): Subscription[] {
  try {
    const raw = localStorage.getItem(`${SUBSCRIPTIONS_STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalSubscriptions(userId: string, subs: Subscription[]) {
  try {
    localStorage.setItem(`${SUBSCRIPTIONS_STORAGE_PREFIX}${userId}`, JSON.stringify(subs));
  } catch (e) {
    console.warn("Failed to persist subscriptions to localStorage:", e);
  }
}

export function useSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let currentUser = user;
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          currentUser = userData.user;
        }
      } catch (e) {
        console.warn("Failed to fetch fresh user in useSubscriptions:", e);
      }

      let dbSubs: Subscription[] = [];
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select(`
            *,
            product:products(*)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          dbSubs = data as Subscription[];
        }
      } catch (error) {
        console.warn("Failed to fetch subscriptions from table:", error);
      }

      // Check user metadata subscriptions
      const metaSubs: Subscription[] = currentUser.user_metadata?.user_subscriptions || [];
      const localSubs = getLocalSubscriptions(user.id);

      // Combine all sources
      const combinedMap = new Map<string, Subscription>();
      dbSubs.forEach((s) => combinedMap.set(s.id, s));
      metaSubs.forEach((s) => {
        if (!combinedMap.has(s.id)) {
          combinedMap.set(s.id, s);
        }
      });
      localSubs.forEach((s) => {
        if (!combinedMap.has(s.id)) {
          combinedMap.set(s.id, s);
        }
      });

      // Enrich any subscription missing product details
      let productsMap = new Map<string, any>();
      try {
        const { data: productsData } = await supabase
          .from("products")
          .select("*");
        if (productsData) {
          productsData.forEach((p) => productsMap.set(p.id, p));
        }
      } catch (err) {
        console.warn("Could not fetch products for subscription enrichment:", err);
      }

      const allSubs = Array.from(combinedMap.values()).map((sub) => {
        const product = sub.product || productsMap.get(sub.product_id) || null;
        return {
          ...sub,
          product,
        };
      });

      saveLocalSubscriptions(user.id, allSubs);
      return allSubs;
    },
    enabled: !!user,
    retry: 1,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      productId,
      frequency,
      quantity,
      size,
      petSize,
    }: {
      productId: string;
      frequency: string;
      quantity?: number;
      size?: string | null;
      petSize?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Calculate next delivery date based on frequency
      const nextDate = new Date();
      switch (frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
        default:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }

      const cleanSize = size && size !== "N/A" ? size : null;
      const cleanPetSize = petSize && petSize !== "N/A" ? petSize : null;

      // Check if user already has an active subscription for this product in DB
      try {
        let checkQuery = supabase
          .from("subscriptions")
          .select(`
            *,
            product:products(*)
          `)
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .eq("status", "active")
          .eq("frequency", frequency);

        if (cleanSize) {
          checkQuery = checkQuery.eq("size", cleanSize);
        }
        if (cleanPetSize) {
          checkQuery = checkQuery.eq("pet_size", cleanPetSize);
        }

        const { data: existing } = await checkQuery.limit(1);
        if (existing && existing.length > 0) {
          const sub = existing[0] as Subscription;
          // Sync existing to local and meta
          try {
            const existingLocal = getLocalSubscriptions(user.id);
            saveLocalSubscriptions(user.id, [sub, ...existingLocal.filter((s) => s.id !== sub.id)]);
          } catch (e) {}
          return sub;
        }
      } catch (checkErr) {
        console.warn("Existing subscription check warning:", checkErr);
      }

      const subId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let finalSub: Subscription = {
        id: subId,
        user_id: user.id,
        product_id: productId,
        frequency,
        quantity: quantity || 1,
        size: cleanSize,
        pet_size: cleanPetSize,
        status: "active",
        next_delivery_date: nextDate.toISOString().split('T')[0],
        last_order_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const insertPayload = {
          user_id: user.id,
          product_id: productId,
          frequency,
          quantity: quantity || 1,
          size: cleanSize,
          pet_size: cleanPetSize,
          next_delivery_date: nextDate.toISOString().split('T')[0],
        };

        const { data, error } = await supabase
          .from("subscriptions")
          .insert(insertPayload)
          .select(`
            *,
            product:products(*)
          `)
          .single();

        if (!error && data) {
          finalSub = data as Subscription;
        }
      } catch (dbErr) {
        console.warn("Direct subscription insert warning:", dbErr);
      }

      // 1. Immediately cache in localStorage
      try {
        const existingLocal = getLocalSubscriptions(user.id);
        const updatedLocal = [
          finalSub,
          ...existingLocal.filter((s) => s.id !== finalSub.id && !(s.product_id === productId && s.frequency === frequency && s.status === 'active')),
        ];
        saveLocalSubscriptions(user.id, updatedLocal);
      } catch (localErr) {
        console.warn("Subscription localStorage cache error:", localErr);
      }

      // 2. Sync to fresh user metadata
      try {
        const { data: userData } = await supabase.auth.getUser();
        const freshUser = userData?.user || user;
        const existingMetaSubs: Subscription[] = freshUser.user_metadata?.user_subscriptions || [];
        const updatedMetaSubs = [
          finalSub,
          ...existingMetaSubs.filter((s: Subscription) => s.id !== finalSub.id && !(s.product_id === productId && s.frequency === frequency && s.status === 'active')),
        ];
        await supabase.auth.updateUser({
          data: { user_subscriptions: updatedMetaSubs },
        });
      } catch (metaErr) {
        console.warn("Subscription metadata sync warning:", metaErr);
      }

      return finalSub;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription created!", {
        description: "You'll receive automatic deliveries.",
      });
    },
    onError: (error: any) => {
      const msg = error?.message || "Unknown error";
      toast.error("Failed to create subscription", {
        description: msg,
      });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      status,
      frequency,
      quantity,
    }: {
      subscriptionId: string;
      status?: string;
      frequency?: string;
      quantity?: number;
    }) => {
      const updates: Partial<Subscription> = {};
      if (status) updates.status = status;
      if (frequency) updates.frequency = frequency;
      if (quantity) updates.quantity = quantity;

      try {
        await supabase
          .from("subscriptions")
          .update(updates)
          .eq("id", subscriptionId);
      } catch (e) {
        console.warn("DB subscription update warning:", e);
      }

      if (user) {
        // Update local storage
        try {
          const localSubs = getLocalSubscriptions(user.id);
          const updatedLocal = localSubs.map((s) => {
            if (s.id === subscriptionId) {
              return { ...s, ...updates, updated_at: new Date().toISOString() };
            }
            return s;
          });
          saveLocalSubscriptions(user.id, updatedLocal);
        } catch (e) {}

        // Update metadata
        try {
          const { data: userData } = await supabase.auth.getUser();
          const freshUser = userData?.user || user;
          const metaSubs: Subscription[] = freshUser.user_metadata?.user_subscriptions || [];
          const updatedMetaSubs = metaSubs.map((s: Subscription) => {
            if (s.id === subscriptionId) {
              return { ...s, ...updates, updated_at: new Date().toISOString() };
            }
            return s;
          });
          await supabase.auth.updateUser({
            data: { user_subscriptions: updatedMetaSubs },
          });
        } catch (metaErr) {
          console.warn("Metadata update exception:", metaErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription updated");
    },
    onError: () => {
      toast.error("Failed to update subscription");
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      try {
        await supabase
          .from("subscriptions")
          .update({ status: 'cancelled' })
          .eq("id", subscriptionId);
      } catch (e) {
        console.warn("DB subscription cancel warning:", e);
      }

      if (user) {
        // Update local storage
        try {
          const localSubs = getLocalSubscriptions(user.id);
          const updatedLocal = localSubs.map((s) => {
            if (s.id === subscriptionId) {
              return { ...s, status: 'cancelled', updated_at: new Date().toISOString() };
            }
            return s;
          });
          saveLocalSubscriptions(user.id, updatedLocal);
        } catch (e) {}

        // Update metadata
        try {
          const { data: userData } = await supabase.auth.getUser();
          const freshUser = userData?.user || user;
          const metaSubs: Subscription[] = freshUser.user_metadata?.user_subscriptions || [];
          const updatedMetaSubs = metaSubs.map((s: Subscription) => {
            if (s.id === subscriptionId) {
              return { ...s, status: 'cancelled', updated_at: new Date().toISOString() };
            }
            return s;
          });
          await supabase.auth.updateUser({
            data: { user_subscriptions: updatedMetaSubs },
          });
        } catch (metaErr) {
          console.warn("Metadata cancel exception:", metaErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Subscription cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel subscription");
    },
  });
}
