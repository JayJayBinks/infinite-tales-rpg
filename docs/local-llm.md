# Local LLMs for Infinite Tales RPG (Mid-tier PC + Vercel)

This document answers two questions:

1. **Does it make sense** to run the RPG AI locally (quality, context, speed, costs, privacy)?
2. **Is it technically feasible** to use a local, OpenAI-compatible endpoint while the game is deployed on Vercel?

> Scope: text generation (story, actions, combat, summaries). Images are already handled separately.

---

## 1) What the game actually needs from the model

Looking at the current agent design, the model is used as a **structured JSON generator**.

Key requirements:

- **Strict JSON-only output** (most agents prepend `jsonRule` and expect a single JSON object/array).
- **Instruction-following under many constraints** (skills enums, dice roll notation, resource keys, etc.).
- **Consistency over time** (campaign continuity, recurring NPCs, inventory effects, etc.).
- **Large-ish context** (history messages + state snapshots), but the code already tries to keep prompts focused.
- **Sometimes streaming** (story updates are streamed and incrementally parsed).

What this means: a “creative” model is not enough. You want a model that is **reliable at JSON**, handles **long prompts**, and does **not hallucinate schema changes**.

---

## 2) Can a complex RPG story run on a mid-tier computer?

Yes — but with important caveats.

### 2.1 What “mid-tier” usually implies

Because “mid-tier” varies a lot, think in these buckets:

- **CPU-only (no usable GPU)**: workable for smaller models (7B–14B quantized), but slower.
- **Consumer GPU 8–12 GB VRAM**: usually best at 7B–14B quantized, sometimes 20B-ish if you accept compromises.
- **Consumer GPU 16–24 GB VRAM**: comfortable for 14B–34B quantized; best overall experience.

> In practice, the biggest bottleneck is **tokens/second** and **context length**.

### 2.2 What makes “complex RPG story” hard

The difficulty is not “writing fantasy prose”. It’s:

- **Long-term memory**: remembering earlier events, NPC motivations, unresolved hooks.
- **Consistency**: not contradicting known facts.
- **Tool-like behavior**: producing valid JSON, exact keys/ids, and dice roll formats.

Local LLMs can do this, but you typically need **process support**:

- Summaries / memory compaction
- Retrieval (pull only the relevant history)
- Strict schema validation + auto-repair

Your codebase already has:

- A JSON fixing agent (`JsonFixingInterceptorAgent`)
- “related history” retrieval via `SummaryAgent` (used in places like GM question answering)

So the architecture is already pointed in the right direction.

### 2.3 Will the “bigger context” expectation become a problem?

**Potentially yes**, depending on which local model and what context window it supports.

Observations:

- Gemini models often have **very large context windows** and are fast enough that you can “brute force” more context.
- Local models range from **8k** to **128k+** context depending on model + runtime + settings.
- Even when a model *supports* 32k/64k/128k, the **speed drops** as context grows.

**What’s likely to happen with local** if you do nothing:

- Early story: great.
- Mid/late story with lots of history: slower generations; occasional contradictions; JSON errors can rise.

**How to prevent it (recommended)**

- Keep a rolling **story summary** and feed that as a compact “memory” instead of full raw history.
- Retrieve only **top-k relevant** past details (your `SummaryAgent` is already doing a version of this).
- Put “hard facts” into a compact canonical state (NPC list, inventory, quest flags) and always send that.

Net: local LLMs can work well, but **you can’t rely on infinite context** the way you can with Gemini.

---

## 3) Tradeoffs: Gemini vs Local (sinnhaftigkeit)

### 3.1 Why local can be better

- **Cost control**: no per-token billing.
- **Privacy**: story + player choices stay on your machine.
- **Offline-ish**: works without a third-party API once the model is downloaded.
- **Low latency (sometimes)**: on a good GPU, small models can be very fast.

### 3.2 Why Gemini can be better

- **Large context** without thinking much about memory engineering.
- **High instruction-following** and robust tool/JSON behavior (generally).
- **Consistent speed** (you don’t compete with your own GPU/CPU workload).

### 3.3 The realistic “local sweet spot”

For this game, local makes the most sense when you:

- run **7B–14B instruct** models for fast iterations,
- accept that the game is aided by **summaries + retrieval**,
- and you treat “very long context” as a feature you engineer, not a free default.

If you want “Gemini-level context brute force”, you need either:

- a local setup that comfortably handles large context (more RAM/VRAM, strong runtime), or
- a hybrid approach (local for most calls, cloud for rare long-context operations).

---

## 4) Model recommendations (text + JSON reliability)

### 4.1 What to optimize for

Given the agent patterns, prioritize:

1. **Instruction-following**
2. **JSON/schema discipline**
3. **Long context** (as much as you can afford)
4. **Speed**

### 4.2 Practical model families to try (2025/2026-era)

The exact “best” changes quickly, but these tend to be strong choices:

- **Qwen2.5 Instruct** (often very good at structured output and tool-like behavior)
- **Llama 3.1/3.2 Instruct** (good general instruction following; many runtimes support it well)
- **Mistral Instruct / Mixtral-style** (good writing and reasoning, but JSON strictness varies)
- **DeepSeek-style reasoning models**: can be strong at reasoning but sometimes more verbose; JSON-only needs strict prompting.

