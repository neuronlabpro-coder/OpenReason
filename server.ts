import { createServer } from "http"
import { init, get_config } from "./src/core/config/init.js"
import { reason } from "./src/core/pipeline/reason.js"

const PORT = parseInt(process.env.PORT ?? "3000", 10)
const API_KEY = process.env.OPENREASON_API_KEY ?? ""

// LLM provider config from env
const LLM_PROVIDER = (process.env.LLM_PROVIDER ?? "custom") as
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "custom"
  | "mock"
const LLM_API_KEY = process.env.LLM_API_KEY ?? ""
const LLM_MODEL = process.env.LLM_MODEL ?? "deepseek-ai/DeepSeek-V4-Pro"
const LLM_SIMPLE_MODEL = process.env.LLM_SIMPLE_MODEL ?? LLM_MODEL
const LLM_COMPLEX_MODEL = process.env.LLM_COMPLEX_MODEL ?? LLM_MODEL

init({
  provider: LLM_PROVIDER,
  apiKey: LLM_API_KEY,
  model: LLM_MODEL,
  simpleModel: LLM_SIMPLE_MODEL,
  complexModel: LLM_COMPLEX_MODEL,
  memory: { enabled: false, path: "/tmp/memory.db" },
})

const send = (
  res: ReturnType<typeof createServer>["_events"]["request"] extends (req: any, res: infer R) => any ? R : never,
  status: number,
  body: unknown
) => {
  const payload = JSON.stringify(body)
  ;(res as any).writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  })
  ;(res as any).end(payload)
}

const authenticate = (req: any): boolean => {
  if (!API_KEY) return true
  const header: string = req.headers["authorization"] ?? ""
  return header === `Bearer ${API_KEY}`
}

const readBody = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = ""
    req.on("data", (chunk: Buffer) => { data += chunk.toString() })
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })

const server = createServer(async (req: any, res: any) => {
  const url: string = req.url ?? "/"
  const method: string = req.method ?? "GET"

  // Health check — no auth required
  if (method === "GET" && url === "/health") {
    const cfg = get_config()
    return send(res, 200, {
      status: "ok",
      provider: cfg.provider,
      model: cfg.model,
    })
  }

  // All other routes require auth
  if (!authenticate(req)) {
    return send(res, 401, { error: "Unauthorized" })
  }

  // POST /reason
  if (method === "POST" && url === "/reason") {
    let body: { query?: string; [k: string]: unknown }
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: "Invalid JSON body" })
    }

    if (!body.query || typeof body.query !== "string" || !body.query.trim()) {
      return send(res, 400, { error: "Field 'query' is required and must be a non-empty string" })
    }

    try {
      const result = await reason(body.query.trim(), get_config())
      return send(res, 200, result)
    } catch (err: any) {
      console.error("[reason] error:", err?.message ?? err)
      return send(res, 500, { error: "Reasoning failed", detail: err?.message ?? "unknown" })
    }
  }

  return send(res, 404, { error: "Not found" })
})

server.listen(PORT, () => {
  console.log(`OpenReason API listening on port ${PORT}`)
  console.log(`Provider: ${LLM_PROVIDER} / Model: ${LLM_MODEL}`)
  console.log(`Auth: ${API_KEY ? "enabled" : "DISABLED — set OPENREASON_API_KEY"}`)
})
