import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { SEOHead } from "@/components/SEOHead";

const STORAGE_KEY = "pebric_signup_draft";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function Signup() {
  const navigate = useNavigate();
  const { signUp, signIn, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({});
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // ─── Restore form state from sessionStorage ───
  const [name, setName] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").name ?? ""; } catch { return ""; }
  });
  const [email, setEmail] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").email ?? ""; } catch { return ""; }
  });
  const [password, setPassword] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").password ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved && JSON.parse(saved).agreed) setAgreed(true);
    } catch { /* ignore */ }
  }, []);

  // Persist form state
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ name, email, password, agreed })); } catch { /* ignore */ }
  }, [name, email, password, agreed]);

  // Real-time email format validation
  useEffect(() => {
    if (touchedEmail) {
      const result = signupSchema.shape.email.safeParse(email);
      setErrors((prev) => ({
        ...prev,
        email: result.success ? undefined : result.error.errors[0].message,
      }));
    }
  }, [email, touchedEmail]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const clearDraft = () => { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } };

  const finishSuccess = (msg = "Welcome to Pebric!") => {
    clearDraft();
    // Resume pending Buy Now flow
    try {
      const pending = sessionStorage.getItem("pebric_buynow_pending");
      if (pending) {
        const items = JSON.parse(pending);
        sessionStorage.removeItem("pebric_buynow_pending");
        toast.success("Account created successfully!", { description: "Resuming your purchase..." });
        navigate("/checkout", { state: { buyNowItems: items } });
        return;
      }
    } catch { /* ignore */ }
    toast.success("Account created successfully!", { description: msg });
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const validation = signupSchema.safeParse({ name, email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // ─── Step 1: Attempt signup ───────────────────────────────────────────────
    const { data, error } = await signUp(email, password, name);

    if (error) {
      setIsLoading(false);
      const msg = (error as any)?.message ?? "";
      const code = (error as any)?.code ?? "";
      const lower = msg.toLowerCase();

      // Supabase rate-limit: "email rate limit exceeded" or "over_email_send_rate_limit"
      if (
        code === "over_email_send_rate_limit" ||
        lower.includes("rate limit") ||
        lower.includes("email rate") ||
        (error as any)?.status === 429
      ) {
        // Rate limited — try signing in to see if account exists with these credentials
        const { error: signInErr } = await signIn(email, password);
        if (!signInErr) {
          // Account exists and credentials match — log them in
          finishSuccess("Welcome back!");
          return;
        }
        // Rate limit hit and can't sign in — account doesn't exist yet but can't create
        setErrors({
          general: "Too many sign-up attempts. Please wait a few minutes and try again, or sign in if you already have an account.",
        });
        toast.error("Too many attempts", {
          description: "Please wait a few minutes before trying again.",
        });
        return;
      }

      // Duplicate email
      if (lower.includes("already registered") || lower.includes("user already registered") || lower.includes("email already in use")) {
        setErrors({ email: "An account with this email already exists. Please sign in instead." });
        toast.error("Email already registered", { description: "Please sign in instead." });
        return;
      }

      // Any other error — log to console for debugging, show generic message
      console.error("[Signup] Supabase auth error:", { code, msg, error });
      setErrors({ general: "Something went wrong. Please try again." });
      toast.error("Signup failed", { description: "Please try again in a moment." });
      return;
    }

    // ─── Step 2: Handle empty identities (email already in use, confirmation pending) ───
    // ─── Supabase: email already in "pending confirmation" state ───
    // Supabase returns empty identities when email confirmation is ON
    // and the email was already used (confirmed OR unconfirmed).
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      // Try signing in to see if credentials work
      const { error: signInErr } = await signIn(email, password);
      if (!signInErr) {
        // Account exists + credentials match → log them in
        setIsLoading(false);
        finishSuccess("Welcome back!");
        return;
      }
      
      setIsLoading(false);
      const signInMsg = (signInErr as any)?.message ?? "";
      
      if (signInMsg.toLowerCase().includes("not confirmed") || signInMsg.toLowerCase().includes("email not confirmed")) {
        // Account exists but was never confirmed — give clear guidance
        setErrors({
          email: "This email is registered but not yet verified. Please check your inbox for a verification email, or contact support.",
        });
        toast.error("Email not verified", {
          description: "Check your inbox for a verification link, or use a different email to create a new account.",
        });
      } else {
        // Credentials don't match — email is taken by someone else
        setErrors({ email: "An account with this email already exists. Please sign in instead." });
        toast.error("Email already registered", { description: "Please sign in instead." });
      }
      return;
    }

    // ─── Step 3: Signup succeeded ───────────────────────────────────────────────
    // If session is null, Supabase requires email confirmation.
    // Try to sign in immediately to bypass this.
    if (!data?.session) {
      const { error: signInErr } = await signIn(email, password);
      if (!signInErr) {
        // Auto-login successful
        setIsLoading(false);
        finishSuccess();
        return;
      }
      // Email confirmation strictly enforced — inform user
      setIsLoading(false);
      clearDraft();
      toast.success("Account created!", {
        description: "Check your email to verify your account, then sign in.",
      });
      navigate("/login");
      return;
    }

    // Session returned immediately (email confirmation disabled) — success!
    setIsLoading(false);
    finishSuccess();
  };

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead
        title="Create Account"
        description="Join Pebric — create your account to access exclusive pet fashion collections and rewards."
        noindex={true}
      />
      <div className="container mx-auto px-6 py-10 md:py-12">
        <div className="mx-auto max-w-md space-y-8">
          <div className="text-center">
            <h1 className="mb-3 font-display text-4xl font-medium">Join the Club</h1>
            <p className="font-body text-muted-foreground">
              Create an account to start your pebric journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block font-body text-sm font-medium">Full Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={`h-12 ${errors.name ? "border-destructive" : ""}`}
                required
              />
              {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-2 block font-body text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Clear server-set email error on change
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                onBlur={() => setTouchedEmail(true)}
                placeholder="your@email.com"
                className={`h-12 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                required
              />
              {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-2 block font-body text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-12 pr-12 ${errors.password ? "border-destructive" : ""}`}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
              <p className="mt-1 font-body text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <label className="flex items-start gap-2 font-body text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-foreground"
                required
              />
              <span className="text-muted-foreground">
                I agree to the{" "}
                <Link to="/terms" className="text-foreground underline">Terms of Service</Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-foreground underline">Privacy Policy</Link>
              </span>
            </label>

            {errors.general && <p className="text-sm text-destructive">{errors.general}</p>}

            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-8 text-center font-body text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground underline">Sign in</Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
