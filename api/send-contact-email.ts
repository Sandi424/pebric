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
    const { name, email, subject, message } = body || {};

    if (!name || !email || !message) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: "Name, email, and message are required." }));
      return;
    }

    const resendApiKey = (process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || "").trim();
    const smtpHost = process.env.SMTP_HOST || process.env.VITE_SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || process.env.VITE_SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || process.env.VITE_SMTP_USER || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.VITE_SMTP_PASS || process.env.GMAIL_APP_PASS;

    const emailSubject = subject ? `[Contact Form] ${subject}` : `[Contact Form] Message from ${name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #1a365d; margin-top: 0;">New Contact Message — Pebric</h2>
        <p style="font-size: 15px;"><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
        <p style="font-size: 15px;"><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;" />
        <p style="font-size: 15px; color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;" />
        <p style="font-size: 12px; color: #888;">Sent to pebricin@gmail.com from Pebric Contact Form.</p>
      </div>
    `;

    if (resendApiKey) {
      console.log("[Contact-Email] Sending contact form email via Resend API to pebricin@gmail.com...");
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Pebric Contact <onboarding@resend.dev>",
            to: ["pebricin@gmail.com"],
            reply_to: `${name} <${email}>`,
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok && resendData.id) {
          console.log(`[Contact-Email] Successfully delivered via Resend API to pebricin@gmail.com! ID: ${resendData.id}`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            message: "Message delivered successfully to pebricin@gmail.com",
            messageId: resendData.id,
          }));
          return;
        }
        console.warn("[Contact-Email] Resend REST API returned error, trying SMTP:", resendData);
      } catch (restErr) {
        console.warn("[Contact-Email] Resend REST API fetch error, trying SMTP:", restErr);
      }

      console.log("[Contact-Email] Sending via Resend SMTP to pebricin@gmail.com...");
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: {
          user: "resend",
          pass: resendApiKey,
        },
      });

      const info = await transporter.sendMail({
        from: "Pebric Contact <onboarding@resend.dev>",
        to: "pebricin@gmail.com",
        replyTo: `${name} <${email}>`,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log(`[Contact-Email] Successfully delivered via Resend SMTP to pebricin@gmail.com! MessageId: ${info.messageId}`);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        message: "Message delivered successfully to pebricin@gmail.com",
        messageId: info.messageId,
      }));
      return;
    } else if (smtpUser && smtpPass) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const info = await transporter.sendMail({
        from: `"Pebric Contact" <${smtpUser}>`,
        to: "pebricin@gmail.com",
        replyTo: `${name} <${email}>`,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log(`[Contact-Email] Sent contact form email via SMTP to pebricin@gmail.com! ID: ${info.messageId}`);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: true,
        message: "Message delivered successfully to pebricin@gmail.com",
        messageId: info.messageId,
      }));
      return;
    } else {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: false,
        error: "Email service not configured. Please add RESEND_API_KEY to environment variables to send real emails to pebricin@gmail.com.",
      }));
      return;
    }
  } catch (err: any) {
    console.error("[Contact-Email] Failed to send email:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      success: false,
      error: err?.message || "Failed to deliver email to pebricin@gmail.com.",
    }));
  }
}
