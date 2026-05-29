const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function json(res, status, payload) {
  res.statusCode = status;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function requireEnv() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET", "ADMIN_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    return { missing };
  }

  return {
    adminSecret: process.env.ADMIN_SECRET,
    bucket: process.env.SUPABASE_BUCKET,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
  };
}

function parseBody(req) {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function supabaseFetch(env, path, options = {}) {
  const response = await fetch(`${env.url}${path}`, {
    ...options,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
  }

  return payload;
}

function sanitizeFileName(name) {
  return (name || "upload.png").replace(/[^a-z0-9._-]/gi, "-").slice(0, 80);
}

function dataUrlToUpload(dataUrl) {
  if (!dataUrl || !dataUrl.includes(",")) {
    return null;
  }

  const [header, base64] = dataUrl.split(",");
  const contentType = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";

  return {
    buffer: Buffer.from(base64, "base64"),
    contentType,
  };
}

async function handleGet(req, res, env) {
  const requestUrl = new URL(req.url, "https://sp4rk.local");
  const secret = requestUrl.searchParams.get("secret") || req.headers["x-admin-secret"];

  if (secret !== env.adminSecret) {
    return json(res, 401, { error: "Unauthorized" });
  }

  const orders = await supabaseFetch(
    env,
    "/rest/v1/orders?select=*&order=created_at.desc&limit=100",
    { method: "GET" }
  );

  return json(res, 200, { orders });
}

async function handlePost(req, res, env) {
  const body = await parseBody(req);
  const orderId = crypto.randomUUID();
  let imagePath = null;

  if (body.imageDataUrl) {
    const upload = dataUrlToUpload(body.imageDataUrl);

    if (upload) {
      const safeName = sanitizeFileName(body.imageName);
      imagePath = `${orderId}/${safeName}`;
      await supabaseFetch(
        env,
        `/storage/v1/object/${env.bucket}/${imagePath}`,
        {
          method: "POST",
          body: upload.buffer,
          headers: {
            "Content-Type": upload.contentType,
            "x-upsert": "true",
          },
        }
      );
    }
  }

  const order = {
    id: orderId,
    customer_email: body.customerEmail || null,
    package_id: body.packageId,
    package_name: body.packageName,
    price: body.price,
    image_name: body.imageName || null,
    image_path: imagePath,
    notes: body.notes || "",
    settings: body.settings || {},
    status: "new",
    payment_status: "pending",
  };

  const inserted = await supabaseFetch(env, "/rest/v1/orders", {
    method: "POST",
    body: JSON.stringify(order),
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });

  return json(res, 200, { order: inserted?.[0] || order });
}

export default async function handler(req, res) {
  const env = requireEnv();

  if (env.missing) {
    return json(res, 500, {
      error: "Backend is not configured yet.",
      missing: env.missing,
    });
  }

  try {
    if (req.method === "GET") {
      return handleGet(req, res, env);
    }

    if (req.method === "POST") {
      return handlePost(req, res, env);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Order API failed" });
  }
}
