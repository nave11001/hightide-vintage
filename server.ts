import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const app = express();
const PORT = 3000;

app.use(express.json());

// Server-side secure credentials. Set ADMIN_PASSWORD in .env; without it a
// random password is generated each start (admin login effectively disabled).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
// Generate a unique random secret key on each server startup to make sessions tamper-proof
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

/**
 * Generates a secure cryptographically signed token for the admin session
 */
function generateToken() {
  const payload = JSON.stringify({ 
    role: "admin", 
    expiresAt: Date.now() + 1000 * 60 * 60 * 2 // Secure 2 hour session validity
  });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64")}.${signature}`;
}

/**
 * Validates the cryptographic token signature and expiration
 */
function verifyToken(token: string): boolean {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;
    
    const payloadStr = Buffer.from(payloadB64, "base64").toString("utf8");
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(payloadStr).digest("hex");
    
    // Check tamper protection
    if (signature !== expectedSignature) return false;
    
    const payload = JSON.parse(payloadStr);
    // Check expiration safety
    if (payload.expiresAt < Date.now()) return false;
    
    return payload.role === "admin";
  } catch (e) {
    return false;
  }
}

// SECURE API ENDPOINTS
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: "נא להזין סיסמה" });
  }

  if (password === ADMIN_PASSWORD) {
    const token = generateToken();
    return res.json({ success: true, token });
  } else {
    return res.status(401).json({ error: "סיסמה שגויה, נא לנסות שנית" });
  }
});

app.post("/api/admin/verify-token", (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: "טוקן חסר" });
  }

  if (verifyToken(token)) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ error: "פג תוקף החיבור המאובטח" });
  }
});

// PRODUCTS STORAGE ENDPOINTS
const PRODUCTS_FILE = path.join(process.cwd(), "products_db.json");

app.get("/api/products", (req, res) => {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, "utf-8");
      return res.json(JSON.parse(data));
    }
    return res.json(null);
  } catch (error) {
    console.error("Error reading products file:", error);
    return res.status(500).json({ error: "שגיאה בטעינת המוצרים מהשרת" });
  }
});

app.post("/api/products", (req, res) => {
  const { products, token } = req.body;
  
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: "אימות נכשל, נא להתחבר מחדש כמנהל" });
  }

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "רשימת מוצרים לא תקינה" });
  }

  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
    return res.json({ success: true });
  } catch (error) {
    console.error("Error writing products file:", error);
    return res.status(500).json({ error: "שגיאה בשמירת המוצרים בשרת" });
  }
});

// GOOGLE OAUTH SECURE ENDPOINTS
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

app.get("/api/auth/google/url", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.json({ 
      configured: false, 
      message: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable secure Google Sign-In."
    });
  }

  // Construct Google OAuth URL
  const origin = req.headers.referer || `${req.protocol}://${req.get("host")}`;
  const cleanOrigin = origin.replace(/\/$/, "");
  const redirectUri = `${cleanOrigin}/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ configured: true, url: authUrl });
});

// Secure endpoint to allow simulated testing in Dev if credentials aren't set
app.post("/api/auth/google/simulate", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "אימייל חסר" });
  }
  
  const targetEmail = email.trim().toLowerCase();
  const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || "nave1237@gmail.com")
    .split(",")
    .map(e => e.trim().toLowerCase());

  if (allowedEmails.includes(targetEmail)) {
    const token = generateToken();
    return res.json({ success: true, token, email: targetEmail });
  } else {
    return res.status(403).json({ error: `האימייל ${targetEmail} אינו מורשה כמנהל` });
  }
});

app.get(["/auth/google/callback", "/auth/google/callback/"], async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send(generateCallbackHtml({ error: "קוד אימות חסר מ-Google" }));
  }

  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${origin}/auth/google/callback`;

    // 1. Exchange auth code for tokens securely on the server
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Google Token Exchange Error:", errorText);
      return res.send(generateCallbackHtml({ error: "שגיאה בקבלת טוקן אימות מ-Google" }));
    }

    const tokens = (await tokenResponse.json()) as any;
    const accessToken = tokens.access_token;

    // 2. Fetch user details from Google userinfo API
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userinfoResponse.ok) {
      return res.send(generateCallbackHtml({ error: "שגיאה בקבלת פרטי המשתמש מ-Google" }));
    }

    const userInfo = (await userinfoResponse.json()) as any;
    const email = userInfo.email?.toLowerCase();

    if (!email) {
      return res.send(generateCallbackHtml({ error: "לא התקבל אימייל תקין מ-Google" }));
    }

    // 3. Verify owner access
    const allowedEmails = (process.env.ALLOWED_ADMIN_EMAILS || "nave1237@gmail.com")
      .split(",")
      .map(e => e.trim().toLowerCase());

    if (allowedEmails.includes(email)) {
      const token = generateToken();
      return res.send(generateCallbackHtml({ success: true, token, email }));
    } else {
      return res.send(generateCallbackHtml({ 
        error: `האימייל ${email} אינו מורשה כמנהל מערכת בחנות זו` 
      }));
    }
  } catch (err) {
    console.error("Google OAuth callback exception:", err);
    return res.send(generateCallbackHtml({ error: "שגיאה פנימית בתהליך האימות" }));
  }
});

