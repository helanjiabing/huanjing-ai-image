const ALLOWED_ORIGINS = new Set([
  "https://helanjiabing.github.io",
  "https://huanjing-ai-image.chopperwa.chatgpt.site",
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://helanjiabing.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

function findImage(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.data === "string" && (value.type === "image" || value.mime_type || value.mimeType)) {
    return { data: value.data, mimeType: value.mime_type || value.mimeType || "image/png" };
  }
  if (value.output_image?.data) {
    return {
      data: value.output_image.data,
      mimeType: value.output_image.mime_type || value.output_image.mimeType || "image/png",
    };
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findImage(item);
        if (found) return found;
      }
    } else {
      const found = findImage(child);
      if (found) return found;
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === "/health") return json({ ok: true, model: "gemini-3.1-flash-image" }, 200, origin);
    if (url.pathname !== "/generate" || request.method !== "POST") return json({ error: "Not found" }, 404, origin);
    if (!ALLOWED_ORIGINS.has(origin) && !origin.startsWith("http://localhost:")) return json({ error: "Origin not allowed" }, 403, origin);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "请求格式不正确" }, 400, origin);
    }

    const prompt = String(input.prompt || "").trim().slice(0, 1200);
    const allowedRatios = new Set(["9:16", "16:9", "1:1"]);
    const aspectRatio = allowedRatios.has(input.aspectRatio) ? input.aspectRatio : "9:16";
    if (prompt.length < 3) return json({ error: "请先描述想生成的画面" }, 400, origin);

    const googleResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-image",
        input: [{ type: "text", text: prompt }],
        response_format: { type: "image", aspect_ratio: aspectRatio, image_size: "1K" },
      }),
    });

    const result = await googleResponse.json();
    if (!googleResponse.ok) {
      const message = result?.error?.message || "Nano Banana 2 暂时不可用";
      return json({ error: message }, googleResponse.status, origin);
    }

    const image = findImage(result);
    if (!image) return json({ error: "模型没有返回图片，请换个描述重试" }, 502, origin);
    return json({ image: `data:${image.mimeType};base64,${image.data}`, model: "Nano Banana 2" }, 200, origin);
  },
};
