// Add this to your existing Cloudflare Worker

// ============ ADMIN ENDPOINTS ============

/**
 * POST /admin/add-key
 * Body: { 
 *   "adminToken": "your-secret-token",
 *   "key": "CHAOS-NEW-KEY-XXXX",
 *   "maxDevices": 1,
 *   "expiresInDays": 365
 * }
 */
async function handleAddKey(request, env) {
  try {
    const body = await request.json();
    const { adminToken, key, maxDevices = 1, expiresInDays = 365 } = body;

    // Authentication check
    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate input
    if (!key || !key.startsWith("CHAOS-")) {
      return new Response(JSON.stringify({ error: "Invalid key format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch existing keys from R2
    const r2Object = await env.KEYS_BUCKET.get("keys.json");
    let keysData = { keys: [] };

    if (r2Object) {
      keysData = JSON.parse(await r2Object.text());
    }

    // Check if key already exists
    const existingKey = keysData.keys.find(k => k.key === key);
    if (existingKey) {
      return new Response(JSON.stringify({ error: "Key already exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Add new key
    keysData.keys.push({
      key: key,
      status: "available",
      activatedAt: null,
      expiresAt: null,
      deviceId: null,
      maxDevices: maxDevices
    });

    // Save back to R2
    await env.KEYS_BUCKET.put("keys.json", JSON.stringify(keysData, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Key added successfully",
      key: key
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * GET /admin/list-keys
 * Query: ?adminToken=your-secret-token
 */
async function handleListKeys(request, env) {
  try {
    const url = new URL(request.url);
    const adminToken = url.searchParams.get("adminToken");

    // Authentication check
    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch keys from R2
    const r2Object = await env.KEYS_BUCKET.get("keys.json");
    if (!r2Object) {
      return new Response(JSON.stringify({ keys: [] }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const keysData = await r2Object.text();
    return new Response(keysData, {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * DELETE /admin/delete-key
 * Body: { "adminToken": "xxx", "key": "CHAOS-XXX" }
 */
async function handleDeleteKey(request, env) {
  try {
    const body = await request.json();
    const { adminToken, key } = body;

    if (adminToken !== env.ADMIN_SECRET_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch existing keys
    const r2Object = await env.KEYS_BUCKET.get("keys.json");
    if (!r2Object) {
      return new Response(JSON.stringify({ error: "No keys found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const keysData = JSON.parse(await r2Object.text());

    // Remove key
    const initialLength = keysData.keys.length;
    keysData.keys = keysData.keys.filter(k => k.key !== key);

    if (keysData.keys.length === initialLength) {
      return new Response(JSON.stringify({ error: "Key not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Save back to R2
    await env.KEYS_BUCKET.put("keys.json", JSON.stringify(keysData, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Key deleted successfully" 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ============ MAIN HANDLER (Update existing) ============

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin endpoints (protected)
    if (url.pathname === "/admin/add-key" && request.method === "POST") {
      const response = await handleAddKey(request, env);
      Object.entries(corsHeaders).forEach(([key, value]) => 
        response.headers.set(key, value)
      );
      return response;
    }

    if (url.pathname === "/admin/list-keys" && request.method === "GET") {
      const response = await handleListKeys(request, env);
      Object.entries(corsHeaders).forEach(([key, value]) => 
        response.headers.set(key, value)
      );
      return response;
    }

    if (url.pathname === "/admin/delete-key" && request.method === "DELETE") {
      const response = await handleDeleteKey(request, env);
      Object.entries(corsHeaders).forEach(([key, value]) => 
        response.headers.set(key, value)
      );
      return response;
    }

    // Existing endpoints (/activate, /validate)
    // ... (keep your existing code)

    return new Response("Not Found", { status: 404 });
  }
};

