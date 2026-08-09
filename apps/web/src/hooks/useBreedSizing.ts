import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { Pet } from "./usePets";

export interface BreedSizingRule {
  id: string;
  species: string;
  breed: string;
  size_category: string;
  min_weight_kg: number | null;
  max_weight_kg: number | null;
  min_chest_cm: number | null;
  max_chest_cm: number | null;
  recommended_size: string;
  notes: string | null;
  created_at: string;
}

export function useBreedSizingRules(species?: string) {
  return useQuery({
    queryKey: ["breed-sizing-rules", species],
    queryFn: async () => {
      let query = supabase
        .from("breed_sizing_rules")
        .select("*")
        .order("breed", { ascending: true });
        
      if (species) {
        query = query.eq("species", species);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      return data as BreedSizingRule[];
    },
  });
}

export function getRecommendedSizeFromBreed(
  pet: Pet,
  rules: BreedSizingRule[]
): string | null {
  if (!pet.breed) return null;

  // Find matching breed rules
  const breedRules = rules.filter(
    (r) => r.species === pet.species && r.breed.toLowerCase() === pet.breed?.toLowerCase()
  );

  if (breedRules.length === 0) return null;

  // Try to find a match based on weight if available
  if (pet.weight_kg) {
    const weightMatch = breedRules.find(
      (r) =>
        (r.min_weight_kg === null || pet.weight_kg! >= r.min_weight_kg) &&
        (r.max_weight_kg === null || pet.weight_kg! <= r.max_weight_kg)
    );
    if (weightMatch) return weightMatch.recommended_size;
  }

  // Try to find a match based on chest measurement if available
  if (pet.chest_cm) {
    const chestMatch = breedRules.find(
      (r) =>
        (r.min_chest_cm === null || pet.chest_cm! >= r.min_chest_cm) &&
        (r.max_chest_cm === null || pet.chest_cm! <= r.max_chest_cm)
    );
    if (chestMatch) return chestMatch.recommended_size;
  }

  // Return the first rule's size as fallback
  return breedRules[0]?.recommended_size || null;
}

// Combined size recommendation function
export function getSmartSizeRecommendation(
  pet: Pet,
  breedRules: BreedSizingRule[]
): { size: string; confidence: "high" | "medium" | "low"; reason: string } | null {
  // First try breed + measurements
  const breedSize = getRecommendedSizeFromBreed(pet, breedRules);
  
  if (breedSize && pet.chest_cm) {
    return {
      size: breedSize,
      confidence: "high",
      reason: `Based on ${pet.breed} breed and ${pet.chest_cm}cm chest measurement`,
    };
  }

  // Try chest measurement only
  if (pet.chest_cm) {
    const chest = pet.chest_cm;
    let size: string;
    
    if (pet.species === "dog") {
      if (chest < 35) size = "XS";
      else if (chest < 45) size = "S";
      else if (chest < 55) size = "M";
      else if (chest < 70) size = "L";
      else if (chest < 85) size = "XL";
      else size = "XXL";
    } else if (pet.species === "cat") {
      if (chest < 30) size = "XS";
      else if (chest < 35) size = "S";
      else if (chest < 40) size = "M";
      else if (chest < 45) size = "L";
      else size = "XL";
    } else {
      return null;
    }

    return {
      size,
      confidence: "medium",
      reason: `Based on ${pet.chest_cm}cm chest measurement`,
    };
  }

  // Try weight only
  if (pet.weight_kg) {
    const weight = pet.weight_kg;
    let size: string;
    
    if (pet.species === "dog") {
      if (weight < 5) size = "XS";
      else if (weight < 10) size = "S";
      else if (weight < 20) size = "M";
      else if (weight < 35) size = "L";
      else size = "XL";
    } else if (pet.species === "cat") {
      if (weight < 3) size = "XS";
      else if (weight < 5) size = "S";
      else if (weight < 7) size = "M";
      else size = "L";
    } else {
      return null;
    }

    return {
      size,
      confidence: "low",
      reason: `Estimated from ${pet.weight_kg}kg weight - we recommend measuring chest for better accuracy`,
    };
  }

  // Breed only
  if (breedSize) {
    return {
      size: breedSize,
      confidence: "low",
      reason: `Based on typical ${pet.breed} sizing - add measurements for better accuracy`,
    };
  }

  return null;
}