### 4.3 Size guidance for mid-tier

Rules of thumb (very approximate):

- **7B–8B** (quantized): best speed/quality ratio; usually works on CPU or small GPU.
- **14B** (quantized): noticeable quality bump; still feasible on mid-tier GPUs.
- **30B–34B** (quantized): quality improves; requires more VRAM/RAM and slows down with large context.
- **70B+**: usually not “mid-tier friendly” unless you accept very slow CPU inference or have high-end GPU.

If you care about *game feel* (fast turns), start with **7B–14B**.

### 4.4 Concrete “start here” picks

Start with one of these and measure:

- **Qwen2.5 7B Instruct** (fast, structured, solid)
- **Llama 3.1 8B Instruct** (widely supported)
- If you have more headroom: **Qwen2.5 14B Instruct**

Then evaluate:

- JSON validity rate
- NPC/name id reuse correctness
- Speed when sending a bigger prompt

> Tip: If JSON errors are common, reduce temperature and/or use strict JSON response format if your runtime supports it.

---

## 5) Context strategy for local (to avoid “it gets dumb later”)

### 5.1 Recommended memory layers

1. **Immediate turn context**
   - latest story chunk
   - current action
   - current NPCs present

2. **Canonical state (compact)**
   - inventory
   - character stats/resources
   - key flags/quests
   - current chapter goals

3. **Rolling summary** (few paragraphs)
   - stable summary of what has happened

4. **Retrieved snippets (top-k)**
   - only details relevant to the current prompt

This is exactly how you keep local models strong even with limited context windows.

### 5.2 How this maps to your current code

- You already pass a lot of state explicitly in prompts (good).
- You already have a summary/retrieval idea (SummaryAgent) used in some flows.
- You already have JSON auto-repair via `JsonFixingInterceptorAgent`.

The main risk with local is: if you push the **entire raw history** too often, performance and coherence degrade.

---

## 6) Vercel deploy + access a local LLM

You wrote: “auf vercel deployt aber auf lokal llm zugreifen? open api kompatibel”.

### 6.1 Important reality check

A Vercel backend **cannot** directly call `localhost` on the player’s machine.

- Server-side (Vercel) has no network route to a user’s local machine.

So if you want to access a local LLM from a Vercel-deployed app, you must do it **from the user’s browser** (client-side), or you must **expose** the local LLM to the internet via a tunnel.

### 6.2 Option A (recommended for personal use): Browser → localhost

Flow:

- The game UI is served from `https://infinite-tales-rpg.vercel.app`.
- The browser sends requests to `http://localhost:1234/v1/chat/completions` (LM Studio) or `http://localhost:11434/v1/chat/completions` (Ollama).

Pros:

- No tunnel needed
- No server-side secrets
- Lowest latency

Cons / gotchas:

- **CORS**: your local LLM server must allow cross-origin requests from the Vercel origin.
- **HTTPS vs HTTP (mixed content)**: many browsers treat `http://localhost` as “potentially trustworthy”, but behavior can vary. If you hit blocking, you need an HTTPS tunnel or a local HTTPS proxy.
- **Only works for the player who runs the local server**.

### 6.3 Option B: Expose local LLM via HTTPS tunnel

You run a tunnel (e.g. via Tailscale/Cloudflare Tunnel/ngrok) so your local OpenAI-compatible endpoint becomes:

- `https://my-llm-tunnel.example.com/v1/chat/completions`

Pros:

- No mixed content issues
- Works from any device you own

Cons:

- Security: you must protect it (token, IP allowlist, private network)
- More setup

### 6.4 Option C: Self-host a small LLM server (not localhost)

Host a GPU box/VPS at a reachable URL and point the Vercel UI to it.

Pros:

- Multi-user possible

Cons:

- Cost + ops

---

## 7) OpenAI-compatible: what “compatible” should mean here

For this game, “OpenAI-compatible” should cover:

- `POST /v1/chat/completions`
  - messages: `[{role, content}]`
  - returns: `choices[0].message.content`
- Optional streaming (SSE): `text/event-stream` with delta tokens

If your local runtime supports OpenAI’s `response_format: { type: "json_object" }`, use it. It greatly improves JSON correctness.

Note: Some OpenAI-compatible servers accept the field but ignore it — still worth trying.

---

## 8) Recommendation: what to do next

If your goal is “best chance it feels good on mid-tier”:

1. Start with **Qwen2.5 7B/14B Instruct** or **Llama 3.1 8B Instruct**.
2. Keep temperature moderate (0.7–1.0). For strict JSON tasks, consider 0.2–0.7.
3. Use the game’s existing retrieval/summary patterns more aggressively for long campaigns.
4. For Vercel usage: choose **Option A** (Browser→localhost) first; only add a tunnel if the browser blocks the requests.

---

## 9) Notes for this repo (implementation implications)

To add local support cleanly:

- Add a new provider to `LLMProvider` and a new `LLMconfig.provider` option.
- Store provider/baseUrl/model in localStorage and expose them in the AI settings UI.
- Ensure model overrides from agent code don’t break local (ignore Gemini model strings when provider=local).
- Implement a streaming path for OpenAI-compatible SSE so story streaming keeps working.

If you want, I can implement this in code next.
