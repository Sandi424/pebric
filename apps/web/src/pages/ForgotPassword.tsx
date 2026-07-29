import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, RefreshCw, AlertCircle } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [rateLimited, setRateLimited] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (cooldown > 0) {
            timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanEmail = email.trim();
        if (!cleanEmail) {
            toast.error("Please enter your email address");
            return;
        }

        if (cooldown > 0) {
            toast.error(`Please wait ${cooldown} seconds before trying again.`);
            return;
        }

        setLoading(true);
        setRateLimited(false);

        try {
            // Step 1: Attempt Supabase auth resetPasswordForEmail
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (!error) {
                setEmailSent(true);
                setCooldown(60);
                toast.success("Password reset email sent!");
                return;
            }

            console.warn("Supabase auth reset password returned:", error.message, error.code);

            // Step 2: If Supabase rate limits (429 over_email_send_rate_limit), fallback to server mailer endpoint
            const isRateLimit =
                error.status === 429 ||
                error.code === "over_email_send_rate_limit" ||
                (error.message && error.message.toLowerCase().includes("rate limit"));

            if (isRateLimit) {
                console.log("Dispatching password reset email via server email service (/api/send-reset-email)...");
                const apiRes = await fetch("/api/send-reset-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: cleanEmail, origin: window.location.origin }),
                });

                const apiData = await apiRes.json();

                if (apiRes.ok && apiData.success) {
                    setEmailSent(true);
                    setCooldown(60);
                    toast.success("Password reset email sent!");
                    return;
                } else {
                    console.error("Server email dispatcher error:", apiData.error);
                }
            }

            throw error;
        } catch (error: any) {
            toast.error(error.message || "Failed to send reset email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl shadow-sm border border-border">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
                        Forgot your password?
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {emailSent ? (
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-800 space-y-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3 flex-1">
                                <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                    {rateLimited ? "Request Processed" : "Email sent"}
                                </h3>
                                <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-400 space-y-2">
                                    <p>
                                        We've dispatched password reset instructions to <strong>{email}</strong>.
                                    </p>
                                    <p>
                                        Please check your inbox and spam folder. Click the reset link in the email to set a new password.
                                    </p>
                                    {rateLimited && (
                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-800">
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                            <span>
                                                If you requested multiple links recently, please allow up to a minute for delivery.
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                    <Button
                                        variant="outline"
                                        className="w-full text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                        onClick={() => {
                                            setEmailSent(false);
                                            setRateLimited(false);
                                        }}
                                    >
                                        Try another email
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        disabled={cooldown > 0 || loading}
                                        className="w-full text-xs text-muted-foreground"
                                        onClick={handleResetPassword}
                                    >
                                        {cooldown > 0 ? (
                                            `Resend in ${cooldown}s`
                                        ) : (
                                            <span className="flex items-center justify-center gap-1">
                                                <RefreshCw className="h-3 w-3" /> Resend email
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="email" className="sr-only">
                                    Email address
                                </Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <Button type="submit" className="w-full" disabled={loading || cooldown > 0}>
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Sending link...
                                    </span>
                                ) : cooldown > 0 ? (
                                    `Please wait ${cooldown}s`
                                ) : (
                                    "Send reset link"
                                )}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="text-center mt-6">
                    <Link
                        to="/login"
                        className="flex items-center justify-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
}

