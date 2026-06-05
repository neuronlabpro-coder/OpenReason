import { load_memory } from "../utils/memory"
import { reason } from "../pipeline/reason"

export type openreason_config = {
    provider: "openai" | "anthropic" | "google" | "xai" | "tokaine" | "mock"
    baseUrl?: string
    apiKey: string
    model: string
    simpleModel?: string
    complexModel?: string
    weights?: {
        logical?: number
        rule?: number
        empathy?: number
    }
    memory?: {
        enabled: boolean
        path: string
    }
    performance?: {
        maxRetries?: number
        timeout?: number
    }
    graph?: {
        enabled: boolean
        checkpoint?: boolean
        threadPrefix?: string
    }
}

let cfg: openreason_config = {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o",
    graph: { enabled: false }
}

let explicitInit = false

export const init = (config: openreason_config) => {
    cfg = {
        ...config,
        weights: config.weights || { logical: 0.4, rule: 0.4, empathy: 0.2 },
        simpleModel: config.simpleModel || config.model,
        complexModel: config.complexModel || config.model,
        memory: config.memory || { enabled: false, path: "./data/memory.db" },
        performance: config.performance || { maxRetries: 3, timeout: 30000 },
        graph: config.graph || { enabled: false }
    }
    if (cfg.memory?.enabled) {
        Promise.resolve(load_memory(cfg.memory.path)).catch(() => { })
    }
    explicitInit = true
}

export const get_config = () => cfg

const ensure_initialized = () => {
    if (!explicitInit) {
        throw new Error("OpenReason has not been initialized. Call openreason.init({...}) before invoking reason().")
    }
}

export default {
    init,
    get_config,
    async reason(query: string) {
        ensure_initialized()
        return reason(query, cfg)
    }
}
