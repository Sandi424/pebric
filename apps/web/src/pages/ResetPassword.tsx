import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, RefreshCw, KeyRound } from "lucide-react";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const emailParam = searchParams.get("email");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validatingSession, setValidatingSession] = useState(true);
    const [sessionReady, setSessionReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const verifyAndSetSession = async () => {
            try {
                // 1. Check for PKCE authorization code in URL (?code=...)
                const code = searchParams.get("code");
                if (code) {
                    console.log("Exchanging PKCE code for auth session...");
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) console.error("PKCE exchange error:", error);
                }

                // 2. Check for token_hash OTP parameter (?token_hash=...)
                const tokenHash = searchParams.get("token_hash");
                const type = searchParams.get("type");
                if (tokenHash && type === "recovery") {
                    console.log("Verifying token_hash OTP for recovery...");
                    const { error } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: "recovery",
                    });
                    if (error) console.error("OTP verification error:", error);
                }

                // 3. Give Supabase client a moment to parse hash fragment (#access_token=...)
                await new Promise((resolve) => setTimeout(resolve, 500));

                const { data: { session } } = await supabase.auth.getSession();

                if (isMounted) {
                    if (session || emailParam || window.location.hash.includes("access_token")) {
                        setSessionReady(true);
                        setValidatingSession(false);
                    } else {
                        // Allow extra 1 second for slow auth listener before declaring invalid link
                        setTimeout(async () => {
                            if (!isMounted) return;
                            const { data: { session: retrySession } } = await supabase.auth.getSession();
                            if (retrySession || emailParam) {
                                setSessionReady(true);
                                setValidatingSession(false);
                            } else {
                                toast.error("Invalid or expired reset link. Please request a new one.");
                                navigate("/forgot-password");
                            }
                        }, 1200);
                    }
                }
            } catch (err) {
                console.error("Session verification error:", err);
                if (isMounted) {
                    if (emailParam) {
                        setSessionReady(true);
                        setValidatingSession(false);
                    } else {
                        toast.error("Invalid or expired reset link. Please request a new one.");
                        navigate("/forgot-password");
                    }
                }
            }
        };

        verifyAndSetSession();

        // 4. Listen for PASSWORD_RECOVERY or SIGNED_IN events
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("ResetPassword auth event:", event, !!session);
            if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || session) && isMounted) {
                setSessionReady(true);
                setValidatingSession(false);
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, [navigate, searchParams, emailParam]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password) {
            toast.error("Please enter a new password");
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters long");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            // Attempt 1: Supabase client auth updateUser
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (!error) {
                toast.success("Password updated successfully!");
                navigate("/login");
                return;
            }

            // Attempt 2: Server API fallback
            if (emailParam) {
                const apiRes = await fetch("/api/reset-password-update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: emailParam, password }),
                });

                const apiData = await apiRes.json();
                if (apiRes.ok && apiData.success) {
                    toast.success("Password updated successfully!");
                    navigate("/login");
                    return;
                }
            }

            throw error;
        } catch (error: any) {
            toast.error(error.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    if (validatingSession) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-md p-8 rounded-xl shadow-sm border border-border bg-card text-center space-y-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <h3 className="text-lg font-semibold text-foreground">Verifying reset link...</h3>
                    <p className="text-sm text-muted-foreground">Please wait while we validate your security token.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl shadow-sm border border-border">
                <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="mt-4 text-center text-3xl font-bold tracking-tight text-foreground">
                        Set new password
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                        Please enter your new password below.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative mt-1">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <div className="relative mt-1">
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Updating password...
                                </span>
                            ) : (
                                "Reset password"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

