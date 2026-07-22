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

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === "/health") return json({ ok: true, model: "fal-ai/flux-1/schnell" }, 200, origin);
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

    if (!env.FAL_KEY) return json({ error: "生图服务尚未配置" }, 503, origin);

    const sizes = {
      "9:16": { width: 576, height: 1024 },
      "16:9": { width: 1024, height: 576 },
      "1:1": { width: 768, height: 768 },
    };
    const falResponse = await fetch("https://fal.run/fal-ai/flux-1/schnell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${env.FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: sizes[aspectRatio],
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(90000),
    });

    const result = await falResponse.json();
    if (!falResponse.ok) {
      const message = result?.detail || result?.error || "FLUX 生图线路暂时不可用";
      return json({ error: typeof message === "string" ? message : "FLUX 生图线路暂时不可用" }, falResponse.status, origin);
    }

    const image = result?.images?.[0]?.url;
    if (!image) return json({ error: "模型没有返回图片，请换个描述重试" }, 502, origin);
    return json({ image, model: "FLUX.1 Schnell" }, 200, origin);
  },
};
