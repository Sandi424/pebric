export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: "Method not allowed" }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    const { email, origin } = body || {};

    if (!email || !email.includes("@")) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: "Valid email address required." }));
      return;
    }

    const resendApiKey = (process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || "").trim();
    const baseUrl = origin || "https://pebric.com";
    const resetLink = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #2e7d32; text-align: center;">Pebric - Password Reset</h2>
        <p style="font-size: 16px; color: #333;">Hello,</p>
        <p style="font-size: 15px; color: #555;">We received a request to reset your password for your Pebric account (<strong>${email}</strong>).</p>
        <p style="font-size: 15px; color: #555;">Click the button below to set up a new password:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" 
             style="background-color: #d97706; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">Pebric • Matching Outfits for Pets & Owners</p>
      </div>
    `;

    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Pebric Security <onboarding@resend.dev>",
            to: [email],
            subject: "Reset your Pebric password",
            html: emailHtml,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok && resendData.id) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            message: "Password reset email sent and delivered!",
            messageId: resendData.id,
          }));
          return;
        }
      } catch (e) {
        console.warn("Resend REST API failed for reset email, falling back to SMTP:", e);
      }

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: { user: "resend", pass: resendApiKey },
      });

      const info = await transporter.sendMail({
        from: "Pebric Security <onboarding@resend.dev>",
        to: email,
        subject: "Reset your Pebric password",
        html: emailHtml,
      });

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        message: "Password reset email sent and delivered!",
        messageId: info.messageId,
      }));
      return;
    }

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: "RESEND_API_KEY is not configured." }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: false, error: err?.message || "Failed to send reset email" }));
  }
}
