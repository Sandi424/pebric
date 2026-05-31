import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  points: number;
  lifetime_points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  type: "earned" | "redeemed" | "expired" | "bonus" | "referral";
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 5000,
};

export const TIER_BENEFITS = {
  bronze: { pointsMultiplier: 1, discount: 0 },
  silver: { pointsMultiplier: 1.25, discount: 5 },
  gold: { pointsMultiplier: 1.5, discount: 10 },
  platinum: { pointsMultiplier: 2, discount: 15 },
};

export function useLoyaltyPoints() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loyalty-points", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as LoyaltyPoints | null;
    },
    enabled: !!user,
  });
}

export function useLoyaltyTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loyalty-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as LoyaltyTransaction[];
    },
    enabled: !!user,
  });
}

export function useInitializeLoyalty() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Check if already exists
      const { data: existing } = await supabase
        .from("loyalty_points")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from("loyalty_points")
        .insert({ user_id: user.id, points: 0, lifetime_points: 0, tier: "bronze" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-points"] });
    },
  });
}

export function useEarnPoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      points,
      description,
      order_id,
      type = "earned",
    }: {
      points: number;
      description: string;
      order_id?: string;
      type?: LoyaltyTransaction["type"];
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Get current points
      const { data: current, error: fetchError } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw new Error(`Failed to fetch points: ${fetchError.message}`);

      if (!current) {
        // Initialize if doesn't exist
        const { error: insertError } = await supabase.from("loyalty_points").insert({
          user_id: user.id,
          points,
          lifetime_points: points,
          tier: "bronze",
        });
        if (insertError) throw new Error(`Failed to initialize points: ${insertError.message}`);
      } else {
        const newPoints = current.points + points;
        const newLifetime = current.lifetime_points + points;
        const newTier = calculateTier(newLifetime);

        const { error: updateError } = await supabase
          .from("loyalty_points")
          .update({
            points: newPoints,
            lifetime_points: newLifetime,
            tier: newTier,
          })
          .eq("user_id", user.id);

        if (updateError) throw new Error(`Failed to update points: ${updateError.message}`);
      }

      // Record transaction
      const { error: txError } = await supabase.from("loyalty_transactions").insert({
        user_id: user.id,
        points,
        type,
        description,
        order_id: order_id || null,
      });

      if (txError) throw new Error(`Failed to record transaction: ${txError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-points"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-transactions"] });
      toast.success("Points earned!");
    },
    onError: (error) => {
      toast.error("Failed to earn points", { description: error.message });
    },
  });
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      points,
      description,
    }: {
      points: number;
      description: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: current, error: fetchError } = await supabase
        .from("loyalty_points")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw new Error(`Failed to fetch points: ${fetchError.message}`);

      if (!current || current.points < points) {
        throw new Error("Insufficient points");
      }

      const { error: updateError } = await supabase
        .from("loyalty_points")
        .update({ points: current.points - points })
        .eq("user_id", user.id);

      if (updateError) throw new Error(`Failed to update points: ${updateError.message}`);

      const { error: txError } = await supabase.from("loyalty_transactions").insert({
        user_id: user.id,
        points: -points,
        type: "redeemed",
        description,
      });

      if (txError) throw new Error(`Failed to record transaction: ${txError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-points"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-transactions"] });
      toast.success("Points redeemed!");
    },
    onError: (error) => {
      toast.error("Failed to redeem points", { description: error.message });
    },
  });
}

function calculateTier(lifetimePoints: number): LoyaltyPoints["tier"] {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function getNextTier(currentTier: LoyaltyPoints["tier"]): LoyaltyPoints["tier"] | null {
  const tiers: LoyaltyPoints["tier"][] = ["bronze", "silver", "gold", "platinum"];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}

export function getPointsToNextTier(lifetimePoints: number, currentTier: LoyaltyPoints["tier"]): number {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return 0;
  return TIER_THRESHOLDS[nextTier] - lifetimePoints;
}

export function pointsToDiscount(points: number): number {
  // 100 points = ₹1 discount
  return points / 100;
}