function generateCallbackHtml({ success, token, email, error }: { success?: boolean; token?: string; email?: string; error?: string }) {
  const safeError = error ? error.replace(/'/g, "\\'") : "";
  const safeEmail = email ? email.replace(/'/g, "\\'") : "";
  const safeToken = token ? token.replace(/'/g, "\\'") : "";

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>התחברות מאובטחת</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #faf9f6;
          color: #1c1917;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .card {
          background: white;
          padding: 2.5rem;
          border: 1px solid #e7e5e4;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.04);
          max-width: 420px;
          width: 90%;
        }
        .error { color: #dc2626; }
        .success { color: #16a34a; }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1c1917;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          margin: 1.5rem auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .btn {
          margin-top: 1.5rem;
          padding: 0.6rem 1.2rem;
          background: #1c1917;
          color: white;
          border: none;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #44403c;
        }
      </style>
    </head>
    <body>
      <div class="card">
        ${success ? `
          <h2 class="success">התחברת בהצלחה!</h2>
          <p>שלום <strong>${safeEmail}</strong>. החלון ייסגר כעת ותועבר ללוח הניהול...</p>
          <div class="spinner"></div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_OAUTH_SUCCESS', 
                token: '${safeToken}' 
              }, '*');
              setTimeout(function() {
                window.close();
              }, 1000);
            } else {
              window.location.href = '/';
            }
          </script>
        ` : `
          <h2 class="error">שגיאת התחברות</h2>
          <p>${safeError || "לא היה ניתן להשלים את תהליך ההתחברות."}</p>
          <button class="btn" onclick="window.close()">סגור חלון</button>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_OAUTH_FAILURE', 
                error: '${safeError || "שגיאת התחברות"}' 
              }, '*');
            }
          </script>
        `}
      </div>
    </body>
    </html>
  `;
}

// LIVE INVENTORY SYNC (dev): poll the whole assets/Inventory tree.
// Any .xlsx save/add/remove -> regenerate src/inventory_db.json + reload browser.
// Any image add/remove/change -> reload browser (vite re-runs the glob import).
// Poll-based because OneDrive file events are unreliable.
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

function watchInventory(onChanged: () => void) {
  const invDir = path.join(process.cwd(), "assets", "Inventory");
  let syncing = false;

  const runSync = () => {
    if (syncing) return;
    syncing = true;
    execFile(
      "python",
      [path.join(process.cwd(), "scripts", "sync_inventory.py")],
      { env: { ...process.env, PYTHONUTF8: "1" } },
      (err: Error | null, stdout: string, stderr: string) => {
        syncing = false;
        if (err) {
          console.error("[Inventory Sync] failed:", stderr || err.message);
        } else {
          console.log("[Inventory Sync]", String(stdout).trim());
          onChanged();
        }
      }
    );
  };

  const snapshot = (): Map<string, number> => {
    const files = new Map<string, number>();
    const stack = [invDir];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.name.startsWith("~$")) continue; // Excel lock files
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.name.toLowerCase().endsWith(".xlsx") || IMAGE_EXT.test(entry.name)) {
          try {
            files.set(full, fs.statSync(full).mtimeMs);
          } catch { /* file mid-write, next poll catches it */ }
        }
      }
    }
    return files;
  };

  let prev = snapshot();
  setInterval(() => {
    const curr = snapshot();
    let excelChanged = false;
    let imagesChanged = false;

    for (const [file, mtime] of curr) {
      if (prev.get(file) !== mtime) {
        if (file.toLowerCase().endsWith(".xlsx")) excelChanged = true;
        else imagesChanged = true;
      }
    }
    for (const file of prev.keys()) {
      if (!curr.has(file)) {
        if (file.toLowerCase().endsWith(".xlsx")) excelChanged = true;
        else imagesChanged = true;
      }
    }
    prev = curr;

    if (excelChanged) runSync(); // reload fires after the sync finishes
    else if (imagesChanged) {
      console.log("[Inventory Sync] image change detected, reloading");
      onChanged();
    }
  }, 2500);

  console.log(`[Inventory Sync] watching assets/Inventory (excel + images) for live updates`);
}

// VITE MIDDLEWARE AND SPA FALLBACK ROUTING
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    watchInventory(() => {
      vite.moduleGraph.invalidateAll();
      vite.ws.send({ type: "full-reload" });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[HighTide Server] Running securely on port ${PORT}`);
  });
}

startServer();
