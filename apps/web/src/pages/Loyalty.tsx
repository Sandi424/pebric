import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useLoyaltyPoints,
  useLoyaltyTransactions,
  useInitializeLoyalty,
  TIER_THRESHOLDS,
  TIER_BENEFITS,
  getNextTier,
  getPointsToNextTier,
  pointsToDiscount,
  useEarnPoints,
  useRedeemPoints,
} from "@/hooks/useLoyalty";
import {
  Award,
  Gift,
  Star,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CalendarCheck,
  ShoppingBag,
  Share2,
  CheckCircle2,
  Crown,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";
import { toast } from "sonner";

const tierGradients = {
  bronze: "from-[#8b6540] to-[#a67c52]",
  silver: "from-[#6b7280] to-[#9ca3af]",
  gold: "from-[#b8860b] to-[#daa520]",
  platinum: "from-[#5b21b6] to-[#7c3aed]",
};

const tierIcons = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

export default function Loyalty() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: loyaltyPoints, isLoading } = useLoyaltyPoints();
  const { data: transactions = [] } = useLoyaltyTransactions();
  const initLoyalty = useInitializeLoyalty();
  const earnPoints = useEarnPoints();
  const redeemPoints = useRedeemPoints();

  const [dailyClaimed, setDailyClaimed] = useState(false);

  // Check if daily reward was already claimed today — validate against actual DB transactions
  useEffect(() => {
    const today = new Date().toDateString();
    const hasTodayBonus = transactions.some((tx) => {
      if (tx.type !== "bonus" || !tx.description?.includes("Daily check-in")) return false;
      return new Date(tx.created_at).toDateString() === today;
    });
    if (hasTodayBonus) {
      setDailyClaimed(true);
    } else {
      const lastClaim = localStorage.getItem("pebric_daily_claim");
      if (lastClaim) {
        const lastDate = new Date(lastClaim).toDateString();
        if (lastDate !== today) {
          setDailyClaimed(false);
        }
      }
    }
  }, [transactions]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !loyaltyPoints && !isLoading) {
      initLoyalty.mutate();
    }
  }, [user, loyaltyPoints, isLoading, initLoyalty]);

  const handleDailyCheckin = useCallback(() => {
    if (dailyClaimed) {
      toast.info("Already claimed today! Come back tomorrow.");
      return;
    }
    earnPoints.mutate(
      {
        points: 10,
        description: "Daily check-in reward",
        type: "bonus",
      },
      {
        onSuccess: () => {
          setDailyClaimed(true);
          localStorage.setItem("pebric_daily_claim", new Date().toISOString());
        },
      }
    );
  }, [dailyClaimed, earnPoints]);

  const handleRedeem = useCallback(
    (pointsToRedeem: number) => {
      const discount = pointsToRedeem / 100;
      redeemPoints.mutate({
        points: pointsToRedeem,
        description: `Redeemed for ₹${discount} discount`,
      });
    },
    [redeemPoints]
  );

  if (authLoading || isLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-6 py-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8b6540] border-t-transparent" />
        </div>
      </PageLayout>
    );
  }

  const points = loyaltyPoints?.points || 0;
  const lifetimePoints = loyaltyPoints?.lifetime_points || 0;
  const tier = loyaltyPoints?.tier || "bronze";
  const nextTier = getNextTier(tier);
  const pointsToNext = getPointsToNextTier(lifetimePoints, tier);
  const benefits = TIER_BENEFITS[tier];
  const discountValue = pointsToDiscount(points);

  const progressToNextTier = nextTier
    ? ((lifetimePoints - TIER_THRESHOLDS[tier]) /
        (TIER_THRESHOLDS[nextTier] - TIER_THRESHOLDS[tier])) *
      100
    : 100;

  const redemptionOptions = [
    { points: 100, discount: "₹1", label: "Small Reward", icon: Gift },
    { points: 500, discount: "₹5", label: "Medium Reward", icon: Award },
    { points: 1000, discount: "₹10", label: "Big Reward", icon: Crown },
  ];

  return (
    <PageLayout>
      <SEOHead
        title="Loyalty Rewards"
        description="Earn points on every Pebric purchase and unlock exclusive member benefits and discounts."
        noindex={true}
      />

      {/* Hero Header */}
      <div className="border-b border-border/20">
        <div className="container mx-auto px-6 pt-10 pb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Loyalty Rewards
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            Earn points on every purchase and unlock exclusive benefits
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">

            {/* Points Card */}
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tierGradients[tier]} p-8 text-white`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-body text-sm opacity-80 tracking-wide uppercase">Available Points</p>
                    <p className="font-display text-4xl font-bold sm:text-5xl mt-1">
                      {points.toLocaleString()}
                    </p>
                    <p className="mt-2 font-body text-sm opacity-70">
                      Worth ₹{discountValue.toFixed(2)} in discounts
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-5xl sm:text-6xl">{tierIcons[tier]}</div>
                    <p className="mt-2 font-display text-lg font-semibold capitalize">
                      {tier} Member
                    </p>
                  </div>
                </div>

                {nextTier && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between font-body text-xs mb-2 uppercase tracking-wide">
                      <span className="opacity-80">Progress to {nextTier}</span>
                      <span>{pointsToNext.toLocaleString()} points to go</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(progressToNextTier, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Daily Check-in */}
              <button
                onClick={handleDailyCheckin}
                disabled={dailyClaimed || earnPoints.isPending}
                className={`group rounded-2xl border p-5 text-left transition-all duration-300 ${
                  dailyClaimed
                    ? "border-[#8b6540]/30 bg-[#8b6540]/5"
                    : "border-border/20 bg-background hover:border-[#8b6540]/40 hover:shadow-soft"
                }`}
              >
                <div className="flex items-center gap-3">
                  {dailyClaimed ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6540]/10">
                      <CheckCircle2 className="h-5 w-5 text-[#8b6540]" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6540]/10 group-hover:bg-[#8b6540]/20 transition-colors">
                      <CalendarCheck className="h-5 w-5 text-[#8b6540]" />
                    </div>
                  )}
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">
                      {dailyClaimed ? "Claimed!" : "Daily Check-in"}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {dailyClaimed
                        ? "Come back tomorrow"
                        : earnPoints.isPending
                        ? "Claiming..."
                        : "+10 points"}
                    </p>
                  </div>
                </div>
              </button>

              {/* Points Multiplier */}
              <div className="rounded-2xl border border-border/20 bg-background p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6540]/10">
                    <TrendingUp className="h-5 w-5 text-[#8b6540]" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">
                      {benefits.pointsMultiplier}x Multiplier
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      Earn {benefits.pointsMultiplier} pts per ₹1
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Discount */}
              <div className="rounded-2xl border border-border/20 bg-background p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6540]/10">
                    <Zap className="h-5 w-5 text-[#8b6540]" />
                  </div>
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">{benefits.discount}% Off</p>
                    <p className="font-body text-xs text-muted-foreground capitalize">
                      {tier} member discount
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Redeem Points */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold tracking-tight">Redeem Your Points</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {redemptionOptions.map((option) => {
                  const IconComp = option.icon;
                  return (
                    <div
                      key={option.points}
                      className="rounded-2xl border border-border/20 bg-background p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b6540]/10 mb-3">
                          <IconComp className="h-5 w-5 text-[#8b6540]" />
                        </div>
                        <p className="font-display text-xl font-bold text-foreground">
                          {option.discount} OFF
                        </p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5">
                          {option.label} · {option.points} pts
                        </p>
                      </div>
                      <button
                        onClick={() => handleRedeem(option.points)}
                        disabled={points < option.points || redeemPoints.isPending}
                        className="mt-4 w-full rounded-sm border border-foreground/80 bg-foreground px-4 py-2 font-body text-xs font-semibold text-background uppercase tracking-wider transition-all hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {redeemPoints.isPending
                          ? "Redeeming..."
                          : points < option.points
                          ? `Need ${(option.points - points).toLocaleString()} more`
                          : `Redeem`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transaction History */}
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight mb-4">
                Points History
              </h2>
              {transactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center">
                  <Star className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-4 font-body text-sm text-muted-foreground">
                    No transactions yet
                  </p>
                  <p className="font-body text-xs text-muted-foreground mt-1">
                    Claim your daily check-in or start shopping to earn points!
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/20 divide-y divide-border/20">
                  {transactions.slice(0, 15).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            tx.points > 0
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {tx.points > 0 ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="font-body text-sm font-medium capitalize text-foreground">
                            {tx.type.replace("_", " ")}
                          </p>
                          <p className="font-body text-xs text-muted-foreground">
                            {tx.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-body text-sm font-bold ${
                            tx.points > 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {tx.points > 0 ? "+" : ""}
                          {tx.points}
                        </p>
                        <p className="font-body text-[11px] text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Membership Tiers */}
            <div className="rounded-2xl border border-border/20 bg-background p-6">
              <h3 className="font-display text-lg font-semibold mb-4">
                Membership Tiers
              </h3>
              <div className="space-y-3">
                {(["bronze", "silver", "gold", "platinum"] as const).map(
                  (t) => (
                    <div
                      key={t}
                      className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                        t === tier
                          ? "bg-[#8b6540]/10 border border-[#8b6540]/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <span className="text-xl">{tierIcons[t]}</span>
                      <div className="flex-1">
                        <p className="font-body text-sm font-semibold capitalize text-foreground">{t}</p>
                        <p className="font-body text-[11px] text-muted-foreground">
                          {TIER_THRESHOLDS[t].toLocaleString()}+ points
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-body text-xs font-semibold text-foreground">{TIER_BENEFITS[t].pointsMultiplier}x</p>
                        <p className="font-body text-[11px] text-muted-foreground">
                          {TIER_BENEFITS[t].discount}% off
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* How to Earn */}
            <div className="rounded-2xl border border-border/20 bg-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-[#8b6540]" />
                <h3 className="font-display text-lg font-semibold">
                  How to Earn
                </h3>
              </div>
              <ul className="space-y-3">
                {[
                  { icon: CalendarCheck, label: "Daily check-in", value: "10 pts" },
                  { icon: ShoppingBag, label: "Make a purchase", value: "1 pt/₹1" },
                  { icon: Star, label: "Write a review", value: "50 pts" },
                  { icon: Share2, label: "Refer a friend", value: "200 pts" },
                  { icon: Gift, label: "Birthday bonus", value: "100 pts" },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-3">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 font-body text-sm text-foreground/80">{item.label}</span>
                    <span className="font-body text-xs font-semibold text-foreground">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Points Value */}
            <div className="rounded-2xl border border-border/20 bg-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-[#8b6540]" />
                <h3 className="font-display text-lg font-semibold">
                  Points Value
                </h3>
              </div>
              <p className="font-body text-xs text-muted-foreground mb-4">
                100 points = ₹1 discount at checkout
              </p>
              <div className="text-center p-5 bg-[#8b6540]/5 rounded-xl border border-[#8b6540]/10">
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wide">
                  Your {points.toLocaleString()} points are worth
                </p>
                <p className="font-display text-3xl font-bold text-foreground mt-1">
                  ₹{discountValue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
