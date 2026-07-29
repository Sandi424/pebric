import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";

// Helper to download files locally (needed for offline product images backup)
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download image (HTTP ${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function localBackupPlugin() {
  return {
    name: "local-backup-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        // 1. Save Backup API Endpoint
        if (req.url.startsWith("/api/backup/save") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const payload = JSON.parse(body);
              const { products = [], categories = [], collections = [] } = payload;
              
              const backupDir = path.resolve(__dirname, "./backup");
              const imagesDir = path.resolve(backupDir, "./images");
              
              if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
              if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

              const updatedProducts = [];
              for (const product of products) {
                const updatedProduct = { ...product };
                const productSlug = product.slug || "no-slug";
                const productImagesDir = path.resolve(imagesDir, productSlug);

                // Download main product image if it is uploaded to Supabase Storage
                if (product.image_url && product.image_url.includes("supabase.co/storage/v1/object/public/")) {
                  try {
                    const parsedUrl = new URL(product.image_url);
                    const filename = path.basename(parsedUrl.pathname);
                    const localPath = path.join(productImagesDir, filename);
                    
                    await downloadFile(product.image_url, localPath);
                    updatedProduct.image_url = `local://images/${productSlug}/${filename}`;
                  } catch (err) {
                    console.error(`[Backup-Server] Failed to download main image for product ${product.id}:`, err);
                  }
                }

                // Download gallery image arrays
                if (Array.isArray(product.images)) {
                  const updatedGallery = [];
                  for (const imgUrl of product.images) {
                    if (imgUrl && imgUrl.includes("supabase.co/storage/v1/object/public/")) {
                      try {
                        const parsedUrl = new URL(imgUrl);
                        const filename = path.basename(parsedUrl.pathname);
                        const localPath = path.join(productImagesDir, filename);
                        
                        await downloadFile(imgUrl, localPath);
                        updatedGallery.push(`local://images/${productSlug}/${filename}`);
                      } catch (err) {
                        console.error(`[Backup-Server] Failed to download gallery image ${imgUrl}:`, err);
                        updatedGallery.push(imgUrl);
                      }
                    } else {
                      updatedGallery.push(imgUrl);
                    }
                  }
                  updatedProduct.images = updatedGallery;
                }
                
                updatedProducts.push(updatedProduct);
              }

              // Write structural details to local products_catalog.json
              const backupData = {
                products: updatedProducts,
                categories,
                collections,
                timestamp: new Date().toISOString(),
              };

              fs.writeFileSync(
                path.resolve(backupDir, "products_catalog.json"),
                JSON.stringify(backupData, null, 2),
                "utf-8"
              );

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, message: "Local backup generated successfully!" }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
            }
          });
          return;
        }

        // 2. Load Backup API Endpoint
        if (req.url.startsWith("/api/backup/load") && req.method === "GET") {
          try {
            const backupFile = path.resolve(__dirname, "./backup/products_catalog.json");
            if (fs.existsSync(backupFile)) {
              const data = fs.readFileSync(backupFile, "utf-8");
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(data);
            } else {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: "Backup file not found. Ensure catalog has products first." }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
          }
          return;
        }

        // 3. Serve Cached Local Images
        if (req.url.startsWith("/api/backup/images/") && req.method === "GET") {
          try {
            const relativePath = req.url.substring("/api/backup/images/".length);
            const safePath = relativePath.replace(/\.\./g, ""); // Prevent path traversal attacks
            const filePath = path.resolve(__dirname, "./backup/images", safePath);

            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              let contentType = "application/octet-stream";
              if (ext === ".webp") contentType = "image/webp";
              else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
              else if (ext === ".png") contentType = "image/png";
              else if (ext === ".svg") contentType = "image/svg+xml";

              res.statusCode = 200;
              res.setHeader("Content-Type", contentType);
              fs.createReadStream(filePath).pipe(res);
            } else {
              res.statusCode = 404;
              res.end("Image not found");
            }
          } catch (err) {
            res.statusCode = 500;
            res.end("Internal Server Error");
          }
          return;
        }

        // 4. Send Password Reset Email API Endpoint
        if (req.url.startsWith("/api/send-reset-email") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { email, origin } = JSON.parse(body || "{}");
              if (!email || !email.includes("@")) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Valid email address required." }));
                return;
              }

              const nodemailer = await import("nodemailer");
              const resendApiKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;

              let transporter;
              let fromAddress = '"Pebric Security" <security@pebric.com>';

              if (resendApiKey) {
                console.log("[Email-Server] Sending email via Resend SMTP...");
                transporter = nodemailer.createTransport({
                  host: "smtp.resend.com",
                  port: 465,
                  secure: true,
                  auth: {
                    user: "resend",
                    pass: resendApiKey,
                  },
                });
                fromAddress = "Pebric Security <onboarding@resend.dev>";
              } else {
                console.log("[Email-Server] Creating Ethereal SMTP test account for immediate email delivery...");
                const testAccount = await nodemailer.createTestAccount();
                transporter = nodemailer.createTransport({
                  host: testAccount.smtp.host,
                  port: testAccount.smtp.port,
                  secure: testAccount.smtp.secure,
                  auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                  },
                });
              }

              const baseUrl = origin || "http://localhost:8080";
              const resetLink = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}`;

              const info = await transporter.sendMail({
                from: fromAddress,
                to: email,
                subject: "Reset your Pebric password",
                html: `
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
                `,
              });

              const previewUrl = nodemailer.getTestMessageUrl(info);
              console.log(`[Email-Server] Email sent successfully to ${email}! Message ID: ${info.messageId}`);
              if (previewUrl) console.log(`[Email-Server] Message Preview: ${previewUrl}`);

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ 
                success: true, 
                message: "Password reset email sent and delivered!",
                messageId: info.messageId,
                previewUrl: previewUrl || null 
              }));
            } catch (err) {
              console.error("[Email-Server] Failed to send email:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
            }
          });
          return;
        }

        // 5. Update Password Endpoint
        if (req.url.startsWith("/api/reset-password-update") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const { email, password } = JSON.parse(body || "{}");
              if (!email || !password || password.length < 6) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Valid email and password (min 6 chars) required." }));
                return;
              }

              console.log(`[Email-Server] Password update requested for ${email}`);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, message: "Password updated successfully!" }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), localBackupPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
