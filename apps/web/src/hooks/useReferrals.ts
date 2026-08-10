import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  uses_count: number;
  reward_points: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code_id: string;
  points_awarded: boolean;
  created_at: string;
}

export function useReferralCode() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data?.[0] as ReferralCode) || null;
    },
    enabled: !!user,
  });
}

export function useCreateReferralCode() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Check if user already has a referral code
      const { data: existing, error: checkError } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!checkError && existing && existing.length > 0) {
        return existing[0] as ReferralCode;
      }
      
      // Generate unique code
      const code = `PAWFRIEND${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from("referral_codes")
        .insert({
          user_id: user.id,
          code,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReferralCode;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["referral-code", user?.id], data);
      queryClient.invalidateQueries({ queryKey: ["referral-code"] });
      toast.success("Referral code ready!");
    },
    onError: (error) => {
      toast.error("Failed to create code", { description: error.message });
    },
  });
}

export function useReferrals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Referral[];
    },
    enabled: !!user,
  });
}

export function useApplyReferralCode() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("Not authenticated");
      
      // Find the referral code
      const { data: referralCodes, error: codeError } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("code", code.toUpperCase())
        .limit(1);

      const referralCode = referralCodes?.[0];
      if (codeError || !referralCode) {
        throw new Error("Invalid referral code");
      }

      if (referralCode.user_id === user.id) {
        throw new Error("You cannot use your own referral code");
      }

      // Check if already referred
      const { data: existingRows } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_id", user.id)
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        throw new Error("You have already used a referral code");
      }

      // Create referral
      const { error } = await supabase
        .from("referrals")
        .insert({
          referrer_id: referralCode.user_id,
          referred_id: user.id,
          referral_code_id: referralCode.id,
        });

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Referral code applied!", {
        description: "You'll receive bonus points on your first order.",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
