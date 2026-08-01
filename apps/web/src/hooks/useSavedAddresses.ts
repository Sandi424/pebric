import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type SavedAddressInsert = Omit<SavedAddress, "id" | "user_id" | "created_at" | "updated_at">;

export function useSavedAddresses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["saved-addresses", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Always fetch fresh user data to get the latest user_metadata after mutations
      const { data: freshUserData } = await supabase.auth.getUser();
      const freshUser = freshUserData?.user || user;
      
      let dbAddresses: SavedAddress[] = [];
      try {
        const { data, error } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data) {
          dbAddresses = data as SavedAddress[];
        }
      } catch (err) {
        console.warn("Could not load addresses from table:", err);
      }

      const metaAddresses: SavedAddress[] = (freshUser.user_metadata?.saved_addresses || []).map((addr: any) => ({
        id: addr.id || `meta-${Date.now()}-${Math.random()}`,
        user_id: freshUser.id,
        label: addr.label || "Home",
        full_name: addr.full_name || "",
        phone: addr.phone || null,
        address_line1: addr.address_line1 || "",
        address_line2: addr.address_line2 || null,
        city: addr.city || "",
        state: addr.state || null,
        postal_code: addr.postal_code || "",
        country: addr.country || "India",
        is_default: !!addr.is_default,
        created_at: addr.created_at || new Date().toISOString(),
        updated_at: addr.updated_at || new Date().toISOString(),
      }));

      const combinedMap = new Map<string, SavedAddress>();
      dbAddresses.forEach((a) => combinedMap.set(a.id, a));
      metaAddresses.forEach((a) => {
        if (!combinedMap.has(a.id)) {
          combinedMap.set(a.id, a);
        }
      });

      return Array.from(combinedMap.values());
    },
    enabled: !!user,
  });
}

export function useCreateSavedAddress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (address: SavedAddressInsert) => {
      if (!user) throw new Error("Not authenticated");
      
      let createdData: SavedAddress | null = null;
      try {
        if (address.is_default) {
          await supabase
            .from("saved_addresses")
            .update({ is_default: false })
            .eq("user_id", user.id);
        }
        
        const { data, error } = await supabase
          .from("saved_addresses")
          .insert({
            ...address,
            user_id: user.id,
          })
          .select()
          .single();

        if (!error && data) {
          createdData = data as SavedAddress;
        }
      } catch (e) {
        console.warn("DB insert for saved_address failed, using metadata fallback:", e);
      }

      // Fallback to metadata storage if DB table RLS policy rejected it
      const newMetaAddr: SavedAddress = createdData || {
        id: `addr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: user.id,
        label: address.label || "Home",
        full_name: address.full_name || "",
        phone: address.phone || null,
        address_line1: address.address_line1 || "",
        address_line2: address.address_line2 || null,
        city: address.city || "",
        state: address.state || null,
        postal_code: address.postal_code || "",
        country: address.country || "India",
        is_default: !!address.is_default,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingMeta = user.user_metadata?.saved_addresses || [];
      const updatedMeta = address.is_default
        ? existingMeta.map((a: any) => ({ ...a, is_default: false }))
        : existingMeta;

      await supabase.auth.updateUser({
        data: {
          saved_addresses: [...updatedMeta, newMetaAddr],
        },
      });

      return newMetaAddr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-addresses"] });
      toast.success("Address saved!");
    },
    onError: (error) => {
      toast.error("Failed to save address", { description: error.message });
    },
  });
}

export function useUpdateSavedAddress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavedAddressInsert> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      try {
        if (updates.is_default) {
          await supabase
            .from("saved_addresses")
            .update({ is_default: false })
            .eq("user_id", user.id);
        }
        
        await supabase
          .from("saved_addresses")
          .update(updates)
          .eq("id", id);
      } catch (e) {
        console.warn("DB update address failed, using metadata fallback:", e);
      }

      const existingMeta = user.user_metadata?.saved_addresses || [];
      const updatedMeta = existingMeta.map((a: any) => {
        if (a.id === id) {
          return { ...a, ...updates, updated_at: new Date().toISOString() };
        }
        return updates.is_default ? { ...a, is_default: false } : a;
      });

      await supabase.auth.updateUser({
        data: {
          saved_addresses: updatedMeta,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-addresses"] });
      toast.success("Address updated!");
    },
  });
}

export function useDeleteSavedAddress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase
          .from("saved_addresses")
          .delete()
          .eq("id", id);
      } catch (e) {
        console.warn("DB delete address failed:", e);
      }

      if (user) {
        const existingMeta = user.user_metadata?.saved_addresses || [];
        const updatedMeta = existingMeta.filter((a: any) => a.id !== id);
        await supabase.auth.updateUser({
          data: {
            saved_addresses: updatedMeta,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-addresses"] });
      toast.success("Address deleted");
    },
  });
}

