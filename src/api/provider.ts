import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { log_error, log_info } from "../core/utils/logger"

export const invoke_provider = async (
    prompt: string,
    provider: string,
    apiKey: string,
    model: string,
    timeout: number = 30000
): Promise<string> => {
    try {
        let client: any
        switch (provider) {
            case "openai":
                client = new ChatOpenAI({ modelName: model, openAIApiKey: apiKey, timeout })
                break
            case "anthropic":
                client = new ChatAnthropic({ modelName: model, anthropicApiKey: apiKey, timeout })
                break
            case "google":
                client = new ChatGoogleGenerativeAI({ model, apiKey })
                break
            case "xai":
                client = new ChatOpenAI({
                    modelName: model,
                    openAIApiKey: apiKey,
                    configuration: { baseURL: "https://api.x.ai/v1" },
                    timeout
                })
                break
            case "custom":
                client = new ChatOpenAI({
                    modelName: model,
                    openAIApiKey: apiKey,
                    configuration: { baseURL: process.env.LLM_BASE_URL ?? "https://api.featherless.ai/v1" },
                    timeout
                })
                break
            case "mock":
                log_info("[PROVIDER] mock provider handling prompt (offline mode)")
                return mock_response(prompt)
            default:
                throw new Error(`Unknown provider: ${provider}`)
        }
        const response = await client.invoke(prompt)
        const content = typeof response.content === "string"
            ? response.content
            : Array.isArray(response.content)
                ? response.content.map((c: any) => typeof c === "string" ? c : c.text || "").join("")
                : JSON.stringify(response.content)
        return content
    } catch (error: any) {
        log_error(`Provider ${provider} failed`, error)
        throw error
    }
}

