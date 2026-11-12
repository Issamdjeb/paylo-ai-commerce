export interface KnowledgeTool {
  id: string;
  name: string;
  url: string;
  category: string;
  pricing: string;
  startingPrice?: string;
  description: string;
  bestFor?: string;
  tags?: string[];
}

export const COMPREHENSIVE_TOOLS_KB: KnowledgeTool[] = [
  // Meeting Notes & Productivity
  {
    id: "granola",
    name: "Granola",
    url: "https://go.granola.ai/ai-tools-hub",
    category: "Productivity & Meeting Notes",
    pricing: "Freemium",
    startingPrice: "$14/mo",
    description: "The AI notepad for meetings — transcribes conversations, captures context, and extracts structured action items automatically. AItools Hubi members get their first month 100% free.",
    bestFor: "founder meetings, customer discovery, and automated meeting action items",
    tags: ["meetings", "notes", "transcription", "audio", "granola", "summaries"],
  },
  {
    id: "otter-ai",
    name: "Otter.ai",
    url: "https://otter.ai",
    category: "Productivity & Meeting Notes",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "AI-powered real-time meeting transcription and automated summaries for Zoom, Google Meet, and Teams.",
    bestFor: "live meeting transcription and team collaboration",
    tags: ["meetings", "transcription", "notes", "zoom"],
  },
  {
    id: "fireflies-ai",
    name: "Fireflies.ai",
    url: "https://fireflies.ai",
    category: "Productivity & Meeting Notes",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "Automates conversation tracking and meeting notes directly into CRM systems.",
    bestFor: "sales call intelligence and automated CRM sync",
    tags: ["sales", "meetings", "crm", "notes"],
  },
  {
    id: "notion-ai",
    name: "Notion AI",
    url: "https://notion.so/product/ai",
    category: "Productivity & Workspace",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "Integrated workspace AI for summarizing notes, writing docs, and organizing databases.",
    bestFor: "connected workspace documentation and knowledge base management",
    tags: ["docs", "notes", "workspace", "productivity"],
  },

  // Coding & Fullstack Development
  {
    id: "cursor",
    name: "Cursor",
    url: "https://cursor.com",
    category: "Coding & IDE",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "AI-first code editor (VS Code fork) with full-codebase agent mode, multi-file composer, and instant diffs.",
    bestFor: "senior software engineers, fullstack app development, and codebase-wide refactoring",
    tags: ["code", "ide", "vscode", "agent", "composer"],
  },
  {
    id: "v0",
    name: "v0 by Vercel",
    url: "https://v0.dev",
    category: "Coding & UI Design",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "Generates production-ready React, Tailwind CSS, and Next.js UI components from plain English prompts.",
    bestFor: "frontend UI generation and rapid React component prototyping",
    tags: ["react", "ui", "tailwind", "vercel", "frontend"],
  },
  {
    id: "bolt-new",
    name: "Bolt.new",
    url: "https://bolt.new",
    category: "Coding & Prototyping",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "In-browser fullstack AI development environment that builds, runs, and deploys full web apps from scratch.",
    bestFor: "instant fullstack web apps without local environment setup",
    tags: ["fullstack", "in-browser", "webcontainers", "prototyping"],
  },
  {
    id: "framer",
    name: "Framer",
    url: "https://framer.link/aitoolshubi",
    category: "Web Design & No-Code Builder",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "Design and ship high-performance responsive websites with AI canvas, built-in CMS, and world-class animations.",
    bestFor: "interactive landing pages, startup websites, and portfolio design without coding",
    tags: ["framer", "website", "nocode", "design", "builder"],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    url: "https://codeium.com/windsurf",
    category: "Coding & IDE",
    pricing: "Freemium",
    startingPrice: "$15/mo",
    description: "Next-generation agentic IDE with 'Cascade' real-time flow that anticipates your next coding step.",
    bestFor: "agentic coding flows and multi-file debugging",
    tags: ["codeium", "ide", "agent", "cascade"],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    url: "https://github.com/features/copilot",
    category: "Coding & IDE",
    pricing: "Paid",
    startingPrice: "$10/mo",
    description: "The world's most widely adopted AI pair programmer built directly into VS Code, JetBrains, and Visual Studio.",
    bestFor: "inline tab autocompletion and IDE pull request analysis",
    tags: ["github", "copilot", "autocomplete", "code"],
  },
  {
    id: "lovable",
    name: "Lovable",
    url: "https://lovable.dev",
    category: "Coding & Prototyping",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "The GPT engineer that builds fullstack web applications, connects to Supabase, and publishes production code.",
    bestFor: "non-technical founders building full web applications with auth & database",
    tags: ["gpt-engineer", "builder", "supabase", "fullstack"],
  },
  {
    id: "replit",
    name: "Replit Agent",
    url: "https://replit.com",
    category: "Coding & Deployment",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "Autonomous software agent that writes code, manages dependencies, configures databases, and deploys live.",
    bestFor: "building and hosting prototypes in minutes",
    tags: ["replit", "agent", "hosting", "cloud-ide"],
  },

  // Frontier AI Models & LLMs
  {
    id: "claude",
    name: "Claude 3.7 Sonnet",
    url: "https://claude.ai",
    category: "LLM & Reasoning",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "Anthropic's flagship hybrid reasoning model offering both lightning-fast instant responses and extended deep thinking.",
    bestFor: "complex coding, nuance, long-document synthesis, and frontend design",
    tags: ["anthropic", "claude", "reasoning", "sonnet"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT (GPT-4o & GPT-5)",
    url: "https://chatgpt.com",
    category: "LLM & Multimodal",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "OpenAI's industry benchmark multimodal model for writing, deep analysis, voice conversation, and web search.",
    bestFor: "everyday productivity, voice chat, web research, and reasoning",
    tags: ["openai", "chatgpt", "gpt-4o", "gpt-5"],
  },
  {
    id: "deepseek",
    name: "DeepSeek R1",
    url: "https://deepseek.com",
    category: "Open Weights & Reasoning",
    pricing: "Free / Ultra-Low Cost",
    description: "State-of-the-art open reasoning model that matches proprietary frontier models at 1/30th the API price.",
    bestFor: "math, algorithm design, heavy logic puzzles, and cost-effective API scale",
    tags: ["deepseek", "r1", "reasoning", "open-source"],
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    url: "https://perplexity.ai",
    category: "AI Search & Research",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "Conversational search engine that browses the live internet, synthesizes answers, and cites verifiable sources.",
    bestFor: "fact-checking, market research, and replacing Google searches",
    tags: ["search", "research", "citations", "web"],
  },

  // Image & Visual Art
  {
    id: "midjourney",
    name: "Midjourney v6",
    url: "https://midjourney.com",
    category: "Image Generation",
    pricing: "Paid",
    startingPrice: "$10/mo",
    description: "Unrivaled artistic photorealism, cinematic lighting, and aesthetic control for visual creators.",
    bestFor: "concept art, advertising visuals, cinematic renders, and mood boards",
    tags: ["image", "art", "midjourney", "photorealism"],
  },
  {
    id: "recraft",
    name: "Recraft AI",
    url: "https://recraft.ai",
    category: "Vector & Graphic Design",
    pricing: "Freemium",
    startingPrice: "$20/mo",
    description: "AI generator specifically built for vector art, SVG icons, brand style palettes, and 3D illustrations.",
    bestFor: "graphic designers, UI icons, SVG vector graphics, and brand consistency",
    tags: ["vector", "svg", "icons", "design", "graphic"],
  },
  {
    id: "ideogram",
    name: "Ideogram 2.0",
    url: "https://ideogram.ai",
    category: "Image & Typography",
    pricing: "Freemium",
    startingPrice: "$8/mo",
    description: "World-class graphic design model with flawless typography rendering and poster layouts.",
    bestFor: "t-shirt graphics, typography posters, social media banners, and logos",
    tags: ["typography", "text-in-image", "posters", "logos"],
  },

  // Video & Motion
  {
    id: "runway",
    name: "Runway Gen-3 Alpha",
    url: "https://runwayml.com",
    category: "Video Generation",
    pricing: "Freemium",
    startingPrice: "$12/mo",
    description: "High-fidelity text-to-video and image-to-video generation with cinematic camera controls.",
    bestFor: "filmmaking, visual effects, and dynamic b-roll video clips",
    tags: ["video", "gen-3", "cinematic", "vfx"],
  },
  {
    id: "kling",
    name: "Kling AI",
    url: "https://klingai.com",
    category: "Video Generation",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "Ultra-high physical simulation video model generating up to 2-minute clips with natural motion.",
    bestFor: "realistic human motion and complex physical interactions in video",
    tags: ["video", "motion", "simulation"],
  },
  {
    id: "heygen",
    name: "HeyGen",
    url: "https://heygen.com",
    category: "AI Avatars & Presenters",
    pricing: "Freemium",
    startingPrice: "$29/mo",
    description: "Create studio-quality video presenters and translate spoken videos with automatic lip-sync.",
    bestFor: "marketing explainers, product onboarding, and multi-language video localization",
    tags: ["avatars", "presenters", "localization", "lip-sync"],
  },

  // Voice & Audio
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    url: "https://elevenlabs.io",
    category: "Voice AI & Speech",
    pricing: "Freemium",
    startingPrice: "$5/mo",
    description: "Industry-standard natural voice synthesis, instant voice cloning, and audio sound effect generation.",
    bestFor: "audiobooks, video narration, conversational voice agents, and podcasts",
    tags: ["voice", "tts", "speech", "cloning", "audio"],
  },
  {
    id: "suno",
    name: "Suno v3",
    url: "https://suno.com",
    category: "Music Generation",
    pricing: "Freemium",
    startingPrice: "$10/mo",
    description: "Generates radio-ready songs with vocals, lyrics, and full instrumentation from simple text prompts.",
    bestFor: "custom background tracks, jingles, and full-length musical tracks",
    tags: ["music", "songs", "lyrics", "audio"],
  },

  // Automation & No-Code
  {
    id: "make",
    name: "Make.com",
    url: "https://make.com",
    category: "Workflow Automation",
    pricing: "Freemium",
    startingPrice: "$9/mo",
    description: "Visual workflow automation platform connecting 1,500+ apps with AI modules and webhooks.",
    bestFor: "complex multi-branch automations, CRM pipelines, and backend routing",
    tags: ["automation", "workflows", "no-code", "integrations"],
  },
  {
    id: "n8n",
    name: "n8n",
    url: "https://n8n.io",
    category: "Workflow Automation & AI Agents",
    pricing: "Free Self-Hosted / Cloud",
    startingPrice: "$20/mo",
    description: "Fair-code workflow automation tool with native AI agent nodes, LangChain integration, and custom code support.",
    bestFor: "technical teams requiring self-hosted data privacy and custom AI agents",
    tags: ["open-source", "automation", "agents", "langchain"],
  },
  {
    id: "supabase",
    name: "Supabase Vector",
    url: "https://supabase.com",
    category: "Backend & Database",
    pricing: "Freemium",
    startingPrice: "$25/mo",
    description: "Open-source Firebase alternative with PostgreSQL, Auth, Realtime, and built-in pgvector for AI apps.",
    bestFor: "fullstack AI SaaS backend, user auth, and vector search embeddings",
    tags: ["database", "postgres", "auth", "vector"],
  },
];

