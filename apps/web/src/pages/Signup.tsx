import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, LogIn, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/client";
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

  // Dedicated state for "email already exists" scenario
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);

  // State for "email confirmation pending" scenario
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // Clear the "email already exists" state when user changes email
      if (emailAlreadyExists) setEmailAlreadyExists(false);
    }
  }, [email, touchedEmail]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Poll for session when confirmation is pending
  useEffect(() => {
    if (confirmationPending && !pollIntervalRef.current) {
      setIsPolling(true);
      pollIntervalRef.current = setInterval(async () => {
        try {
          // Try signing in to check if email was confirmed
          const { error } = await signIn(confirmationEmail, confirmationPassword);
          if (!error) {
            // Email was confirmed and signed in!
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setIsPolling(false);
            clearDraft();
            toast.success("Email confirmed! Welcome to Pebric! 🎉");
            navigate("/");
          }
          // If error, keep polling (email not confirmed yet)
        } catch {
          // Continue polling
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [confirmationPending]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

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

  const startResendCooldown = () => {
    setResendCooldown(60);
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current!);
          cooldownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
      });
      if (!error) {
        toast.success("Confirmation email resent!", {
          description: "Please check your inbox and spam folder.",
        });
        startResendCooldown();
      } else {
        toast.error("Failed to resend", { description: error.message });
      }
    } catch {
      toast.error("Failed to resend confirmation email");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setEmailAlreadyExists(false);

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

    try {
      // ─── Step 1: Attempt signup ─────────────────────────────────────────
      const { data, error } = await signUp(email, password, name);

      if (error) {
        const msg = (error as any)?.message ?? "";
        const code = (error as any)?.code ?? "";
        const lower = msg.toLowerCase();

        // Rate-limit error
        if (
          code === "over_email_send_rate_limit" ||
          lower.includes("rate limit") ||
          lower.includes("email rate") ||
          (error as any)?.status === 429
        ) {
          console.error("[Signup] Rate limit hit:", { code, msg });
          setErrors({
            general: "Too many sign-up attempts. Please wait a few minutes and try again.",
          });
          toast.error("Too many attempts", {
            description: "Please wait a few minutes before trying again.",
          });
          setIsLoading(false);
          return;
        }

        // Duplicate email - explicit error from Supabase
        if (
          code === "user_already_exists" ||
          code === "email_exists" ||
          lower.includes("already registered") ||
          lower.includes("user already registered") ||
          lower.includes("email already in use") ||
          lower.includes("already been registered") ||
          lower.includes("already exists")
        ) {
          setEmailAlreadyExists(true);
          setIsLoading(false);
          return;
        }

        // Any other error
        console.error("[Signup] Supabase auth error:", { code, msg, error });
        setErrors({ general: "Something went wrong. Please try again." });
        toast.error("Signup failed", { description: "Please try again in a moment." });
        setIsLoading(false);
        return;
      }

      // ─── Step 2: Check for empty identities (email already in use) ──────
      // When Supabase has email confirmation enabled and the email is already
      // registered, it returns a user object with an empty identities array
      // instead of an error. We must detect this and show "already exists".
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        // Email is already registered — do NOT auto-login, do NOT redirect
        setEmailAlreadyExists(true);
        setIsLoading(false);
        return;
      }

      // ─── Step 3: Signup succeeded — auto-login ──────────────────────────
      // If session is returned immediately (email confirmation disabled), we're done
      if (data?.session) {
        setIsLoading(false);
        finishSuccess();
        return;
      }

      // If no session (email confirmation is ON server-side), try to sign in
      // immediately. This works if the account was already confirmed or if
      // Supabase doesn't require confirmation for new accounts.
      const { error: signInErr } = await signIn(email, password);
      if (!signInErr) {
        setIsLoading(false);
        finishSuccess();
        return;
      }

      // Sign-in failed (likely "Email not confirmed") — try auto-confirm via RPC
      console.log("[Signup] Attempting auto-confirm via RPC...");
      const { error: rpcError } = await supabase.rpc("auto_confirm_user", {
        user_email: email,
      });

      if (!rpcError) {
        // Wait briefly for Supabase to propagate the email confirmation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Retry sign-in after confirmation
        const { error: retryErr } = await signIn(email, password);
        if (!retryErr) {
          setIsLoading(false);
          finishSuccess();
          return;
        }

        // Try one more time after another pause
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { error: finalRetryErr } = await signIn(email, password);
        if (!finalRetryErr) {
          setIsLoading(false);
          finishSuccess();
          return;
        }
        console.error("[Signup] Sign-in failed even after auto-confirm:", finalRetryErr);
      } else {
        console.log("[Signup] Auto-confirm RPC not available:", rpcError?.message || rpcError);
      }

      // ─── Final fallback: Show confirmation pending UI ────────────────────
      // Account IS created but email confirmation is required.
      // Show a friendly UI with session polling so user is auto-redirected
      // as soon as they click the confirmation link in their email.
      setIsLoading(false);
      setConfirmationEmail(email);
      setConfirmationPassword(password);
      clearDraft();
      setConfirmationPending(true);
      startResendCooldown();

    } catch (err) {
      console.error("[Signup] Unexpected error:", err);
      setErrors({ general: "Something went wrong. Please try again." });
      setIsLoading(false);
    }
  };

  // ─── Confirmation Pending UI ─────────────────────────────────────────────
  if (confirmationPending) {
    return (
      <PageLayout showNewsletter={false}>
        <SEOHead
          title="Confirm Your Email"
          description="Please check your email to confirm your Pebric account."
          noindex={true}
        />
        <div className="container mx-auto px-6 py-10 md:py-16">
          <div className="mx-auto max-w-md space-y-8 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-10 w-10 text-primary" />
              </div>
            </div>

            {/* Heading */}
            <div>
              <h1 className="mb-3 font-display text-3xl font-medium">Check Your Email</h1>
              <p className="font-body text-muted-foreground">
                We've sent a confirmation link to
              </p>
              <p className="mt-1 font-body font-semibold text-foreground">{confirmationEmail}</p>
            </div>

            {/* Instructions */}
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-left space-y-3">
              <p className="font-body text-sm text-foreground font-medium">Next steps:</p>
              <ol className="space-y-2 font-body text-sm text-muted-foreground list-decimal list-inside">
                <li>Open your email inbox</li>
                <li>Find the email from Pebric</li>
                <li>Click the <strong className="text-foreground">"Confirm your email"</strong> link</li>
                <li>You'll be automatically signed in and redirected here</li>
              </ol>
            </div>

            {/* Polling indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {isPolling && (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Waiting for confirmation...</span>
                </>
              )}
            </div>

            {/* Resend button */}
            <div className="space-y-3">
              <p className="font-body text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleResendConfirmation}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? (
                  <>Resend in {resendCooldown}s</>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Resend Confirmation Email
                  </>
                )}
              </Button>
            </div>

            {/* Already confirmed link */}
            <div className="border-t border-border pt-6 space-y-3">
              <p className="font-body text-sm text-muted-foreground">
                Already confirmed your email?
              </p>
              <Button
                variant="default"
                className="w-full gap-2"
                onClick={() => {
                  if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                  }
                  navigate("/login");
                }}
              >
                <LogIn className="h-4 w-4" />
                Sign In Now
              </Button>
            </div>

            {/* Success indicator for confirmed */}
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Account created successfully</span>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

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

          {/* ── Email Already Exists Banner ── */}
          {emailAlreadyExists && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-700 dark:bg-amber-950/40">
              <p className="mb-1 font-display text-base font-medium text-amber-900 dark:text-amber-200">
                An account with this email already exists.
              </p>
              <p className="mb-4 font-body text-sm text-amber-700 dark:text-amber-400">
                Please sign in instead.
              </p>
              <Link to="/login">
                <Button variant="default" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            </div>
          )}

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
                  if (emailAlreadyExists) setEmailAlreadyExists(false);
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
