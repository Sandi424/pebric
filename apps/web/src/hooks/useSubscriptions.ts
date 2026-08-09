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

export function useSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          product:products(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch subscriptions:", error.message, error);
        throw error;
      }
      return data as Subscription[];
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

      if (error) throw error;
      return data;
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
        description: msg.includes("row-level security")
          ? "RLS policy missing. Run fix-rls.sql in Supabase SQL Editor."
          : msg,
      });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

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

      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", subscriptionId);

      if (error) throw error;
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

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: 'cancelled' })
        .eq("id", subscriptionId);

      if (error) throw error;
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