/**
 * Intelligent Keyword & Synonym matcher to retrieve tools relevant to the user query
 */
export function findRelevantTools(query: string, maxResults = 5): KnowledgeTool[] {
  if (!query || typeof query !== "string") return [];
  const q = query.toLowerCase();

  const scores: { tool: KnowledgeTool; score: number }[] = [];

  for (const tool of COMPREHENSIVE_TOOLS_KB) {
    let score = 0;
    const nameLower = tool.name.toLowerCase();
    const idLower = tool.id.toLowerCase();
    const descLower = tool.description.toLowerCase();
    const catLower = tool.category.toLowerCase();
    const bestForLower = (tool.bestFor || "").toLowerCase();
    const tags = tool.tags || [];

    // Exact name match
    if (q.includes(nameLower) || q.includes(idLower)) {
      score += 100;
    }

    // Specific domain keywords
    if ((q.includes("meeting") || q.includes("notepad") || q.includes("transcri") || q.includes("note")) && (idLower === "granola" || idLower.includes("otter") || idLower.includes("fireflies"))) {
      score += 50;
    }

    if ((q.includes("code") || q.includes("developer") || q.includes("ide") || q.includes("program")) && (idLower === "cursor" || idLower === "v0" || idLower === "windsurf" || idLower === "bolt-new")) {
      score += 30;
    }

    if ((q.includes("video") || q.includes("clip") || q.includes("movie")) && (idLower === "runway" || idLower === "kling" || idLower === "heygen")) {
      score += 30;
    }

    if ((q.includes("image") || q.includes("picture") || q.includes("art") || q.includes("vector")) && (idLower === "midjourney" || idLower === "recraft" || idLower === "ideogram")) {
      score += 30;
    }

    if ((q.includes("voice") || q.includes("audio") || q.includes("speech") || q.includes("tts")) && (idLower === "elevenlabs" || idLower === "suno")) {
      score += 30;
    }

    if ((q.includes("auto") || q.includes("workflow") || q.includes("pipeline")) && (idLower === "make" || idLower === "n8n")) {
      score += 30;
    }

    // Tag matches
    for (const tag of tags) {
      if (q.includes(tag)) {
        score += 15;
      }
    }

    // Description matches
    const qWords = q.split(/\s+/).filter(w => w.length > 3);
    for (const word of qWords) {
      if (descLower.includes(word)) score += 5;
      if (bestForLower.includes(word)) score += 8;
      if (catLower.includes(word)) score += 6;
    }

    if (score > 0) {
      scores.push({ tool, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, maxResults).map(s => s.tool);
}

// ─── HUBI EXCLUSIVE PARTNER DEALS & PERKS ──────────────────────────
export interface HubiDeal {
  id: string;
  name: string;
  badge: string;
  savings: string;
  url: string;
  description: string;
  terms: string;
}

export const HUBI_EXCLUSIVE_DEALS: HubiDeal[] = [
  {
    id: "granola",
    name: "Granola",
    badge: "100% OFF 1ST MONTH",
    savings: "Save $20/mo • Free 1st Month ($20 Value)",
    url: "https://go.granola.ai/ai-tools-hub",
    description: "The AI notepad for meetings — captures context and extracts structured action items automatically. AItools Hubi members get their first month 100% free.",
    terms: "No promo code required. 100% discount is applied automatically when using our official partner link.",
  },
  {
    id: "wispr-flow",
    name: "Wispr Flow",
    badge: "GRANOLA PLAN BUYOUT",
    savings: "Up to 12 Months Free + 3 Bonus Months",
    url: "https://ref.wisprflow.ai/ai-tools-hub-granola",
    description: "Voice AI & Meeting Notetaker. Paying for Granola? Wispr Flow covers the rest of your Granola plan plus gives you 3 bonus months free (up to 12 months free).",
    terms: "Enter your email on the partner link, then forward your Granola receipt to get the buyout applied.",
  },
  {
    id: "framer",
    name: "Framer",
    badge: "OFFICIAL PARTNER TIER",
    savings: "Start Free • Zero-code AI Web Builder",
    url: "https://framer.link/aitoolshubi",
    description: "Design and ship high-performance responsive websites with AI canvas, built-in CMS, and world-class micro-animations.",
    terms: "Official partner access with generous free tier and startup discounts.",
  },
  {
    id: "make",
    name: "Make.com",
    badge: "PARTNER TIER BONUS",
    savings: "10,000 Free Operations Included",
    url: "https://www.make.com/en/register?pc=issamdjebabra",
    description: "Visual workflow automation platform. Connect 1,000+ apps and design complex multi-step AI pipelines without code.",
    terms: "10,000 bonus operations automatically credited upon free registration via partner link.",
  },
  {
    id: "clawtrust",
    name: "ClawTrust",
    badge: "ENTERPRISE PILOT ACCESS",
    savings: "Enterprise Pilot & Security Onboarding",
    url: "https://clawtrust.ai/r/ae15f2c5",
    description: "Enterprise AI Security & Compliance infrastructure. Real-time prompt injection detection, data loss prevention, and SOC2/HIPAA compliance.",
    terms: "Direct verified pilot onboarding via our executive partner link.",
  },
];

// ─── HUBI CURATED AI BLUEPRINTS & STACKS ────────────────────────────
export interface HubiBlueprint {
  id: string;
  title: string;
  tagline: string;
  hoursSaved: string;
  monthlyCost: string;
  stack: string[];
  description: string;
}

export const HUBI_CURATED_BLUEPRINTS: HubiBlueprint[] = [
  {
    id: "solo-saas",
    title: "Solo SaaS & Indie Hacker Blueprint",
    tagline: "Build, launch, and monetize software with a 1-person lean engineering team",
    hoursSaved: "32 hours / week",
    monthlyCost: "$69/mo (or $0 on free tiers)",
    stack: [
      "Brain: Claude 3.7 Sonnet ($20/mo) / DeepSeek R1 (Free)",
      "IDE: Cursor ($20/mo) or Windsurf ($15/mo)",
      "UI Builder: v0 by Vercel ($20/mo) or Bolt.new ($20/mo)",
      "Backend & Vector DB: Supabase ($0 - $25/mo)",
      "Automation & Agents: n8n (Self-hosted $0) / Make.com ($9/mo)",
    ],
    description: "The battle-tested 2026 AI toolchain for solo founders shipping revenue-generating apps. Replaces a 4-person dev and design team.",
  },
  {
    id: "content-creator",
    title: "Autonomous Content & Media Engine",
    tagline: "High-volume viral video, podcast, and newsletter generation",
    hoursSaved: "24 hours / week",
    monthlyCost: "$85/mo",
    stack: [
      "Research & Trend Discovery: Perplexity Pro ($20/mo)",
      "Scriptwriting: Claude 3.7 Sonnet ($20/mo)",
      "Visuals & Thumbnails: Midjourney v6 ($10/mo) / Flux.1 Schnell (Free)",
      "Voice & Narration: ElevenLabs ($5/mo - $22/mo)",
      "Video Generation: Kling AI ($10/mo) or Runway Gen-3 ($12/mo)",
    ],
    description: "End-to-end multi-platform content pipeline that turns single ideas into multi-format viral distribution.",
  },
  {
    id: "marketing-growth",
    title: "AI Growth Marketing & Lead Generation",
    tagline: "Scale organic search, landing pages, and automated outbound lead nurture",
    hoursSaved: "20 hours / week",
    monthlyCost: "$45/mo",
    stack: [
      "SEO Intelligence & Copy: Perplexity Pro + Claude 3.7",
      "Landing Page Builder: Framer ($10/mo via partner link)",
      "Pipeline Automation: Make.com (10,000 free operations via partner link)",
      "Meeting Notes & Discovery: Granola (1st month 100% free)",
    ],
    description: "High-conversion growth stack designed to validate offers, capture leads, and book sales calls without marketing agency overhead.",
  },
];

// ─── HUBI FRONTIER AI MODELS & BENCHMARKS ───────────────────────────
export interface HubiModel {
  id: string;
  name: string;
  provider: string;
  category: string;
  contextWindow: string;
  benchmarks: string;
  bestFor: string;
}

export const HUBI_FRONTIER_MODELS: HubiModel[] = [
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    category: "Hybrid Reasoning & Fullstack Code",
    contextWindow: "200k tokens",
    benchmarks: "SWE-bench Verified #1 Leader (70.3%), HumanEval 92.4%",
    bestFor: "Full-codebase refactoring, agentic multi-file architecture, and deep analytical problem solving.",
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "OpenAI",
    category: "Autonomous Tool Synthesis & Systemic Reasoning",
    contextWindow: "1.05M tokens",
    benchmarks: "SWE-bench Verified 96.8%, AIME 98.4%, GPQA Diamond 82.5%",
    bestFor: "Autonomous tool synthesis, complex API orchestration, and massive enterprise documents.",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    category: "Open-Weights Reasoning & Math",
    contextWindow: "128k tokens",
    benchmarks: "AIME 79.8%, MATH-500 97.3%, near-parity with o1 at 95% lower inference cost",
    bestFor: "Complex mathematical derivations, algorithmic logic, and low-cost reasoning pipelines.",
  },
  {
    id: "llama-3-3-70b",
    name: "Llama 3.3 70B",
    provider: "Meta",
    category: "Open-Weights Multilingual Workhorse",
    contextWindow: "128k tokens",
    benchmarks: "MMLU 88.6%, HumanEval 81.7%",
    bestFor: "Self-hosted private enterprise deployments, privacy-sensitive workloads, and fast instruction following.",
  },
  {
    id: "gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    category: "Real-Time Multimodal & Ultra-Fast Latency",
    contextWindow: "1.0M tokens",
    benchmarks: "Sub-200ms latency, native audio/video understanding",
    bestFor: "Live voice agents, video stream processing, and instant document summarization.",
  },
];

export function findRelevantDeals(query: string): HubiDeal[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return HUBI_EXCLUSIVE_DEALS.filter(
    (d) =>
      q.includes("deal") ||
      q.includes("perk") ||
      q.includes("discount") ||
      q.includes("promo") ||
      q.includes("free month") ||
      q.includes(d.id) ||
      q.includes(d.name.toLowerCase())
  );
}

export function findRelevantBlueprints(query: string): HubiBlueprint[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return HUBI_CURATED_BLUEPRINTS.filter(
    (b) =>
      q.includes("stack") ||
      q.includes("blueprint") ||
      q.includes("how to build") ||
      q.includes("saas") ||
      q.includes("workflow") ||
      q.includes("content") ||
      q.includes("marketing") ||
      q.includes(b.id)
  );
}

export function findRelevantModels(query: string): HubiModel[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return HUBI_FRONTIER_MODELS.filter(
    (m) =>
      q.includes("model") ||
      q.includes("benchmark") ||
      q.includes("claude") ||
      q.includes("gpt") ||
      q.includes("deepseek") ||
      q.includes("llama") ||
      q.includes("gemini") ||
      q.includes(m.id) ||
      q.includes(m.name.toLowerCase())
  );
}

/**
 * Builds an enriched Hubi intelligence context to inject into LLM system prompts
 */
export function buildHubiPromptContext(query: string): string {
  const q = query.toLowerCase();
  const relevantTools = findRelevantTools(query, 4);
  const relevantDeals = findRelevantDeals(query);
  const relevantBlueprints = findRelevantBlueprints(query);
  const relevantModels = findRelevantModels(query);

  let context = "\n--- AI TOOLS HUBI PLATFORM KNOWLEDGE BASE ---\n";
  context += "AItools Hubi (https://aitoolshubi.com) is the premier curated directory of 500+ verified AI tools, hands-on founder blueprints, model benchmarks, and exclusive partner perks.\n";

  if (relevantTools.length > 0) {
    context += "\nTOP VERIFIED TOOLS MATCHING QUERY:\n";
    relevantTools.forEach((t) => {
      context += `- ${t.name} (${t.url}): ${t.description} [Pricing: ${t.pricing}${t.startingPrice ? ` · from ${t.startingPrice}` : ""}] (Best for: ${t.bestFor || "productivity"})\n`;
    });
  }

  if (relevantDeals.length > 0) {
    context += "\nEXCLUSIVE HUBI PARTNER DEALS & DISCOUNTS:\n";
    relevantDeals.forEach((d) => {
      context += `- ${d.name} (${d.badge}): ${d.savings}. Link: ${d.url}. ${d.description} Note: ${d.terms}\n`;
    });
  }

  if (relevantBlueprints.length > 0) {
    context += "\nCURATED AI BLUEPRINTS & STACKS:\n";
    relevantBlueprints.forEach((b) => {
      context += `- ${b.title} (${b.monthlyCost}, saves ${b.hoursSaved}): ${b.description}\n  Recommended Stack:\n  * ${b.stack.join("\n  * ")}\n`;
    });
  }

  if (relevantModels.length > 0) {
    context += "\nFRONTIER AI MODELS & BENCHMARKS:\n";
    relevantModels.forEach((m) => {
      context += `- ${m.name} (${m.provider}, ${m.category}): ${m.contextWindow} context window. Benchmarks: ${m.benchmarks}. Best for: ${m.bestFor}\n`;
    });
  }

  return context;
}
