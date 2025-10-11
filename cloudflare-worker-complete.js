// ============================================
// YEYODRA LAUNCHER - LICENSE SERVER
// Cloudflare Worker with R2 Storage
// ============================================

// ============ ACTIVATION HANDLER ============

async function handleActivate(request, env) {
  try {
    const body = await request.json();
    const { key, deviceId, username } = body;

    console.log(`[Activate] Key: ${key}, DeviceId: ${deviceId}, Username: ${username || 'N/A'}`);

    // Validate input
    if (!key || !deviceId) {
      return jsonResponse({ error: "Missing key or deviceId" }, 400);
    }

    // Fetch keys from R2
    const r2Object = await env.YEYODRA_AUTH.get("keys.json");
    if (!r2Object) {
      return jsonResponse({ error: "Keys database not found" }, 500);
    }

    const keysData = JSON.parse(await r2Object.text());
    const licenseKey = keysData.keys.find(k => k.key === key);

    // Check if key exists
    if (!licenseKey) {
      return jsonResponse({ error: "Invalid license key" }, 404);
    }

    // Check if key is already used
    if (licenseKey.status === "used") {
      // Check if it's the same device (re-installation)
      if (licenseKey.deviceId === deviceId) {
        console.log(`[Activate] Re-activation allowed for same device`);
        
        // Smart username update on re-activation:
        // Update if new username is better than placeholder
        const isPlaceholder = (name) => !name || name === "Unknown User" || name === "Local User" || name === "Yeyodra User";
        if (username && !isPlaceholder(username) && isPlaceholder(licenseKey.username)) {
          console.log(`[Activate] Updating username from "${licenseKey.username}" to "${username}"`);
          licenseKey.username = username;
          // Save updated username
          await env.YEYODRA_AUTH.put("keys.json", JSON.stringify(keysData, null, 2));
        }
        
        return jsonResponse({
          success: true,
          message: "License re-activated successfully",
          expiresAt: licenseKey.expiresAt,
          username: licenseKey.username // Send username to client
        });
      } else {
        // Different device trying to use the key
        return jsonResponse({ error: "Key already used on another device" }, 403);
      }
    }

    // Key is available - activate it
    const now = new Date();
    
    // Calculate expiration based on key's expiresInDays (supports lifetime)
    // If expiresInDays >= 99999, it's a lifetime license (273+ years)
    const daysToAdd = licenseKey.expiresInDays || 365; // Default 1 year
    const expiresAt = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    licenseKey.status = "used";
    licenseKey.deviceId = deviceId;
    
    // Smart username assignment: 
    // - Only set if not already exists OR if new username is better than placeholder
    const isPlaceholder = (name) => !name || name === "Unknown User" || name === "Local User" || name === "Yeyodra User";
    if (!licenseKey.username || (isPlaceholder(licenseKey.username) && !isPlaceholder(username))) {
      licenseKey.username = username || "Unknown User";
    }
    
    licenseKey.activatedAt = now.toISOString();
    licenseKey.expiresAt = expiresAt.toISOString();

    // Save updated keys back to R2
    await env.YEYODRA_AUTH.put("keys.json", JSON.stringify(keysData, null, 2));

    console.log(`[Activate] ✓ License activated successfully`);

    return jsonResponse({
      success: true,
      message: "License activated successfully",
      expiresAt: expiresAt.toISOString(),
      username: licenseKey.username // Send username to client
    });

  } catch (error) {
    console.error(`[Activate] Error: ${error.message}`);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ VALIDATION HANDLER ============

async function handleValidate(request, env) {
  try {
    const body = await request.json();
    const { key, deviceId } = body;

    console.log(`[Validate] Key: ${key}, DeviceId: ${deviceId}`);

    // Validate input
    if (!key || !deviceId) {
      return jsonResponse({ error: "Missing key or deviceId" }, 400);
    }

    // Fetch keys from R2
    const r2Object = await env.YEYODRA_AUTH.get("keys.json");
    if (!r2Object) {
      return jsonResponse({ error: "Keys database not found" }, 500);
    }

    const keysData = JSON.parse(await r2Object.text());
    const licenseKey = keysData.keys.find(k => k.key === key);

    // Check if key exists
    if (!licenseKey) {
      return jsonResponse({ valid: false, error: "License key not found" });
    }

    // Check if key is used
    if (licenseKey.status !== "used") {
      return jsonResponse({ valid: false, error: "License key not activated" });
    }

    // Check device match
    if (licenseKey.deviceId !== deviceId) {
      return jsonResponse({ valid: false, error: "Device ID mismatch" });
    }

    // Check expiration
    const expiresAt = new Date(licenseKey.expiresAt);
    const now = new Date();

    if (expiresAt < now) {
      return jsonResponse({ valid: false, error: "License expired" });
    }

    console.log(`[Validate] ✓ License is valid`);

    return jsonResponse({
      valid: true,
      expiresAt: licenseKey.expiresAt
    });

  } catch (error) {
    console.error(`[Validate] Error: ${error.message}`);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ ADMIN: ADD KEY ============

async function handleAdminAddKey(request, env) {
  try {
    const body = await request.json();
    const { adminToken, key, maxDevices = 1, expiresInDays = 365 } = body;

    // Authentication
    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      console.log(`[Admin] Unauthorized add-key attempt`);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Validate key format
    if (!key || !key.startsWith("YEYODRA-")) {
      return jsonResponse({ error: "Invalid key format (must start with YEYODRA-)" }, 400);
    }

    // Fetch existing keys from R2
    const r2Object = await env.YEYODRA_AUTH.get("keys.json");
    let keysData = { keys: [] };

    if (r2Object) {
      keysData = JSON.parse(await r2Object.text());
    }

    // Check if key already exists
    const existingKey = keysData.keys.find(k => k.key === key);
    if (existingKey) {
      return jsonResponse({ error: "Key already exists" }, 400);
    }

    // Add new key (preserving all existing data!)
    keysData.keys.push({
      key: key,
      status: "available",
      activatedAt: null,
      expiresAt: null,
      deviceId: null,
      maxDevices: maxDevices,
      expiresInDays: expiresInDays // Store for activation time
    });

    // Save back to R2
    await env.YEYODRA_AUTH.put("keys.json", JSON.stringify(keysData, null, 2));

    console.log(`[Admin] ✓ Key added: ${key}`);

    return jsonResponse({
      success: true,
      message: "Key added successfully",
      key: key,
      totalKeys: keysData.keys.length
    });

  } catch (error) {
    console.error(`[Admin] Add key error: ${error.message}`);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ ADMIN: LIST KEYS ============

async function handleAdminListKeys(request, env) {
  try {
    const url = new URL(request.url);
    const adminToken = url.searchParams.get("adminToken");

    // Authentication
    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      console.log(`[Admin] Unauthorized list-keys attempt`);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch keys from R2
    const r2Object = await env.YEYODRA_AUTH.get("keys.json");
    if (!r2Object) {
      return jsonResponse({ keys: [] });
    }

    const keysData = await r2Object.text();
    const parsed = JSON.parse(keysData);

    console.log(`[Admin] ✓ Listed ${parsed.keys.length} keys`);

    return new Response(keysData, {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error(`[Admin] List keys error: ${error.message}`);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ ADMIN: DELETE KEY ============

async function handleAdminDeleteKey(request, env) {
  try {
    const body = await request.json();
    const { adminToken, key } = body;

    // Authentication
    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      console.log(`[Admin] Unauthorized delete-key attempt`);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Fetch existing keys
    const r2Object = await env.YEYODRA_AUTH.get("keys.json");
    if (!r2Object) {
      return jsonResponse({ error: "No keys found" }, 404);
    }

    const keysData = JSON.parse(await r2Object.text());
    const initialLength = keysData.keys.length;

    // Remove key
    keysData.keys = keysData.keys.filter(k => k.key !== key);

    if (keysData.keys.length === initialLength) {
      return jsonResponse({ error: "Key not found" }, 404);
    }

    // Save back to R2
    await env.YEYODRA_AUTH.put("keys.json", JSON.stringify(keysData, null, 2));

    console.log(`[Admin] ✓ Key deleted: ${key}`);

    return jsonResponse({
      success: true,
      message: "Key deleted successfully",
      totalKeys: keysData.keys.length
    });

  } catch (error) {
    console.error(`[Admin] Delete key error: ${error.message}`);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============ HELPER FUNCTIONS ============

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    console.log(`[Request] ${method} ${path}`);

    // ============ PUBLIC ENDPOINTS ============
    
    if (path === "/activate" && method === "POST") {
      return handleActivate(request, env);
    }

    if (path === "/validate" && method === "POST") {
      return handleValidate(request, env);
    }

    // ============ ADMIN ENDPOINTS ============

    if (path === "/admin/add-key" && method === "POST") {
      return handleAdminAddKey(request, env);
    }

    if (path === "/admin/list-keys" && method === "GET") {
      return handleAdminListKeys(request, env);
    }

    if (path === "/admin/delete-key" && method === "DELETE") {
      return handleAdminDeleteKey(request, env);
    }

    // ============ ROOT / HEALTH CHECK ============

    if (path === "/" && method === "GET") {
      return jsonResponse({
        service: "Yeyodra Launcher License Server",
        status: "running",
        endpoints: {
          public: [
            "POST /activate",
            "POST /validate"
          ],
          admin: [
            "POST /admin/add-key",
            "GET /admin/list-keys",
            "DELETE /admin/delete-key"
          ]
        }
      });
    }

    // Not found
    return jsonResponse({ error: "Endpoint not found" }, 404);
  }
};

