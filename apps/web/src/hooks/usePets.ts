import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  neck_cm: number | null;
  chest_cm: number | null;
  length_cm: number | null;
  photo_url: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type PetInsert = Omit<Pet, "id" | "created_at" | "updated_at">;
export type PetUpdate = Partial<PetInsert>;

const PETS_STORAGE_PREFIX = "pebric_user_pets_";

export function getLocalPets(userId: string): Pet[] {
  try {
    const raw = localStorage.getItem(`${PETS_STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalPets(userId: string, pets: Pet[]) {
  try {
    localStorage.setItem(`${PETS_STORAGE_PREFIX}${userId}`, JSON.stringify(pets));
  } catch (e) {
    console.warn("Failed to persist pets to localStorage:", e);
  }
}

export function usePets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pets", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Always fetch fresh user data to get the latest user_metadata after mutations
      let freshUser = user;
      try {
        const { data: freshUserData } = await supabase.auth.getUser();
        if (freshUserData?.user) {
          freshUser = freshUserData.user;
        }
      } catch (e) {
        console.warn("Failed to fetch fresh user in usePets:", e);
      }

      let dbPets: Pet[] = [];
      try {
        const { data, error } = await supabase
          .from("pets")
          .select("*")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data) {
          dbPets = data as Pet[];
        }
      } catch (err) {
        console.warn("Could not load pets from table:", err);
      }

      const metaPets: Pet[] = (freshUser.user_metadata?.pets || []).map((pet: any) => ({
        id: pet.id || `pet-${Date.now()}-${Math.random()}`,
        user_id: freshUser.id,
        name: pet.name || "My Pet",
        species: pet.species || "dog",
        breed: pet.breed || null,
        birth_date: pet.birth_date || null,
        weight_kg: pet.weight_kg !== undefined ? Number(pet.weight_kg) : null,
        height_cm: pet.height_cm !== undefined ? Number(pet.height_cm) : null,
        neck_cm: pet.neck_cm !== undefined ? Number(pet.neck_cm) : null,
        chest_cm: pet.chest_cm !== undefined ? Number(pet.chest_cm) : null,
        length_cm: pet.length_cm !== undefined ? Number(pet.length_cm) : null,
        photo_url: pet.photo_url || null,
        notes: pet.notes || null,
        is_primary: !!pet.is_primary,
        created_at: pet.created_at || new Date().toISOString(),
        updated_at: pet.updated_at || new Date().toISOString(),
      }));

      const localPets = getLocalPets(user.id);

      const combinedMap = new Map<string, Pet>();
      dbPets.forEach((p) => combinedMap.set(p.id, p));
      metaPets.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });
      localPets.forEach((p) => {
        if (!combinedMap.has(p.id)) {
          combinedMap.set(p.id, p);
        }
      });

      const allPets = Array.from(combinedMap.values());
      saveLocalPets(user.id, allPets);
      return allPets;
    },
    enabled: !!user,
  });
}

export function usePet(id: string) {
  const { user } = useAuth();
  const { data: pets } = usePets();

  return useQuery({
    queryKey: ["pet", id],
    queryFn: async () => {
      if (pets) {
        const found = pets.find((p) => p.id === id);
        if (found) return found;
      }
      const { data, error } = await supabase
        .from("pets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Pet;
    },
    enabled: !!user && !!id,
  });
}

export function useAddPet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (pet: Omit<PetInsert, "user_id">) => {
      if (!user) throw new Error("Not authenticated");

      let createdPet: Pet | null = null;
      try {
        const { data, error } = await supabase
          .from("pets")
          .insert({ ...pet, user_id: user.id })
          .select()
          .single();

        if (!error && data) {
          createdPet = data as Pet;
        }
      } catch (e) {
        console.warn("DB insert pet failed, using metadata fallback:", e);
      }

      const newPet: Pet = createdPet || {
        id: `pet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: user.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed || null,
        birth_date: pet.birth_date || null,
        weight_kg: pet.weight_kg !== undefined ? Number(pet.weight_kg) : null,
        height_cm: pet.height_cm !== undefined ? Number(pet.height_cm) : null,
        neck_cm: pet.neck_cm !== undefined ? Number(pet.neck_cm) : null,
        chest_cm: pet.chest_cm !== undefined ? Number(pet.chest_cm) : null,
        length_cm: pet.length_cm !== undefined ? Number(pet.length_cm) : null,
        photo_url: pet.photo_url || null,
        notes: pet.notes || null,
        is_primary: !!pet.is_primary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existingMeta = user.user_metadata?.pets || [];
      const updatedMeta = pet.is_primary
        ? existingMeta.map((p: any) => ({ ...p, is_primary: false }))
        : existingMeta;

      await supabase.auth.updateUser({
        data: {
          pets: [...updatedMeta, newPet],
        },
      });

      return newPet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet added successfully!");
    },
    onError: (error) => {
      toast.error("Failed to add pet", { description: error.message });
    },
  });
}

export function useUpdatePet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: PetUpdate & { id: string }) => {
      try {
        await supabase
          .from("pets")
          .update(updates)
          .eq("id", id);
      } catch (e) {
        console.warn("DB update pet failed, using metadata fallback:", e);
      }

      if (user) {
        const existingMeta = user.user_metadata?.pets || [];
        const updatedMeta = existingMeta.map((p: any) => {
          if (p.id === id) {
            return { ...p, ...updates, updated_at: new Date().toISOString() };
          }
          return updates.is_primary ? { ...p, is_primary: false } : p;
        });

        await supabase.auth.updateUser({
          data: {
            pets: updatedMeta,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update pet", { description: error.message });
    },
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("pets").delete().eq("id", id);
      } catch (e) {
        console.warn("DB delete pet failed:", e);
      }

      if (user) {
        const existingMeta = user.user_metadata?.pets || [];
        const updatedMeta = existingMeta.filter((p: any) => p.id !== id);
        await supabase.auth.updateUser({
          data: {
            pets: updatedMeta,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet removed");
    },
    onError: (error) => {
      toast.error("Failed to remove pet", { description: error.message });
    },
  });
}

export function useSetPrimaryPet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (petId: string) => {
      if (!user) throw new Error("Not authenticated");

      try {
        await supabase
          .from("pets")
          .update({ is_primary: false })
          .eq("user_id", user.id);

        await supabase
          .from("pets")
          .update({ is_primary: true })
          .eq("id", petId);
      } catch (e) {
        console.warn("DB set primary pet failed:", e);
      }

      const existingMeta = user.user_metadata?.pets || [];
      const updatedMeta = existingMeta.map((p: any) => ({
        ...p,
        is_primary: p.id === petId,
      }));

      await supabase.auth.updateUser({
        data: {
          pets: updatedMeta,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Primary pet updated");
    },
  });
}

// Size recommendation based on pet measurements
export function getRecommendedSize(pet: Pet): string | null {
  if (!pet.chest_cm) return null;

  const chest = pet.chest_cm;
  
  if (pet.species === "dog") {
    if (chest < 35) return "XS";
    if (chest < 45) return "S";
    if (chest < 55) return "M";
    if (chest < 70) return "L";
    if (chest < 85) return "XL";
    return "XXL";
  }
  
  if (pet.species === "cat") {
    if (chest < 30) return "XS";
    if (chest < 35) return "S";
    if (chest < 40) return "M";
    if (chest < 45) return "L";
    return "XL";
  }

  return null;
}
