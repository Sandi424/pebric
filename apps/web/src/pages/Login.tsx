import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { PageLayout } from "@/components/layouts/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/client";
import { z } from "zod";
import { SEOHead } from "@/components/SEOHead";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, isAdmin, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (user && !authLoading) {
      navigate(isAdmin ? "/admin" : "/");
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(email, password);

    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid credentials", {
          description: "Please check your email and password.",
        });
      } else {
        toast.error("Login failed", {
          description: error.message,
        });
      }
      return;
    }

    toast.success("Welcome back!", {
      description: "You have successfully logged in.",
    });

    // Check if there were pending Buy Now items to resume
    try {
      const pendingItems = sessionStorage.getItem("pebric_buynow_pending");
      if (pendingItems) {
        const parsed = JSON.parse(pendingItems);
        sessionStorage.removeItem("pebric_buynow_pending");
        navigate("/checkout", { state: { buyNowItems: parsed } });
        return;
      }
    } catch {
      // ignore storage errors
    }

    // Check if this user is admin to redirect to admin panel
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .eq("role", "admin")
      .maybeSingle();

    navigate(roleData ? "/admin" : "/");
  };

  return (
    <PageLayout showNewsletter={false}>
      <SEOHead
        title="Sign In"
        description="Sign in to your Pebric account to manage orders, wishlist, and more."
        noindex={true}
      />
      <div className="container mx-auto px-6 py-10 md:py-12">
        <div className="mx-auto max-w-md space-y-8">
          <div className="text-center">
            <h1 className="mb-3 font-display text-4xl font-medium">Welcome Back</h1>
            <p className="font-body text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block font-body text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={`h-12 ${errors.email ? "border-destructive" : ""}`}
                required
              />
              {errors.email && (
                <p className="mt-1 text-sm text-destructive">{errors.email}</p>
              )}
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-body text-sm">
                <input type="checkbox" className="h-4 w-4 accent-foreground" />
                Remember me
              </label>
              <Link to="/forgot-password" className="font-body text-sm text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-8 text-center font-body text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-foreground underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