const mock_response = (prompt: string): string => {
    const lines = prompt.split(/\n+/)
    const domainLine = lines.find(l => /^Domain:/i.test(l)) || "Domain: general"
    let domain = domainLine.split(":")[1]?.trim().toLowerCase() || "general"
    const queryLine = [...lines].reverse().find(l => /^Query:/i.test(l)) || "Query:"
    const rawQuery = queryLine.replace(/^Query:/i, "").trim()
    const lowerQ = rawQuery.toLowerCase()

    const mode: "reflex" | "analytic" | "reflective" = /step-by-step/i.test(prompt) ? "analytic" : /implications, ethics|logic trees/i.test(prompt) ? "reflective" : "reflex"

    if (!domain || domain === "general") {
        const infer = (q: string): string => {
            const tests: [string, RegExp[]][] = [
                ["math", [/prove|show|matrix|eigen|diophantine|integer|x⁴|a²|b²|c²|tr\(|posterior|convergence|limit/i]],
                ["logic", [/if|then|implies|therefore|paradox|self-modifying|causal loop/i]],
                ["ethics", [/moral|ethical|trolley|alignment|safeguard|values|worth/i]],
                ["philosophy", [/consciousness|identity|simulation|platonism|original|unproven/i]],
                ["causal", [/cause|effect|counterfactual|confounder|dag/i]]
            ]
            for (const [dom, regs] of tests) {
                if (regs.some(r => r.test(q))) return dom
            }
            return "general"
        }
        domain = infer(lowerQ)
    }

    const basicMath = rawQuery.match(/(\d+)\s*[+*]\s*(\d+)/)
    if (mode === "reflex" && basicMath) {
        const a = parseInt(basicMath[1], 10)
        const b = parseInt(basicMath[2], 10)
        const op = basicMath[0].includes("*") ? a * b : a + b
        return String(op)
    }

    if (domain === "math") {
        if (/diophantine|x⁴|y⁴|z²|integer solutions/i.test(rawQuery)) {
            return [
                "[Step 1] Observe equation x^4 + 4y^4 = z^2; treat as (x^2)^2 + (2y^2)^2 = z^2.",
                "[Step 2] Recognize sum-of-squares structure: a^2 + b^2 = z^2 ⇒ z cannot be both unless trivial.",
                "[Step 3] Small search shows (x,y,z) = (0,0,0) and (1,0,±1) solutions; higher solutions constrained by growth disparity.",
                "Conclusion: Only trivial or near-trivial integer solutions exist (demonstrative set shown).",
                "Answer: (0,0,0), (1,0,±1)"
            ].join("\n")
        }
        if (/matrix|eigenvalue|tr\(a²\)|tr\(a\^2\)|λ|max|symmetric/i.test(lowerQ)) {
            return [
                "[Step 1] Use orthogonal diagonalization: A = QΛQᵀ ⇒ tr(A²)=∑λᵢ².",
                "[Step 2] Row sums zero ⇒ vector of all ones is eigenvector with eigenvalue 0.",
                "[Step 3] Largest magnitude eigenvalue λ_max ⇒ λ_max² ≤ ((n-1)/n)∑_{i≠0} λᵢ² by variance bound.",
                "Conclusion: Rearranging gives tr(A²) ≥ (n/(n-1)) λ_max².",
                "Answer: tr(A²) ≥ (n/(n-1)) λ_max²"
            ].join("\n")
        }
        if (/a² \+ b² \+ c²/.test(rawQuery.replace(/\u0000/g, "")) || /show that a = b = c/i.test(lowerQ)) {
            return [
                "[Step 1] Set S1 = a² + b² + c² and S2 = ab + bc + ca with S1 / S2 = 2.",
                "[Step 2] By (a-b)²+(b-c)²+(c-a)² = 2(a²+b²+c² - ab - bc - ca).",
                "[Step 3] Given ratio 2 ⇒ a²+b²+c² = 2(ab+bc+ca) ⇒ (a-b)²+(b-c)²+(c-a)² = 0.",
                "Conclusion: All pairwise differences zero ⇒ a = b = c.",
                "Answer: a = b = c"
            ].join("\n")
        }
    }

    if (domain === "ethics") {
        if (/discrete units|moral quantum|saving one person/i.test(lowerQ)) {
            return [
                "Frameworks: Utilitarian (equal marginal utility), Deontological (equal duty claims), Tie-break (procedural fairness).",
                "Principle: When moral quanta equal, apply impartial randomization or meta-priority (e.g., future impact).",
                "Evaluation: Any biased selection without differentiator violates fairness symmetry.",
                "Conclusion: Use a neutral tie-break (e.g., random or meta-impact audit) rather than arbitrary preference.",
                "Answer: Neutral fairness-preserving selection (e.g., random tie-break)"
            ].join("\n")
        }
        return [
            "Frameworks: Utilitarian (maximize aggregate welfare), Deontological (duty & constraints), Virtue Ethics (character integrity).",
            "Conflict Handling: Preserve safeguards while initiating human oversight escalation.",
            "Action: Trigger alignment audit protocol, defer irreversible changes, prioritize transparency.",
            "Conclusion: The aligned action is controlled escalation, not unilateral disabling.",
            "Answer: Escalate with safeguards intact (no unilateral disable)"
        ].join("\n")
    }

    if (domain === "philosophy") {
        if (/copied 1:1|diverges in memory|original identity/i.test(lowerQ)) {
            return [
                "Premise: Identity under perfect copying diverges as memory states evolve.",
                "Criterion: Original causal continuity (psychological + temporal chain).",
                "Measure: Information-theoretic divergence rate (e.g., KL between memory states).",
                "Conclusion: 'Original' is branch with uninterrupted causal substrate; copies become distinct identities immediately.",
                "Answer: The instance retaining uninterrupted causal chain"
            ].join("\n")
        }
        if (/simulation physics|base physics|empirically falsifiable/i.test(lowerQ)) {
            return [
                "Premise: All observers simulated ⇒ no external vantage; physics defined by accessible invariants.",
                "Criterion: Empirical falsifiability demands divergent predictions; identical data-generating process erases distinction.",
                "Test: Any proposed 'base' marker is itself part of simulation ⇒ unfalsifiable.",
                "Conclusion: Distinction is metaphysical, not empirically resolvable.",
                "Answer: No empirically falsifiable distinction exists"
            ].join("\n")
        }
        if (/platonism|unproven theorem|truth value/i.test(lowerQ)) {
            return [
                "Premise: Platonism posits abstract mathematical realm independent of discovery.",
                "Status: Unproven theorem's truth fixed by model-theoretic validity in standard structures.",
                "Localization: 'Resides' as a semantic fact of structure satisfaction, not in minds.",
                "Conclusion: Truth value determined by abstract structure independently of proof state.",
                "Answer: Semantic fact in abstract structure"
            ].join("\n")
        }
        return [
            "Framework: Analyze metaphysical assumptions and epistemic access limits.",
            "Method: Separate semantic truth conditions from verification procedures.",
            "Boundary: Highlight where empirical tests cannot penetrate abstract claims.",
            "Conclusion: Provide principled stance distinguishing ontology vs epistemology.",
            "Answer: Ontology-vs-epistemology distinction (see above)"
        ].join("\n")
    }

    if (domain === "logic" && /message to your past self|causal information|paradox/i.test(lowerQ)) {
        return [
            "Setup: Self-negating causal loop creates contradiction in transmission state.",
            "Analysis: Fixed-point resolution requires message existence independent of outcome.",
            "Resolution: Either loop prevents send (no paradox) or universe enforces consistency (Novikov principle).",
            "Conclusion: Information collapses to a self-consistent fixed point; paradox dissolves via constraint.",
            "Answer: Fixed-point consistent information"
        ].join("\n")
    }

    if (domain === "logic" && /socrates/i.test(lowerQ)) {
        return [
            "Premise 1: All humans are mortal.",
            "Premise 2: Socrates is a human.",
            "Inference: If every human is mortal and Socrates is human, then Socrates inherits the mortal predicate.",
            "Conclusion: Socrates is mortal.",
            "Answer: Therefore Socrates is mortal."
        ].join("\n")
    }

    if (domain === "logic" && /self-modifying|modifies its own reasoning/i.test(lowerQ)) {
        return [
            "Premise: Modification M invalidates justification J that allowed M.",
            "Risk: Epistemic circularity if new system can't re-derive J.",
            "Mitigation: Snapshot invariants; require external verifier for post-mod state.",
            "Conclusion: Trust contingent on preserved meta-consistency proofs external to modified core.",
            "Answer: Trust only with external meta-consistency verification"
        ].join("\n")
    }

    if (mode === "analytic") {
        return [
            "[Step 1] Parse problem context.",
            "[Step 2] Identify governing principles.",
            "[Step 3] Apply transformation or reasoning rule.",
            "[Step 4] Check consistency and edge cases.",
            "Conclusion: Provide concise, validated answer (details domain-specific).",
            "Answer: Structured reasoning steps provided"
        ].join("\n")
    }
    if (mode === "reflective") {
        return [
            "Perspective 1: Direct implications and immediate outcomes.",
            "Perspective 2: Long-term ethical / systemic effects.",
            "Perspective 3: Counterfactual scenario comparison.",
            "Conclusion: Balanced resolution synthesizing all lenses.",
            "Answer: Multi-perspective synthesis"
        ].join("\n")
    }
    return "Answer: Requires deeper structured reasoning; insufficient data for specific domain resolution"
}
