const ALLOWED_ORIGINS = new Set([
  "https://helanjiabing.github.io",
  "https://huanjing-ai-image.chopperwa.chatgpt.site",
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://localhost:");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://helanjiabing.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function validDeviceId(value) {
  const id = String(value || "");
  return /^[a-zA-Z0-9-]{16,80}$/.test(id) ? id : null;
}

async function getUsage(env, deviceId) {
  return (await env.CREDITS.get(`device:${deviceId}`, "json")) || { free: 3, paid: 0 };
}

function usageBody(usage) {
  return { free: usage.free || 0, paid: usage.paid || 0, remaining: (usage.free || 0) + (usage.paid || 0) };
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
    if (!ALLOWED_ORIGINS.has(origin) && !origin.startsWith("http://localhost:")) return json({ error: "Origin not allowed" }, 403, origin);

    if (url.pathname === "/usage" && request.method === "GET") {
      const deviceId = validDeviceId(url.searchParams.get("deviceId"));
      if (!deviceId) return json({ error: "设备编号无效" }, 400, origin);
      return json(usageBody(await getUsage(env, deviceId)), 200, origin);
    }

    if (url.pathname === "/redeem" && request.method === "POST") {
      const input = await request.json().catch(() => ({}));
      const deviceId = validDeviceId(input.deviceId);
      const code = String(input.code || "").trim().toUpperCase();
      if (!deviceId || !/^HJ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return json({ error: "兑换码格式不正确" }, 400, origin);
      const voucher = await env.CREDITS.get(`code:${code}`, "json");
      if (!voucher) return json({ error: "兑换码不存在" }, 404, origin);
      if (voucher.usedBy) return json({ error: "兑换码已经使用过" }, 409, origin);
      const usage = await getUsage(env, deviceId);
      usage.paid = (usage.paid || 0) + voucher.credits;
      voucher.usedBy = deviceId;
      voucher.usedAt = new Date().toISOString();
      await Promise.all([
        env.CREDITS.put(`device:${deviceId}`, JSON.stringify(usage)),
        env.CREDITS.put(`code:${code}`, JSON.stringify(voucher)),
      ]);
      return json({ ok: true, added: voucher.credits, ...usageBody(usage) }, 200, origin);
    }

    if (url.pathname === "/admin/create-code" && request.method === "POST") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (!env.ADMIN_SECRET || token !== env.ADMIN_SECRET) return json({ error: "Unauthorized" }, 401, origin);
      const input = await request.json().catch(() => ({}));
      const credits = Number(input.credits);
      if (![1, 5, 15].includes(credits)) return json({ error: "额度只能是 1、5 或 15" }, 400, origin);
      const raw = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
      const code = `HJ-${raw.slice(0, 4)}-${raw.slice(4)}`;
      await env.CREDITS.put(`code:${code}`, JSON.stringify({ credits, createdAt: new Date().toISOString() }));
      return json({ code, credits }, 200, origin);
    }

    if (url.pathname !== "/generate" || request.method !== "POST") return json({ error: "Not found" }, 404, origin);

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "请求格式不正确" }, 400, origin);
    }

    const prompt = String(input.prompt || "").trim().slice(0, 1200);
    const deviceId = validDeviceId(input.deviceId);
    const allowedRatios = new Set(["9:16", "16:9", "1:1"]);
    const aspectRatio = allowedRatios.has(input.aspectRatio) ? input.aspectRatio : "9:16";
    if (!deviceId) return json({ error: "设备编号无效" }, 400, origin);
    if (prompt.length < 3) return json({ error: "请先描述想生成的画面" }, 400, origin);

    const usage = await getUsage(env, deviceId);
    if ((usage.free || 0) + (usage.paid || 0) < 1) return json({ error: "NO_CREDITS", ...usageBody(usage) }, 402, origin);

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
    if (usage.free > 0) usage.free -= 1;
    else usage.paid = Math.max(0, usage.paid - 1);
    await env.CREDITS.put(`device:${deviceId}`, JSON.stringify(usage));
    return json({ image, model: "FLUX.1 Schnell", ...usageBody(usage) }, 200, origin);
  },
};
