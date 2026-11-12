export interface Tool {
  id: string | number;
  /** ISO timestamp used for "newest" sort — string for Airtable records, absent for fallback */
  createdTime?: string;
  name: string;
  description: string;
  category: 'code' | 'image' | 'video' | 'text' | 'automation' | 'voice';
  icon: string;
  url: string;
  users: number;
  usersLabel?: string;
  featured?: boolean;
  pricing?: string;
  startingPrice?: string;
  rating?: number;
  votesCount?: number;
  verified?: boolean;
  sponsored?: boolean;
  bestFor?: string;
  tags?: string[];
  model?: string;
  videoUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  docUrl?: string;
  downloadUrl?: string;
  // Partner & Affiliate Monetization fields
  affiliateUrl?: string;
  dealBadge?: string;
  dealPerk?: string;
  dealExpiry?: string;
  // Smart Price Refresh & Sync fields
  pricingVerifiedAt?: string;
  pricingVerifiedStatus?: string;
  previousStartingPrice?: string;
}

export const FALLBACK_TOOLS: Tool[] = [
  { id: 1, name: 'ChatGPT', description: 'The most popular AI chatbot for writing, coding, and research.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128', url: 'https://chatgpt.com', users: 180, usersLabel: '180M+', featured: true, pricing: 'Freemium', startingPrice: '$20/mo', rating: 4.9, verified: true, bestFor: 'conversational answers, copywriting, and general coding' },
  { id: 2, name: 'GitHub Copilot', description: 'AI pair programmer built into VS Code and JetBrains IDEs.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=128', url: 'https://github.com/features/copilot', users: 50, usersLabel: '50M+', featured: true, pricing: 'Paid', startingPrice: '$10/mo', rating: 4.8, verified: true, bestFor: 'code completion and pair programming' },
  { id: 3, name: 'Replit Ghostwriter', description: 'AI assistant for writing and improving code directly in Replit.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=replit.com&sz=128', url: 'https://replit.com', users: 23, usersLabel: '23M+', featured: true, pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 4, name: 'Codeium', description: 'Free AI code completion for 70+ programming languages.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=codeium.com&sz=128', url: 'https://codeium.com', users: 0.8, usersLabel: '800K+', pricing: 'Free', rating: 4.6, verified: true },
  { id: 5, name: 'Tabnine', description: 'AI-powered autocompletion for 30+ editors and languages.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=tabnine.com&sz=128', url: 'https://www.tabnine.com', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 6, name: 'Claude', description: 'Anthropic\'s advanced reasoning model — exceptional for analysis and coding.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=128', url: 'https://claude.ai', users: 18, usersLabel: '18M+', featured: true, pricing: 'Freemium', startingPrice: '$20/mo', rating: 4.9, verified: true, bestFor: 'long-context analysis, complex coding, and reasoning' },
  { id: 7, name: 'Hugging Face', description: 'Open-source ML platform with thousands of models and datasets.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=huggingface.co&sz=128', url: 'https://huggingface.co', users: 5, usersLabel: '5M+', pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 8, name: 'Google Gemini', description: 'Google\'s multimodal AI for research, coding, and creative work.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=128', url: 'https://gemini.google.com', users: 90, usersLabel: '90M+', featured: true, pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 9, name: 'Phind', description: 'AI search engine optimized for developers and coding questions.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=phind.com&sz=128', url: 'https://www.phind.com', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 10, name: 'Midjourney', description: 'Create stunning, artistic images from text prompts with unmatched aesthetic beauty.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=midjourney.com&sz=128', url: 'https://www.midjourney.com', users: 16, usersLabel: '16M+', featured: true, pricing: 'Paid', startingPrice: '$10/mo', rating: 4.9, verified: true, bestFor: 'artistic image generation & cinematic aesthetics' },
  { id: 11, name: 'DALL-E', description: 'OpenAI\'s image generation model — create realistic images from text.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=openai.com&sz=128', url: 'https://openai.com/dall-e', users: 3, usersLabel: '3M+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 12, name: 'Stable Diffusion', description: 'Open-source text-to-image model you can run locally or via API.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=stability.ai&sz=128', url: 'https://stability.ai', users: 10, usersLabel: '10M+', pricing: 'Free', rating: 4.6, verified: true },
  { id: 13, name: 'Canva', description: 'Online design platform with AI-powered image generation and layout.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=canva.com&sz=128', url: 'https://www.canva.com', users: 170, usersLabel: '170M+', featured: true, pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 14, name: 'Figma', description: 'Collaborative UI design tool with powerful AI features.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=figma.com&sz=128', url: 'https://www.figma.com', users: 8, usersLabel: '8M+', pricing: 'Freemium', rating: 4.9, verified: true },
  { id: 15, name: 'Runway ML', description: 'Professional AI video creation, editing and generation platform.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=runwayml.com&sz=128', url: 'https://runwayml.com', users: 3, usersLabel: '3M+', featured: true, pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 16, name: 'Synthesia', description: 'Create professional AI presenter videos from text in minutes.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=synthesia.io&sz=128', url: 'https://www.synthesia.io', users: 0.5, usersLabel: '500K+', pricing: 'Paid', rating: 4.6, verified: true },
  { id: 17, name: 'Descript', description: 'Edit audio & video by editing text — AI-powered transcription built in.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=descript.com&sz=128', url: 'https://www.descript.com', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 18, name: 'Pika Labs', description: 'AI video generator that transforms images and text into cinematic clips.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=pika.art&sz=128', url: 'https://pika.art', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 19, name: 'Perplexity', description: 'AI-powered search engine that cites sources and summarizes results.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128', url: 'https://www.perplexity.ai', users: 15, usersLabel: '15M+', featured: true, pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 20, name: 'Jasper', description: 'AI content platform for marketing teams — blog, ads, and social.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=jasper.ai&sz=128', url: 'https://www.jasper.ai', users: 1, usersLabel: '1M+', pricing: 'Paid', startingPrice: '$39/mo', rating: 4.5, verified: true },
  { id: 21, name: 'Notion AI', description: 'AI writing assistant built into Notion for notes, docs, and projects.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=notion.so&sz=128', url: 'https://www.notion.so/product/ai', users: 30, usersLabel: '30M+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 22, name: 'Otter.ai', description: 'AI-powered meeting transcription and real-time notes.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=otter.ai&sz=128', url: 'https://otter.ai', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 23, name: 'Cursor', description: 'AI-first code editor with tab completion and codebase chat.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=cursor.com&sz=128', url: 'https://www.cursor.com', users: 4, usersLabel: '4M+', featured: true, pricing: 'Freemium', startingPrice: '$20/mo', rating: 4.9, verified: true, bestFor: 'AI-assisted coding and codebase exploration' },
  { id: 24, name: 'V0 by Vercel', description: 'AI UI generator — turn prompts into production-ready React components.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=v0.dev&sz=128', url: 'https://v0.dev', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 25, name: 'Blackbox AI', description: 'AI coding assistant for your IDE — understands and completes any code.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=blackbox.ai&sz=128', url: 'https://www.blackbox.ai', users: 0.5, usersLabel: '500K+', pricing: 'Free', rating: 4.4 },
  { id: 26, name: 'DeepSeek Coder', description: 'Open-source AI coder with strong multilingual reasoning.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=deepseek.com&sz=128', url: 'https://www.deepseek.com', users: 8, usersLabel: '8M+', pricing: 'Free', rating: 4.8, verified: true },
  { id: 27, name: 'Windsurf', description: 'AI-first IDE built on VS Code with deeply integrated AI flows.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=windsurf.ai&sz=128', url: 'https://windsurf.ai', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 28, name: 'Bolt.new', description: 'AI website builder that generates full working sites from one prompt.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=bolt.new&sz=128', url: 'https://bolt.new', users: 1.5, usersLabel: '1.5M+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 29, name: 'Aider', description: 'AI pair programmer that edits entire codebases from your terminal.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=aider.chat&sz=128', url: 'https://aider.chat', users: 0.15, usersLabel: '150K+', pricing: 'Free', rating: 4.8, verified: true },
  { id: 30, name: 'Cline', description: 'AI coding agent that writes and edits code from your VS Code.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=cline.bot&sz=128', url: 'https://cline.bot', users: 0.1, usersLabel: '100K+', pricing: 'Free', rating: 4.3 },
  { id: 31, name: 'Leonardo AI', description: 'AI image generator built for high-quality game assets and concept art.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=leonardo.ai&sz=128', url: 'https://leonardo.ai', users: 4, usersLabel: '4M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 32, name: 'Ideogram', description: 'AI image generator known for accurate typography in generated images.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=ideogram.ai&sz=128', url: 'https://ideogram.ai', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 33, name: 'Adobe Firefly', description: 'Adobe\'s AI for generative images, text effects, and recoloring.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=firefly.adobe.com&sz=128', url: 'https://firefly.adobe.com', users: 12, usersLabel: '12M+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 34, name: 'Krea AI', description: 'Real-time AI image generation and enhancement for visual creators.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=krea.ai&sz=128', url: 'https://krea.ai', users: 0.1, usersLabel: '100K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 35, name: 'Flux', description: 'Black Forest Labs\' open-source image model — stunning quality and control.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=blackforestlabs.ai&sz=128', url: 'https://blackforestlabs.ai', users: 0.1, usersLabel: '100K+', pricing: 'Free', rating: 4.5, verified: true },
  { id: 36, name: 'Remove.bg', description: 'AI background remover — removes backgrounds from photos instantly.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=remove.bg&sz=128', url: 'https://remove.bg', users: 30, usersLabel: '30M+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 37, name: 'Bing Image Creator', description: 'Microsoft AI image generator powered by DALL-E — free to use.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=bing.com&sz=128', url: 'https://www.bing.com/create', users: 4, usersLabel: '4M+', pricing: 'Free', rating: 4.3, verified: true },
  { id: 38, name: 'NightCafe Studio', description: 'Online AI art generator supporting DALL-E, Stable Diffusion & more.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=nightcafe.studio&sz=128', url: 'https://nightcafe.studio', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.2 },
  { id: 39, name: 'Suno AI', description: 'AI music generator that creates full songs with vocals from text.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=suno.com&sz=128', url: 'https://suno.com', users: 12, usersLabel: '12M+', featured: true, pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 40, name: 'ElevenLabs', description: 'Best-in-class AI voice generation, cloning, and text-to-speech.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=128', url: 'https://elevenlabs.io', users: 3, usersLabel: '3M+', featured: true, pricing: 'Freemium', rating: 4.8, verified: true, bestFor: 'voice generation and cloning' },
  { id: 41, name: 'HeyGen', description: 'AI avatar video generator — create talking head videos from scripts.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=heygen.com&sz=128', url: 'https://heygen.com', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 42, name: 'Luma AI', description: 'AI for 3D scene capture, video generation, and cinematic shots.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=lumalabs.ai&sz=128', url: 'https://lumalabs.ai', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 43, name: 'Kling AI', description: 'AI video generator creating high-quality clips from text or images.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=klingai.com&sz=128', url: 'https://klingai.com', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 44, name: 'Kapwing', description: 'Browser-based video editor with AI subtitles and content repurposing.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=kapwing.com&sz=128', url: 'https://www.kapwing.com', users: 0.8, usersLabel: '800K+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 45, name: 'VEED', description: 'Online video editor with AI transcription, subtitles, and effects.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=veed.io&sz=128', url: 'https://www.veed.io', users: 0.7, usersLabel: '700K+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 46, name: 'Opus Clip', description: 'AI that automatically turns long videos into viral short clips.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=opus.pro&sz=128', url: 'https://opus.pro', users: 0.1, usersLabel: '100K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 47, name: 'AssemblyAI', description: 'Speech-to-text and audio intelligence API for developers.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=assemblyai.com&sz=128', url: 'https://www.assemblyai.com', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 48, name: 'Deepgram', description: 'Real-time speech recognition API built on deep learning.', category: 'voice', icon: 'https://www.google.com/s2/favicons?domain=deepgram.com&sz=128', url: 'https://deepgram.com', users: 0.2, usersLabel: '200K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 49, name: 'QuillBot', description: 'AI paraphrasing, summarization, grammar checking, and citation tools.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=quillbot.com&sz=128', url: 'https://quillbot.com', users: 35, usersLabel: '35M+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 50, name: 'Grammarly', description: 'AI writing assistant for grammar, tone, style, and clarity.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=grammarly.com&sz=128', url: 'https://www.grammarly.com', users: 30, usersLabel: '30M+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 51, name: 'Copy.ai', description: 'AI writing assistant for marketing copy, ads, and long-form content.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=copy.ai&sz=128', url: 'https://copy.ai', users: 10, usersLabel: '10M+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 52, name: 'Writesonic', description: 'AI content generator for SEO articles, ads, and product descriptions.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=writesonic.com&sz=128', url: 'https://writesonic.com', users: 3, usersLabel: '3M+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 53, name: 'Microsoft Copilot', description: 'AI assistant integrated across Microsoft 365 and Windows.', category: 'text', icon: '/icons/microsoft-copilot.svg', url: 'https://copilot.microsoft.com', users: 77, usersLabel: '77M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 54, name: 'NotebookLM', description: 'Google\'s AI research notebook that synthesizes your sources.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=notebooklm.google&sz=128', url: 'https://notebooklm.google', users: 5, usersLabel: '5M+', pricing: 'Free', rating: 4.7, verified: true },
  { id: 55, name: 'Wordtune', description: 'AI writing tool to rewrite, shorten, or formalize sentences.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=wordtune.com&sz=128', url: 'https://www.wordtune.com', users: 1, usersLabel: '1M+', pricing: 'Freemium', rating: 4.2, verified: true },
  { id: 56, name: 'Elicit', description: 'AI research assistant that finds and summarizes scientific papers.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=elicit.org&sz=128', url: 'https://elicit.org', users: 0.1, usersLabel: '100K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 57, name: 'Gamma', description: 'AI presentation maker — create beautiful slides from any prompt.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=gamma.app&sz=128', url: 'https://gamma.app', users: 10, usersLabel: '10M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 58, name: 'Character.AI', description: 'Chat with AI characters — celebs, fictional heroes, and custom bots.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=character.ai&sz=128', url: 'https://character.ai', users: 20, usersLabel: '20M+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 59, name: 'Poe', description: 'Chat with GPT-4, Claude, Gemini, and 50+ AI models in one app.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=poe.com&sz=128', url: 'https://poe.com', users: 4, usersLabel: '4M+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 60, name: 'Mistral AI', description: 'European open-source AI models — strong reasoning and multilingual.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=mistral.ai&sz=128', url: 'https://chat.mistral.ai', users: 2, usersLabel: '2M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 61, name: 'You.com', description: 'AI search engine with chat, coding, image generation in one place.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=you.com&sz=128', url: 'https://you.com', users: 3, usersLabel: '3M+', pricing: 'Freemium', rating: 4.2, verified: true },
  { id: 62, name: 'ChatPDF', description: 'AI tool that lets you chat with any PDF — extract insights instantly.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=chatpdf.com&sz=128', url: 'https://chatpdf.com', users: 2, usersLabel: '2M+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 63, name: 'Make.com', description: 'Visual automation platform that connects 1500+ apps with AI.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=make.com&sz=128', url: 'https://make.com', users: 0.7, usersLabel: '700K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 64, name: 'Zapier AI', description: 'AI-powered workflow automation connecting 5000+ apps.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=zapier.com&sz=128', url: 'https://zapier.com', users: 2, usersLabel: '2M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 65, name: 'n8n', description: 'Open-source workflow automation with AI nodes — self-hostable.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=n8n.io&sz=128', url: 'https://n8n.io', users: 0.3, usersLabel: '300K+', pricing: 'Free', rating: 4.6, verified: true },
  { id: 66, name: 'Bardeen', description: 'AI automation that runs in your browser to handle repetitive tasks.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=bardeen.ai&sz=128', url: 'https://bardeen.ai', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.3, verified: true },
  { id: 67, name: 'AutoGPT', description: 'Autonomous AI agent that breaks goals into tasks and executes them.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=autogpt.net&sz=128', url: 'https://autogpt.net', users: 0.4, usersLabel: '400K+', pricing: 'Free', rating: 4.1, verified: true },
  { id: 68, name: 'CrewAI', description: 'Multi-agent framework for orchestrating teams of AI workers.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=crewai.com&sz=128', url: 'https://crewai.com', users: 0.2, usersLabel: '200K+', pricing: 'Free', rating: 4.4, verified: true },
  { id: 69, name: 'AgentGPT', description: 'Build and deploy autonomous AI agents directly in your browser.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=agentgpt.reworkd.ai&sz=128', url: 'https://agentgpt.reworkd.ai', users: 0.1, usersLabel: '100K+', pricing: 'Freemium', rating: 4.0, verified: true },
  { id: 70, name: 'OpenRouter', description: 'Unified API for accessing 100+ AI models from one endpoint.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=openrouter.ai&sz=128', url: 'https://openrouter.ai', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 71, name: 'Groq', description: 'Ultra-fast AI inference — run Llama and Mistral at blazing speed.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=groq.com&sz=128', url: 'https://groq.com', users: 0.5, usersLabel: '500K+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 72, name: 'Replicate', description: 'Run open-source AI models via a simple API — images, video, audio.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=replicate.com&sz=128', url: 'https://replicate.com', users: 0.4, usersLabel: '400K+', pricing: 'Paid', rating: 4.5, verified: true },
  { id: 73, name: 'Pinecone', description: 'Managed vector database for building semantic search and RAG apps.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=pinecone.io&sz=128', url: 'https://pinecone.io', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 74, name: 'LangChain', description: 'Python/JS framework for building LLM-powered apps and agents.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=langchain.com&sz=128', url: 'https://langchain.com', users: 0.5, usersLabel: '500K+', pricing: 'Free', rating: 4.4, verified: true },
  { id: 75, name: 'Dify', description: 'LLM app development platform with visual workflow builder and RAG.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=dify.ai&sz=128', url: 'https://dify.ai', users: 0.3, usersLabel: '300K+', pricing: 'Freemium', rating: 4.4, verified: true },
  { id: 76, name: 'Lovable.dev', description: 'AI full-stack web builder that generates production web apps from text.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=lovable.dev&sz=128', url: 'https://lovable.dev', users: 0.8, usersLabel: '800K+', pricing: 'Freemium', rating: 4.8, verified: true },
  { id: 77, name: 'Trae AI', description: 'Adaptive AI-native IDE with deep codebase context and intelligent agents.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=trae.ai&sz=128', url: 'https://trae.ai', users: 0.4, usersLabel: '400K+', pricing: 'Free', rating: 4.7, verified: true },
  { id: 78, name: 'Augment Code', description: 'Enterprise AI code completion for massive codebases.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=augmentcode.com&sz=128', url: 'https://augmentcode.com', users: 0.2, usersLabel: '200K+', pricing: 'Paid', rating: 4.6, verified: true },
  { id: 79, name: 'Warp Terminal', description: 'AI-powered terminal for developers with natural language commands.', category: 'code', icon: 'https://www.google.com/s2/favicons?domain=warp.dev&sz=128', url: 'https://warp.dev', users: 1.2, usersLabel: '1.2M+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 80, name: 'Superhuman AI', description: 'AI email client that drafts responses and summarizes long threads instantly.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=superhuman.com&sz=128', url: 'https://superhuman.com', users: 0.5, usersLabel: '500K+', pricing: 'Paid', rating: 4.8, verified: true },
  { id: 81, name: 'Raycast AI', description: 'AI launcher for macOS — ask AI, complete text, and trigger scripts.', category: 'automation', icon: 'https://www.google.com/s2/favicons?domain=raycast.com&sz=128', url: 'https://raycast.com', users: 0.9, usersLabel: '900K+', pricing: 'Freemium', rating: 4.9, verified: true },
  { id: 82, name: 'Granola', description: 'The AI notepad for meetings — transcribes and extracts structured notes, context, and key action items.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=granola.ai&sz=128', url: 'https://go.granola.ai/ai-tools-hub', affiliateUrl: 'https://go.granola.ai/ai-tools-hub', users: 0.3, usersLabel: '300K+', featured: true, pricing: 'Freemium', startingPrice: '$10/mo', rating: 4.8, verified: true, bestFor: 'frictionless meeting notes, summarization, and action items', dealBadge: '1 Month 100% Free', dealPerk: 'Exclusive Partner Perk: New users get 100% off their first month free through our official link!', dealExpiry: 'Verified Active Today', tags: ['#meetings', '#notes', '#transcription', '#productivity'] },
  { id: 'wispr-flow', name: 'Wispr Flow', description: 'Next-gen voice AI and meeting notetaker — dictate 3x faster and automatically convert speech into formatted text with full Granola plan buyout.', category: 'voice', icon: 'https://www.google.com/s2/favicons?domain=wisprflow.ai&sz=128', url: 'https://ref.wisprflow.ai/ai-tools-hub', affiliateUrl: 'https://ref.wisprflow.ai/ai-tools-hub-granola', users: 0.4, usersLabel: '400K+', featured: true, pricing: 'Freemium', startingPrice: 'Free Tier / $15/mo', rating: 4.9, verified: true, bestFor: 'ultra-fast voice dictation, meeting notetaking, and Granola switch buyout', dealBadge: 'Granola Buyout · 12 Mo Free', dealPerk: 'Exclusive Buyout Perk: Switch from Granola to Wispr Flow — they cover your remaining Granola plan plus 3 bonus months free (up to 12 months free)!', dealExpiry: 'Verified Active Today', tags: ['#dictation', '#voice', '#notetaker', '#transcription', '#productivity'] },
  { id: 'framer', name: 'Framer', description: 'Design and ship responsive, interactive websites with AI assistance, built-in CMS, and production hosting.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=framer.com&sz=128', url: 'https://framer.link/aitoolshubi', affiliateUrl: 'https://framer.link/aitoolshubi', users: 1.5, usersLabel: '1.5M+', featured: true, pricing: 'Freemium', startingPrice: '$15/mo', rating: 4.9, verified: true, bestFor: 'interactive website design, animations & zero-code publishing', dealBadge: 'Official Partner Link', dealPerk: 'Official Partner Link: Start building for free with AI visual canvas, designer templates, and zero-code publishing.', dealExpiry: 'Verified Active Today', tags: ['#website', '#nocode', '#design', '#builder'] },
  { id: 83, name: 'Read.ai', description: 'AI summaries, action items, and metrics for Zoom, Teams, and Google Meet.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=read.ai&sz=128', url: 'https://read.ai', users: 2.5, usersLabel: '2.5M+', pricing: 'Freemium', rating: 4.5, verified: true },
  { id: 84, name: 'Fireflies.ai', description: 'AI meeting assistant that transcribes, summarizes, and analyzes calls.', category: 'text', icon: 'https://www.google.com/s2/favicons?domain=fireflies.ai&sz=128', url: 'https://fireflies.ai', users: 2, usersLabel: '2M+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 85, name: 'Recraft', description: 'AI graphic design generator for vector illustrations, 3D assets, and icons.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=recraft.ai&sz=128', url: 'https://recraft.ai', users: 0.6, usersLabel: '600K+', pricing: 'Freemium', rating: 4.7, verified: true },
  { id: 86, name: 'Hailuo AI', description: 'Next-gen video generation engine by MiniMax creating hyper-realistic clips.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=hailuoai.com&sz=128', url: 'https://hailuoai.com', users: 0.7, usersLabel: '700K+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 87, name: 'Cartesia', description: 'Ultra-low latency AI voice engine built for real-time conversational agents.', category: 'voice', icon: 'https://www.google.com/s2/favicons?domain=cartesia.ai&sz=128', url: 'https://cartesia.ai', users: 0.1, usersLabel: '100K+', pricing: 'Freemium', rating: 4.6, verified: true },
  { id: 88, name: 'Fish Speech', description: 'Zero-shot voice cloning and speech synthesis open-source engine.', category: 'voice', icon: 'https://www.google.com/s2/favicons?domain=fish.audio&sz=128', url: 'https://fish.audio', users: 0.2, usersLabel: '200K+', pricing: 'Free', rating: 4.5, verified: true },
  { id: 89, name: 'Tavus', description: 'Generative AI video interface API — create interactive conversational video avatars.', category: 'video', icon: 'https://www.google.com/s2/favicons?domain=tavus.io&sz=128', url: 'https://tavus.io', users: 0.15, usersLabel: '150K+', pricing: 'Paid', rating: 4.5, verified: true },
  { id: 90, name: 'SeaArt AI', description: 'Feature-rich AI art creator with flux models, upscaling, and controlnet.', category: 'image', icon: 'https://www.google.com/s2/favicons?domain=seaart.ai&sz=128', url: 'https://seaart.ai', users: 1.8, usersLabel: '1.8M+', pricing: 'Freemium', rating: 4.4, verified: true },
];

export const USERS_DATA: Record<string, { users: number; usersLabel: string }> = {
  'ChatGPT': { users: 180, usersLabel: '180M+' },
  'Canva': { users: 170, usersLabel: '170M+' },
  'Google Gemini': { users: 90, usersLabel: '90M+' },
  'Microsoft Copilot': { users: 77, usersLabel: '77M+' },
  'GitHub Copilot': { users: 50, usersLabel: '50M+' },
  'QuillBot': { users: 35, usersLabel: '35M+' },
  'Grammarly': { users: 30, usersLabel: '30M+' },
  'Notion AI': { users: 30, usersLabel: '30M+' },
  'Remove.bg': { users: 30, usersLabel: '30M+' },
  'Replit Ghostwriter': { users: 23, usersLabel: '23M+' },
  'Character.AI': { users: 20, usersLabel: '20M+' },
  'Claude': { users: 18, usersLabel: '18M+' },
  'Midjourney': { users: 16, usersLabel: '16M+' },
  'Perplexity': { users: 15, usersLabel: '15M+' },
  'Suno AI': { users: 12, usersLabel: '12M+' },
  'Adobe Firefly': { users: 12, usersLabel: '12M+' },
  'Gamma': { users: 10, usersLabel: '10M+' },
  'Copy.ai': { users: 10, usersLabel: '10M+' },
  'Stable Diffusion': { users: 10, usersLabel: '10M+' },
  'Hugging Face': { users: 5, usersLabel: '5M+' },
  'NotebookLM': { users: 5, usersLabel: '5M+' },
  'Cursor': { users: 4, usersLabel: '4M+' },
  'Poe': { users: 4, usersLabel: '4M+' },
  'Bing Image Creator': { users: 4, usersLabel: '4M+' },
  'Leonardo AI': { users: 4, usersLabel: '4M+' },
  'ElevenLabs': { users: 3, usersLabel: '3M+' },
  'Runway ML': { users: 3, usersLabel: '3M+' },
  'You.com': { users: 3, usersLabel: '3M+' },
  'DALL-E': { users: 3, usersLabel: '3M+' },
  'Writesonic': { users: 3, usersLabel: '3M+' },
  'Civitai': { users: 3, usersLabel: '3M+' },
  'ChatPDF': { users: 2, usersLabel: '2M+' },
  'Mistral AI': { users: 2, usersLabel: '2M+' },
  'Zapier AI': { users: 2, usersLabel: '2M+' },
  'Bolt.new': { users: 1.5, usersLabel: '1.5M+' },
  'Kling AI': { users: 1, usersLabel: '1M+' },
  'Ideogram': { users: 1, usersLabel: '1M+' },
  'Jasper': { users: 1, usersLabel: '1M+' },
  'Pi': { users: 1, usersLabel: '1M+' },
  'Rytr': { users: 1, usersLabel: '1M+' },
  'Tabnine': { users: 1, usersLabel: '1M+' },
  'Wordtune': { users: 1, usersLabel: '1M+' },
  'DeepSeek Coder': { users: 8, usersLabel: '8M+' },
  'Figma': { users: 8, usersLabel: '8M+' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  code: 'Coding & Dev',
  image: 'Design & Image',
  video: 'Video & Audio',
  text: 'Writing & Research',
  automation: 'Automation & Agents',
  voice: 'Voice & Speech',
};

export const STATS_TOP_TOOLS = FALLBACK_TOOLS
  .sort((a, b) => b.users - a.users)
  .slice(0, 15);
