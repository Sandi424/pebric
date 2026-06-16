import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/client";
import { toast } from "sonner";

export interface FlashSale {
  id: string;
  name: string;
  description: string | null;
  discount_percentage: number;
  starts_at: string;
  ends_at: string;
  product_ids: string[];
  category_ids: string[];
  is_active: boolean;
  created_at: string;
}

export function useFlashSales() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["flash-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flash_sales")
        .select("*")
        .order("starts_at", { ascending: false });

      if (error) throw error;
      return data as FlashSale[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`flash-sales-realtime-${Math.random().toString(36).substring(2, 9)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flash_sales",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
          queryClient.invalidateQueries({ queryKey: ["active-flash-sales"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useActiveFlashSales() {
  return useQuery({
    queryKey: ["active-flash-sales"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("flash_sales")
        .select("*")
        .eq("is_active", true)
        .lte("starts_at", now)
        .gte("ends_at", now);

      if (error) throw error;
      return data as FlashSale[];
    },
  });
}

export function useCreateFlashSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sale: Omit<FlashSale, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("flash_sales")
        .insert(sale)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
      toast.success("Flash sale created");
    },
    onError: () => {
      toast.error("Failed to create flash sale");
    },
  });
}

export function useUpdateFlashSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FlashSale> & { id: string }) => {
      const { error } = await supabase
        .from("flash_sales")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
      toast.success("Flash sale updated");
    },
    onError: () => {
      toast.error("Failed to update flash sale");
    },
  });
}

export function useDeleteFlashSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flash_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flash-sales"] });
      toast.success("Flash sale deleted");
    },
    onError: () => {
      toast.error("Failed to delete flash sale");
    },
  });
}
