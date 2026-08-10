import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralCode, useCreateReferralCode, useReferrals, useApplyReferralCode } from "@/hooks/useReferrals";
import { Copy, Check, Users, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";

export default function Referrals() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: referralCode, isLoading } = useReferralCode();
  const { data: referrals = [] } = useReferrals();
  const createCode = useCreateReferralCode();
  const applyCode = useApplyReferralCode();
  
  const [copied, setCopied] = useState(false);
  const [applyCodeInput, setApplyCodeInput] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const handleCopy = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (referralCode) {
      const shareUrl = `${window.location.origin}/signup?ref=${referralCode.code}`;
      if (navigator.share) {
        navigator.share({
          title: "Join PawStyle!",
          text: `Use my referral code ${referralCode.code} to get bonus points on your first order!`,
          url: shareUrl,
        });
      } else {
        navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied!");
      }
    }
  };

  const handleApplyCode = () => {
    if (applyCodeInput.trim()) {
      applyCode.mutate(applyCodeInput.trim());
      setApplyCodeInput("");
    }
  };

  if (authLoading || isLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-6 py-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEOHead title="Referral Program" description="Share Pebric with friends and earn rewards together." noindex={true} />
      <div className="container mx-auto px-6 py-16">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-medium">Referral Program</h1>
          <p className="mt-2 text-muted-foreground">
            Share PawStyle with friends and earn rewards together
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Your Referral Code */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-xl font-medium mb-4">Your Referral Code</h2>
              
              {referralCode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-lg font-bold tracking-wider">
                      {referralCode.code}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleShare}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-3xl font-bold">{referralCode.uses_count}</p>
                      <p className="text-sm text-muted-foreground">Friends Referred</p>
                    </div>
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-3xl font-bold">{referralCode.uses_count * referralCode.reward_points}</p>
                      <p className="text-sm text-muted-foreground">Points Earned</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gift className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Create your referral code to start earning rewards
                  </p>
                  <Button
                    onClick={() => createCode.mutate()}
                    disabled={createCode.isPending}
                    className="mt-4"
                  >
                    {createCode.isPending ? "Creating..." : "Create Referral Code"}
                  </Button>
                </div>
              )}
            </div>

            {/* Apply a Code */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-display text-xl font-medium mb-4">Have a Referral Code?</h2>
              <div className="flex gap-3">
                <Input
                  value={applyCodeInput}
                  onChange={(e) => setApplyCodeInput(e.target.value.toUpperCase())}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter referral code"
                  className="flex-1"
                />
                <Button
                  onClick={handleApplyCode}
                  disabled={!applyCodeInput.trim() || applyCode.isPending}
                >
                  {applyCode.isPending ? "Applying..." : "Apply"}
                </Button>
              </div>
            </div>

            {/* Referral History */}
            {referrals.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="font-display text-xl font-medium mb-4">Referral History</h2>
                <div className="divide-y divide-border">
                  {referrals.map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Friend Joined</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(ref.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <span className={`font-medium ${ref.points_awarded ? "text-green-600" : "text-muted-foreground"}`}>
                        {ref.points_awarded ? "+100 pts" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-display text-lg font-medium mb-4">How It Works</h3>
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    1
                  </span>
                  <div>
                    <p className="font-medium">Share Your Code</p>
                    <p className="text-sm text-muted-foreground">
                      Give friends your unique referral code
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    2
                  </span>
                  <div>
                    <p className="font-medium">They Sign Up</p>
                    <p className="text-sm text-muted-foreground">
                      Friends create an account using your code
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                  <div>
                    <p className="font-medium">Both Earn Rewards</p>
                    <p className="text-sm text-muted-foreground">
                      You get 100 points, they get 50 points
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="rounded-lg bg-primary/10 p-6">
              <Gift className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-lg font-medium">Earn More</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The more friends you refer, the more points you earn! No limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
