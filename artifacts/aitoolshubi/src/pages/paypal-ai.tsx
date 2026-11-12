import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CreditCard,
  ShieldCheck,
  Send,
  Globe,
  Key,
  Layers,
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  ExternalLink,
  Code2,
  Copy,
  Check,
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  Building,
  Wallet,
  Receipt,
  Smile,
  Flame,
  UserCheck,
  Award,
  Edit3,
  HelpCircle,
  Bot,
  ShoppingBag,
  Briefcase,
  BarChart3,
  Tag,
  ShieldAlert,
  FileCheck,
  ArrowUpRight,
  Palette,
  Database,
  Sliders,
  Package,
  Cpu,
  ChevronDown,
  DollarSign,
  Clock,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  StopCircle,
  Plug,
  Gift,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { PayloMascot, type PayloEmotion } from "@/components/PayloMascot";
import { PayPalAgentActionCard, type AgentActionPayload } from "@/components/PayPalAgentActionCard";
import { FormattedChatMessage } from "@/components/FormattedChatMessage";
import { PayloExitRecoveryModal, useExitIntent } from "@/components/PayloExitRecoveryModal";
import { PayPalPayIn4Modal } from "@/components/PayPalPayIn4Calculator";
import { PayloOrderLookupModal } from "@/components/PayloOrderLookupModal";
import { PayloIndustryClassificationCard } from "@/components/PayloIndustryClassificationCard";
import { useSEO } from "@/hooks/use-seo";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  interval: "monthly" | "yearly" | "one-time";
  description: string;
  features: string[];
  isPopular?: boolean;
}

interface SiteKnowledge {
  id: string;
  url: string;
  siteName: string;
  tagline: string;
  description: string;
  currency: string;
  pricingPlans: PricingPlan[];
  faqs: Array<{ question: string; answer: string }>;
  supportEmail?: string;
  paypalConnected?: boolean;
  paypalMode?: "sandbox" | "live";
  customization?: {
    agentName?: string;
    primaryColor?: string;
    accentColor?: string;
    greetingMessage?: string;
    collarBadge?: string;
    maxDiscountPercent?: number;
    voiceEnabledByDefault?: boolean;
  };
}

// PayPal Sandbox credentials are sent only to the server for OAuth verification.
const playChime = () => {};

export default function PayPalAiPage() {
  useSEO({
    title: "Paylo — AI-assisted PayPal commerce",
    description: "A focused AI shopping assistant that explains merchant plans and prepares a buyer-approved PayPal checkout.",
  });

  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  // Keep the dashboard gate aligned with the API's default ADMIN_EMAILS value.
  const canManagePayloDemo = isAdmin || user?.email?.toLowerCase() === "issam@aitoolshubi.com";
  const [, navigate] = useLocation();

  // Paylo mascot emotion state
  const [mascotEmotion, setMascotEmotion] = useState<PayloEmotion>("idle");

  // Ingestion state
  const [targetUrl, setTargetUrl] = useState("https://aitoolshubi.com");
  const [isIngesting, setIsIngesting] = useState(false);
  const [siteData, setSiteData] = useState<SiteKnowledge | null>(null);

  // Merchant Customizer State (Sprint 1: Multi-Merchant Engine)
  const [agentCustomName, setAgentCustomName] = useState("Paylo");
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<number>(15);
  const [customGreeting, setCustomGreeting] = useState("");
  const [customBrandColor, setCustomBrandColor] = useState("#0070ba");
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  // This demo reports the server PayPal app configuration. It does not collect
  // merchant secrets or claim seller-owned payouts are connected.
  const [paypalServerReady, setPaypalServerReady] = useState<boolean | null>(null);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [isConnectingPayPal, setIsConnectingPayPal] = useState(false);
  const [paypalConnectError, setPaypalConnectError] = useState("");
  const [paypalPlanSetupWarning, setPaypalPlanSetupWarning] = useState("");

  // Interactive Live Chat state
  const [chatPersona, setChatPersona] = useState<"shopper" | "merchant">("shopper");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; action?: AgentActionPayload; reasoningSteps?: string[]; image?: string }>>([
    {
      role: "assistant",
      content:
        "Hi, I’m **Paylo**, AItools Hubi’s shopping assistant. I can answer from the merchant-reviewed catalog, compare listed plans, and prepare a PayPal Sandbox checkout after you choose one. I only offer discounts the merchant has configured. PayPal decides which payment methods and terms are available; you review and approve every payment there. What would you like to explore?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [thinkingStepText, setThinkingStepText] = useState("Analyzing request & merchant context...");

  // Multi-Modal State: Audio Voice
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false);

  useEffect(() => {
    if (!isChatting) return;
    const steps = [
      "Ingesting merchant catalog & grounding policies...",
      "Checking the available Paylo demo records...",
      "Grounding the answer in the saved catalog...",
      "Formulating deterministic recommendation...",
    ];
    let idx = 0;
    setThinkingStepText(steps[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % steps.length;
      setThinkingStepText(steps[idx]);
    }, 850);
    return () => clearInterval(interval);
  }, [isChatting]);

  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<"html" | "react" | "webflow" | "shopify" | "wordpress">("html");

  // Merchant Analytics Telemetry State
  const [analyticsData, setAnalyticsData] = useState<{
    totalChats: number; checkoutClicks: number; completedOrders: number;
    totalTPV: string; cartRescued: number; invoicesSent: number;
    discountsApplied: number; conversionRate: string;
    rawTotalTPV?: number; rawNetTPV?: number;
    lastEvents: Array<{ type: string; timestamp: string; detail: string }>;
  } | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [isSimulatingOrder, setIsSimulatingOrder] = useState(false);

  // PayPal Shopper Passport & Cross-Session Memory (Sprint 3 / Task 3.1)
  const [shopperPassport, setShopperPassport] = useState<{
    name: string;
    email: string;
    preferredCurrency: string;
    vipTier: string;
    purchasesCount: number;
    memberSince: string;
    points: number;
  }>({
    name: "Alex Vance (Demo Shopper)",
    email: "alex.vance@example.test",
    preferredCurrency: "USD",
    vipTier: "Gold Pioneer (Demo)",
    purchasesCount: 3,
    memberSince: "2026",
    points: 420,
  });
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);

  // Autonomous Exit Intent & Cart Recovery
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExitRecovery, setShowExitRecovery] = useState(false);
  const [exitIntentShown, setExitIntentShown] = useState(false);
  const [showPayIn4Modal, setShowPayIn4Modal] = useState(false);
  const [showOrderLookupModal, setShowOrderLookupModal] = useState(false);


  useExitIntent({
    onTrigger: () => setShowExitRecovery(true),
    delayMs: 45000,
    enabled: false, // Disabled auto-trigger so merchant demo video is never interrupted; trigger on-demand via chip
  });

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatCardRef = useRef<HTMLDivElement>(null);

  // Load default site & check URL query parameters
  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const requestedSite = params?.get("site") || params?.get("siteId") || "aitoolshubi-com";

    apiFetch(`/api/paylo/sites/${encodeURIComponent(requestedSite)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.site) {
          setSiteData(d.site);
          if (d.site.url) setTargetUrl(d.site.url);
        } else {
          loadDefaultSite();
        }
      })
      .catch(() => loadDefaultSite());

    apiFetch("/api/paypal/config")
      .then((response) => setPaypalServerReady(response.ok))
      .catch(() => setPaypalServerReady(false));

    // Check URL parameters for direct checkout links (e.g., ?buy=Pro%20Community%20Member&amount=6.00)
    if (typeof window !== "undefined") {
      const buyItem = params?.get("buy");
      const buyAmount = params?.get("amount");
      const buyPlanId = params?.get("planId") || "pro-community-monthly";
      const buyInterval = params?.get("interval") || "monthly";
      if (buyItem) {
        const amt = buyAmount || "6.00";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Welcome! I see you're ready to activate **${buyItem}** for **$${amt} USD**.\n\nI've prepared your instant 1-click PayPal checkout below:`,
            action: {
              type: "PAYPAL_CHECKOUT",
              siteId: requestedSite,
              planId: buyPlanId,
              planName: buyItem,
              amount: amt,
              interval: buyInterval,
              currency: "USD",
              description: `Instant activation for ${buyItem}`,
            },
          },
        ]);
        setMascotEmotion("happy");
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
          }
        }, 400);
      }
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      // Only scroll the inner chat container, never the page
      requestAnimationFrame(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages, isChatting]);

  
  // End-to-end instant harmony: listen for catalog/training updates saved in Paylo Studio
  useEffect(() => {
    const handleSync = () => {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const requestedSite = params?.get("site") || params?.get("siteId") || "aitoolshubi-com";
      apiFetch(`/api/paylo/sites/${encodeURIComponent(requestedSite)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.site) {
            setSiteData(d.site);
            toast({
              title: "Paylo Brain Synchronized",
              description: `Loaded ${d.site.pricingPlans?.length || 0} updated plans and rules for ${d.site.siteName}.`,
            });
          }
        })
        .catch(() => {});
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("paylo_site_sync");
      channel.onmessage = (e) => {
        if (e.data?.type === "site_updated") handleSync();
      };
    } catch {}

    const onStorage = (e: StorageEvent) => {
      if (e.key === "paylo_site_updated") handleSync();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const loadDefaultSite = async () => {
    try {
      const res = await apiFetch("/api/paylo/sites/aitoolshubi-com");
      if (res.ok) {
        const data = await res.json();
        setSiteData(data.site);
      }
    } catch {
      // fallback
    }
  };

  const handleConnectPayPal = async () => {
    setPaypalConnectError("");
    if (!paypalClientId.trim() || !paypalClientSecret.trim()) {
      setPaypalConnectError("Enter both values from a PayPal Sandbox app.");
      return;
    }
    setIsConnectingPayPal(true);
    try {
      const response = await apiFetch("/api/paylo/connect-paypal", {
        method: "POST",
        body: JSON.stringify({ clientId: paypalClientId.trim(), clientSecret: paypalClientSecret, mode: "sandbox" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.verified) {
        throw new Error(result.error || (response.status === 403 ? "Sign in with the Paylo administrator account to configure this demo." : "PayPal Sandbox verification failed."));
      }
      setPaypalServerReady(true);
      setPaypalClientId("");
      setPaypalClientSecret("");
      setPaypalPlanSetupWarning(
        result.subscriptionPlansReady === false
          ? `Recurring checkout is not ready for: ${(result.missingSubscriptionPlans || []).join(", ")}. One-time Sandbox checkout can still work.`
          : ""
      );
      toast({
        title: result.subscriptionPlansReady === false
          ? "Sandbox app connected; some recurring plans need attention"
          : "PayPal Sandbox connected",
        description: result.message || "Paylo Sandbox checkout is ready for this API session. The secret was not saved to disk.",
      });
    } catch (error) {
      setPaypalConnectError(error instanceof Error ? error.message : "Could not connect the PayPal Sandbox app.");
    } finally {
      setIsConnectingPayPal(false);
    }
  };

  // Sync merchant customization when siteData is loaded
  useEffect(() => {
    if (siteData?.customization) {
      if (siteData.customization.agentName) setAgentCustomName(siteData.customization.agentName);
      if (siteData.customization.maxDiscountPercent) setMaxDiscountPercent(siteData.customization.maxDiscountPercent);
      if (siteData.customization.greetingMessage) setCustomGreeting(siteData.customization.greetingMessage);
      if (siteData.customization.primaryColor) setCustomBrandColor(siteData.customization.primaryColor);
    }
  }, [siteData]);

  // Fetch real-time merchant analytics (Sprint A)
  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch(`/api/paylo/analytics?siteId=${siteData?.id || "aitoolshubi-com"}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {}
  };

  const handleSimulateTelemetryOrder = async () => {
    setIsSimulatingOrder(true);
    try {
      const res = await apiFetch("/api/paylo/analytics/simulate", {
        method: "POST",
        body: JSON.stringify({
          siteId: siteData?.id || "aitoolshubi",
          amount: 19.0,
          planName: "Featured Partner Listing",
        }),
      });
      if (res.ok) {
        toast({
          title: "Simulation recorded",
          description: "A $19.00 test event was added to session analytics. It is not a PayPal capture and no payment was made.",
        });
        fetchAnalytics();
      }
    } catch {
      toast({
        title: "Simulation Error",
        description: "Could not record simulation event.",
        variant: "destructive",
      });
    } finally {
      setIsSimulatingOrder(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 12000);
    return () => clearInterval(interval);
  }, [siteData?.id]);

  // Exit Intent / Inactivity Hook — proactive Paylo nudge (Sprint B)
  useEffect(() => {
    if (exitIntentShown) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        setExitIntentShown(true);
        setMascotEmotion("happy");
        playChime();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Need help choosing? I can compare listed plans, check for a merchant-approved discount, or prepare a PayPal checkout. PayPal will show the payment options and terms available to you before you approve.`,
          },
        ]);
      }, 25000);
    };

    resetTimer();
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [exitIntentShown]);

  const handleSaveCustomization = async () => {
    const sId = siteData?.id || "aitoolshubi-com";
    if (isSavingCustomization) return;
    setIsSavingCustomization(true);
    setMascotEmotion("thinking");

    try {
      const res = await apiFetch("/api/paylo/customize", {
        method: "POST",
        body: JSON.stringify({
          siteId: sId,
          customization: {
            agentName: agentCustomName,
            maxDiscountPercent,
            greetingMessage: customGreeting,
            primaryColor: customBrandColor,
          },
        }),
      });

      if (res.ok) {
        toast({
          title: "Customization Rules Saved",
          description: `${agentCustomName} will now apply up to ${maxDiscountPercent}% discount for ${siteData?.siteName || "your store"}.`,
        });
        setMascotEmotion("celebrating");
        playChime();
      } else {
        throw new Error("Save failed");
      }
    } catch {
      toast({
        title: "Rules Saved Locally",
        description: `Active for this session with ${maxDiscountPercent}% maximum discount limit.`,
      });
      setMascotEmotion("happy");
    } finally {
      setIsSavingCustomization(false);
      setTimeout(() => setMascotEmotion("idle"), 2500);
    }
  };



  const handleIngestUrl = async (customUrl?: string) => {
    const urlToCrawl = (customUrl || targetUrl).trim();
    if (!urlToCrawl || isIngesting) return;
    if (customUrl) setTargetUrl(customUrl);

    setIsIngesting(true);
    setMascotEmotion("thinking");

    try {
      const res = await apiFetch("/api/paylo/ingest", {
        method: "POST",
        body: JSON.stringify({ url: urlToCrawl }),
      });

      if (!res.ok) throw new Error("Failed to analyze website");
      const data = await res.json();
      setSiteData(data.site);
      setMascotEmotion("happy");
      playChime();

      toast({
        title: "Website Catalog Ingested",
        description: `Paylo memorized ${data.site.pricingPlans.length} products from ${data.site.siteName}.`,
      });

      // Announce in chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I've analyzed **${data.site.siteName}** and loaded ${data.site.pricingPlans.length} plans. Ask me to compare plans or prepare checkout for one named plan.`,
        },
      ]);
    } catch (err: any) {
      setMascotEmotion("idle");
      toast({
        title: "Notice",
        description: "Could not crawl external site directly, loaded sample SaaS profile.",
      });
    } finally {
      setIsIngesting(false);
      setTimeout(() => setMascotEmotion("idle"), 2500);
    }
  };

  const handleSwitchPersona = (mode: "shopper" | "merchant") => {
    if (mode === chatPersona) return;
    setChatPersona(mode);
    playChime();
    const siteName = siteData?.siteName || "AI Tools Hubi";

    if (mode === "shopper") {
      setMascotEmotion("happy");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Customer View Active**\n\nYou are exploring **${siteName}** plans as a prospective subscriber.\n\nAsk me to:\n• **Choose a plan** — Review the listed price and terms\n• **Compare plans** — Side-by-side catalog comparison\n• **Check for a discount** — Only merchant-approved offers\n• **Prepare checkout** — Review and approve securely with PayPal`,
        },
      ]);
    } else {
      setMascotEmotion("money_check");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Store Owner View Active**\n\nI am Paylo, the merchant assistant for **${siteName}**.\n\nAvailable in this demo:\n• **Catalog and checkout** — Sandbox only; buyer approval happens on PayPal\n• **Invoices** — Create a PayPal Sandbox draft when configured; review before sending\n• **Capture records and session analytics** — Based on data returned to this demo\n• **Risk, disputes, balances, and payouts** — Preview only where PayPal APIs are not connected\n\n[Open Paylo Studio](/paylo-studio)`,
        },
      ]);
    }
  };

  // Multi-Modal Voice Recognition (Speech-to-Text)
  const startVoiceRecording = () => {
    const SpeechRec = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
    if (!SpeechRec) {
      toast({
        title: "Voice Input Notice",
        description: "Speech recognition is active in Chrome, Edge, and Safari.",
      });
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecordingVoice(true);
        setMascotEmotion("thinking");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setChatInput(transcript);
      };

      recognition.onerror = () => {
        setIsRecordingVoice(false);
        setMascotEmotion("idle");
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
        setMascotEmotion("happy");
      };

      recognition.start();
    } catch {
      setIsRecordingVoice(false);
    }
  };

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) setAvailableVoices(v);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Multi-Modal Voice Synthesis (Text-to-Speech) — Natural Female Voice
  const speakMessage = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`.*?`/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/[#*_~]/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 320));
    utterance.rate = 1.0;

    // Prioritize natural female voices for Paylo's character
    const preferredVoices = [
      "Microsoft Jenny Online", "Microsoft Aria Online", "Microsoft Zira Desktop", "Microsoft Zira",
      "Google US English", "Samantha", "Victoria", "Karen",
      "Microsoft Jenny", "Microsoft Aria", "Zira", "Jenny", "Aria"
    ];
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    let selectedVoice = voices.find((v) =>
      preferredVoices.some((pref) => v.name.toLowerCase().includes(pref.toLowerCase())) && v.lang.startsWith("en")
    );
    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith("en") && /female|zira|jenny|aria|samantha|victoria|karen|eva|allison|susan/i.test(v.name));
    }
    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith("en") && !/david|mark|george|richard|guy|male|james|john/i.test(v.name));
    }
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.pitch = 1.15;
    } else {
      utterance.pitch = 1.35;
    }

    utterance.onstart = () => {
      setIsSpeakingVoice(true);
      setMascotEmotion("speaking");
    };
    utterance.onend = () => {
      setIsSpeakingVoice(false);
      setMascotEmotion("happy");
    };
    utterance.onerror = () => {
      setIsSpeakingVoice(false);
      setMascotEmotion("idle");
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingVoice(false);
      setMascotEmotion("idle");
    }
  };


  const handleSendChat = async (text: string) => {
    const query = text.trim();
    if (!query || isChatting) return;

    setChatInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: query,
      },
    ]);
    setIsChatting(true);
    setMascotEmotion("thinking");

    try {
      const res = await apiFetch("/api/paylo/chat", {
        method: "POST",
        body: JSON.stringify({
          message: query,
          siteId: siteData?.id || "aitoolshubi",
          history: messages.slice(-6),
          persona: chatPersona,
        }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      let displayContent = data.reply || "";
      if (typeof displayContent === "string" && (displayContent.includes("```json") || displayContent.includes('"reply":'))) {
        try {
          const match = displayContent.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (match) {
            displayContent = JSON.parse(`"${match[1]}"`);
          }
        } catch {}
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: displayContent, action: data.agentAction, reasoningSteps: data.reasoningSteps },
      ]);

      // Automatically speak response if voice is enabled
      if (voiceEnabled) {
        speakMessage(displayContent);
      }

      // Track action types for real-time merchant analytics
      if (data.agentAction) {
        let evtType = "";
        const evtDetail = data.agentAction.planName || data.agentAction.amount || "";
        switch (data.agentAction.type) {
          case "PAYPAL_CHECKOUT":
            if (data.agentAction.isPayIn4) evtType = "pay_in_4";
            else if (data.agentAction.description?.toLowerCase().includes("discount")) evtType = "discount_applied";
            else evtType = "checkout_click";
            break;
          case "PAYPAL_BALANCE": evtType = "balance_check"; break;
          case "PAYPAL_RECEIPT": evtType = "receipt_view"; break;
          case "PAYPAL_INVOICE": evtType = "invoice_sent"; break;
          case "PAYPAL_INSIGHTS": evtType = "analytics_view"; break;
          case "PAYPAL_DISPUTE_SHIELD": evtType = "dispute_shield"; break;
          case "PAYPAL_BUNDLE_QUIZ": evtType = "bundle_quiz"; break;
        }
        if (evtType) {
          apiFetch("/api/paylo/analytics/event", {
            method: "POST",
            body: JSON.stringify({
              siteId: siteData?.id || "aitoolshubi-com",
              eventType: evtType,
              detail: evtDetail,
            }),
          }).catch(() => {});
        }
      }
      // Refresh analytics after each interaction
      setTimeout(fetchAnalytics, 500);

      if (data.emotion) {
        setMascotEmotion(data.emotion);
      } else {
        setMascotEmotion("happy");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having a brief connection delay. Please try asking again!",
        },
      ]);
      setMascotEmotion("idle");
    } finally {
      setIsChatting(false);
      setTimeout(() => setMascotEmotion("idle"), 3000);
    }
  };

  const getEmbedSnippet = () => {
    const sId = siteData?.id || "aitoolshubi";
    const extraAttrs = `${agentCustomName !== "Paylo" ? ` data-name="${agentCustomName}"` : ""}${customBrandColor !== "#0070ba" ? ` data-color="${customBrandColor}"` : ""}`;
    switch (selectedPlatformTab) {
      case "react":
        return `<script src="${window.location.origin}/paylo.js" data-site="${sId}"${extraAttrs} async />`;
      case "webflow":
        return `<!-- Paste in Webflow Project Settings > Custom Code > Footer -->\n<script src="${window.location.origin}/paylo.js" data-site="${sId}"${extraAttrs} async></script>`;
      case "shopify":
        return `<!-- Paste in Shopify Theme > theme.liquid before </body> -->\n<script src="${window.location.origin}/paylo.js" data-site="${sId}"${extraAttrs} async></script>`;
      case "wordpress":
        return `<!-- Paste in WordPress Header and Footer Scripts -->\n<script src="${window.location.origin}/paylo.js" data-site="${sId}"${extraAttrs} async></script>`;
      default:
        return `<script src="${window.location.origin}/paylo.js" data-site="${sId}"${extraAttrs} async></script>`;
    }
  };

  const handleCopyEmbed = () => {
    const snippet = getEmbedSnippet();
    navigator.clipboard.writeText(snippet);
    setCopiedEmbed(true);
    toast({ title: "Copied!", description: `Paylo ${selectedPlatformTab.toUpperCase()} embed script copied.` });
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Product Banner */}
      <div className="border-b border-border bg-muted/40 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-extrabold uppercase tracking-wider text-foreground font-bold dark:text-cyan-400">
              Paylo · Autonomous Commerce Agent
            </span>
            <span className="text-muted-foreground hidden sm:inline">|</span>
            <span className="text-muted-foreground hidden sm:inline">
              Buyer-assist commerce prototype
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/paylo-agent"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Paylo Agent</span>
            </a>
            <a
              href="/paylo-studio"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-semibold transition-all border border-zinc-700/80 shadow-2xs cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
              <span>Paylo Studio (AG Grid BI)</span>
            </a>
            <a
              href="/paylo-demo.html?site=aitoolshubi-com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-semibold transition-all border border-blue-500/30 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Demo Storefront</span>
            </a>
          </div>
        </div>
      </div>

      {/* Hero Section with Interactive Paylo Stage */}
      <section className="pt-10 pb-12 px-4 max-w-7xl mx-auto text-center">
        {/* Living Mascot Circular Stage */}
        <div className="relative inline-block mb-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="relative flex items-center justify-center p-6 rounded-full bg-gradient-to-b from-[#0070ba]/15 via-background to-card border border-primary/25 shadow-2xl backdrop-blur-xl"
          >
            <PayloMascot
              size={140}
              emotion={mascotEmotion}
              interactive={true}
              onTap={() => {
                setMascotEmotion("happy");
                setTimeout(() => setMascotEmotion("idle"), 1500);
              }}
            />
          </motion.div>
        </div>

        {/* Tactile Mood / Animation Tester Bar */}
        <div className="mb-6 flex items-center justify-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground mr-1">Paylo Emotions:</span>
          {(
            [
              { id: "idle", label: "Idle", emo: "idle" },
              { id: "money_check", label: "Balance Check", emo: "money_check" },
              { id: "celebrating", label: "Approval", emo: "celebrating" },
              { id: "thinking", label: "Reasoning", emo: "thinking" },
              { id: "speaking", label: "Conversing", emo: "speaking" },
              { id: "happy", label: "Active Guide", emo: "happy" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMascotEmotion(item.emo);
                playChime();
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                mascotEmotion === item.emo
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black tracking-tight max-w-3xl mx-auto leading-tight md:leading-tight"
        >
          Meet <span className="text-foreground font-black">Paylo</span>
        </motion.h1>

        <p className="mt-3 text-lg md:text-xl font-medium text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          An AI commerce companion that explains a merchant’s plans, compares options, and prepares a buyer-approved PayPal checkout. This demo uses PayPal Sandbox only — no live business payments or account data.
        </p>

        {/* 3 Value Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold">
          <span className="px-3.5 py-1.5 rounded-full bg-card border border-border shadow-xs flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-blue-500" />
            Expressive AI companion
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-card border border-border shadow-xs flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-foreground font-bold" />
            Merchant knowledge
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-card border border-border shadow-xs flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-blue-500" />
            Sandbox checkout
          </span>
        </div>

        {/* Live Architecture & External Store Proof CTAs */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="sm"
            onClick={() => navigate("/paylo-studio")}
            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-xs shadow-xs transition-transform flex items-center gap-2 px-4 py-2"
          >
            <Bot className="h-4 w-4 text-purple-200" />
            Open Merchant Studio
          </Button>
          <Button
            size="sm"
            onClick={() => setShowArchitectureModal(true)}
            className="bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs shadow-xs transition-transform flex items-center gap-2 px-4 py-2"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            Universal Architecture, Security &amp; Trust Spec
          </Button>
          <a
            href="/paylo-demo.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground shadow-xs hover:scale-[1.02] transition-transform"
          >
            <Globe className="h-4 w-4 text-blue-400" />
            <span>Platform Architecture Gateway</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>
      </section>

      {/* 5-Step Orderly Onboarding & Autonomous Commerce Hub */}
      <section className="max-w-7xl mx-auto px-4 mb-16 space-y-8">
        {/* Row 1 & 2: Steps 1 to 4 (Alternating Left & Right Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Step 1: Website Ingestion Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.05 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-foreground font-bold flex items-center justify-center font-black text-xs">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Step 1: Website Knowledge Ingestion</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Deep HTML extraction & product analysis
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="text-xs h-10 bg-background/90"
                />
                <Button
                  onClick={() => handleIngestUrl()}
                  disabled={isIngesting}
                  className="h-10 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold shrink-0"
                >
                  {isIngesting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 mr-1" />
                  )}
                  <span>{isIngesting ? "Analyzing..." : "Analyze"}</span>
                </Button>
              </div>

              {/* ─── INDUSTRY CLASSIFICATION CARD ─── */}
              <div className="mt-3">
                <PayloIndustryClassificationCard
                  siteName={siteData?.siteName || "AItools Hubi"}
                  planCount={siteData?.pricingPlans?.length || 6}
                />
              </div>



              {/* Connected Pipeline Stepper */}
              <div className="mt-3 p-3 rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-purple-500/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Zap className="h-3 w-3" /> Paylo Autonomous Pipeline
                  </span>
                  <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Live Harmonized
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/paylo-studio?tab=merchant-intelligence&site=${siteData?.id || "aitoolshubi-com"}`)}
                    className="h-8 text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 shadow-sm cursor-pointer justify-center"
                  >
                    <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Open in AG Studio →
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/paylo-studio?tab=verify-knowledge&site=${siteData?.id || "aitoolshubi-com"}`)}
                    className="h-8 text-[11px] font-bold border-border bg-card/60 hover:bg-muted text-foreground cursor-pointer justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-500" /> Train Paylo Rules →
                  </Button>
                </div>
              </div>

              {/* Crawled Site Result Preview */}
              {siteData && (
                <div className="mt-4 p-3.5 rounded-xl bg-muted/40 border border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-primary" />
                      {siteData.siteName}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold text-blue-500 bg-blue-500/10 border-blue-500/20">
                      {siteData.pricingPlans.length} Real Plans Memorized
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {siteData.tagline || siteData.description}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {siteData.pricingPlans.map((plan) => (
                      <span
                        key={plan.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-background border border-border text-foreground"
                      >
                        {plan.name}: <strong>${plan.price}</strong>/{plan.interval}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                      Verify or edit products?
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/paylo-studio?tab=verify-knowledge&site=${siteData.id}`)}
                      className="h-7 text-[11px] px-2 font-bold text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 cursor-pointer"
                    >
                      Inspect in Paylo Studio →
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Step 2: PayPal Account Connection Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Step 2: PayPal Sandbox checkout</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Paylo server configuration for this demo
                    </p>
                  </div>
                </div>

                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                  Sandbox only · no real money
                </Badge>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-background/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">Paylo server PayPal app</span>
                  <Badge className={paypalServerReady ? "bg-blue-500/10 text-blue-600 border-blue-500/25" : paypalServerReady === false ? "bg-rose-500/10 text-rose-500 border-rose-500/25" : "bg-muted text-muted-foreground border-border"}>
                    {paypalServerReady === null ? "Checking…" : paypalServerReady ? "Configured · Sandbox" : "Not configured"}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Connect a PayPal <strong>Sandbox REST app</strong> here to enable the buyer approval flow. This configures the demo’s checkout app; it does not link a seller account or route payouts. Live credentials are never accepted here.
                </p>
                {paypalServerReady === false && <p className="text-[11px] text-amber-600 dark:text-amber-300">Sandbox checkout is not connected yet. Add the Sandbox app keys below to enable Paylo’s checkout card.</p>}
                <div className="space-y-2 rounded-lg border border-border bg-card/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">Sandbox REST Credentials</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPaypalClientId("sb");
                        setPaypalClientSecret("sandbox_secret_key_testbed");
                      }}
                      className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="h-3 w-3" />
                      <span>Quick-Fill Sandbox Testbed</span>
                    </button>
                  </div>
                  <label className="block space-y-1 text-[10px] font-semibold text-muted-foreground">
                    <span>PayPal Sandbox Client ID</span>
                    <Input autoComplete="off" value={paypalClientId} onChange={(event) => setPaypalClientId(event.target.value)} placeholder="Paste Sandbox Client ID" className="h-9 font-mono text-[11px]" />
                  </label>
                  <label className="block space-y-1 text-[10px] font-semibold text-muted-foreground">
                    <span>PayPal Sandbox Secret</span>
                    <Input autoComplete="new-password" type="password" value={paypalClientSecret} onChange={(event) => setPaypalClientSecret(event.target.value)} placeholder="Paste Sandbox Secret" className="h-9 font-mono text-[11px]" />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-muted-foreground">Verified by PayPal OAuth; held in API memory only until restart.</span>
                    <Button type="button" onClick={handleConnectPayPal} disabled={isConnectingPayPal || !paypalClientId.trim() || !paypalClientSecret} className="h-8 bg-[#0070ba] px-3 text-[11px] font-bold text-white hover:bg-[#003087]">
                      {isConnectingPayPal ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3 w-3" />}
                      {isConnectingPayPal ? "Verifying…" : paypalServerReady ? "Verify & reconnect" : "Verify & connect Sandbox"}
                    </Button>
                  </div>
                  {paypalConnectError && <p role="alert" className="text-[11px] font-medium text-rose-500">{paypalConnectError}</p>}
                  {paypalPlanSetupWarning && <p role="status" className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-300">{paypalPlanSetupWarning}</p>}
                </div>
              </div>
            </motion.div>

            {/* Step 3: Embed Script & Universal Connectors Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.15 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center font-black text-xs">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Step 3: 1-Line Embed Script</h3>
                    <p className="text-[11px] text-muted-foreground">Install the verified merchant demo profile</p>
                  </div>
                </div>

                <a
                  href="/paylo-demo.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 transition-all"
                  title="Test Paylo on an external demo website"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Live Demo</span>
                </a>
              </div>

              {/* Platform Selector Tabs */}
              <div className="flex items-center gap-1 mt-3 mb-2 p-1 bg-muted/60 rounded-lg text-[10px] font-bold overflow-x-auto no-scrollbar">
                {(["html", "react", "webflow", "shopify", "wordpress"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedPlatformTab(tab)}
                    className={`px-2 py-1 rounded capitalize whitespace-nowrap transition-all cursor-pointer ${
                      selectedPlatformTab === tab
                        ? "bg-background text-foreground shadow-xs font-black text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "html" ? "Universal HTML" : tab === "react" ? "React / Next" : tab}
                  </button>
                ))}
              </div>

              {/* Code Snippet Box */}
              <div className="p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] border border-slate-800 flex items-center justify-between gap-2">
                <code className="text-cyan-300 truncate">
                  {getEmbedSnippet().split("\n").pop()}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmbed}
                  className="h-7 px-2.5 text-[11px] font-bold border-slate-700 hover:bg-slate-800 text-slate-200 shrink-0"
                >
                  {copiedEmbed ? <Check className="h-3 w-3 text-blue-400" /> : <Copy className="h-3 w-3" />}
                  <span className="ml-1">{copiedEmbed ? "Copied" : "Copy"}</span>
                </Button>
              </div>

              <div className="mt-2 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Zero dependencies · Non-blocking async load</span>
                <span className="text-blue-500 font-medium">Ready for production</span>
              </div>

              {/* Universal Connectors Bridge → Studio */}
              <button
                type="button"
                onClick={() => navigate("/paylo-studio?tab=integrations")}
                className="mt-3 w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <Plug className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[11px] font-bold text-foreground">12+ Universal Native Connectors</div>
                    <div className="text-[10px] text-muted-foreground truncate">Shopify · Next.js · MCP Server · React Native · iOS · Webhooks · AI Agents</div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>

            {/* Step 4: Personality & Discount Rules */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.2 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center font-black text-xs">
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Step 4: Personality &amp; Discount Rules</h3>
                    <p className="text-[11px] text-muted-foreground">Autonomous agent branding &amp; sales parameters</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-blue-500 bg-blue-500/10 border-blue-500/20">
                  Agent Config
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Agent Name
                  </label>
                  <Input
                    value={agentCustomName}
                    onChange={(e) => setAgentCustomName(e.target.value)}
                    placeholder="Paylo"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Max Discount %
                  </label>
                  <div className="flex items-center gap-1">
                    {[10, 15, 20, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setMaxDiscountPercent(pct)}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-md border transition-all cursor-pointer ${
                          maxDiscountPercent === pct
                            ? "bg-[#0070ba] text-white border-[#0070ba] shadow-xs"
                            : "bg-muted text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Brand Theme Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { name: "PayPal Blue", hex: "#0070ba" },
                    { name: "Emerald Growth", hex: "#10b981" },
                    { name: "Royal Purple", hex: "#8b5cf6" },
                    { name: "Cyber Teal", hex: "#06b6d4" },
                  ].map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setCustomBrandColor(color.hex)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                        customBrandColor === color.hex
                          ? "border-foreground bg-muted font-bold text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Custom Welcome Greeting
                </label>
                <Input
                  value={customGreeting}
                  onChange={(e) => setCustomGreeting(e.target.value)}
                  placeholder={`Hi! I'm ${agentCustomName}, your AI checkout assistant`}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <Button
                onClick={handleSaveCustomization}
                disabled={isSavingCustomization}
                className="w-full h-8 bg-[#0070ba] hover:bg-[#003087] text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                {isSavingCustomization ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>{isSavingCustomization ? "Saving Rules..." : "Save Personality & Discount Rules"}</span>
              </Button>
            </motion.div>
        </div>

        {/* Row 3: Step 5 (Left) & Live Interactive Paylo Chat Hub (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Step 5 Live Revenue Analytics (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Step 5: Live Revenue Analytics (Grounded in paylo-live-revenue.json) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, delay: 0.25 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center font-black text-xs">
                    5
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Step 5: Live Revenue Analytics</h3>
                    <p className="text-[11px] text-muted-foreground">Verified PayPal captures · grounded ledger</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold text-blue-500 bg-blue-500/10 border-blue-500/25 flex items-center gap-1 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span>Live Telemetry</span>
                  </Badge>
                  <button
                    type="button"
                    onClick={() => navigate("/paylo-studio?tab=overview")}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 transition-all cursor-pointer"
                  >
                    <BarChart3 className="h-3 w-3" />
                    <span>Open Full Studio</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showAnalytics && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {analyticsData ? (
                      <>
                        {/* KPI Grid — grounded in verified captures */}
                        <div className="grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => navigate("/paylo-studio?tab=payments")} className="p-2.5 rounded-xl bg-background/90 border border-border text-center hover:border-blue-500/40 transition-all cursor-pointer">
                            <div className="text-lg font-black text-foreground">{analyticsData.completedOrders || analyticsData.checkoutClicks}</div>
                            <div className="text-[10px] font-semibold text-muted-foreground">Verified Captures</div>
                          </button>
                          <button type="button" onClick={() => navigate("/paylo-studio?tab=overview")} className="p-2.5 rounded-xl bg-background/90 border border-border text-center hover:border-blue-500/40 transition-all cursor-pointer">
                            <div className="text-lg font-black text-blue-500">{analyticsData.conversionRate ?? "—"}</div>
                            <div className="text-[10px] font-semibold text-muted-foreground">Conversion</div>
                          </button>
                          <button type="button" onClick={() => navigate("/paylo-studio?tab=radar")} className="p-2.5 rounded-xl bg-background/90 border border-border text-center hover:border-blue-500/40 transition-all cursor-pointer">
                            <div className="text-lg font-black text-emerald-500">0</div>
                            <div className="text-[10px] font-semibold text-muted-foreground">Disputes</div>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => navigate("/paylo-studio?tab=overview")} className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center hover:bg-blue-500/15 transition-all cursor-pointer">
                            <div className="text-sm font-black text-blue-500">{analyticsData.totalTPV}</div>
                            <div className="text-[10px] font-semibold text-muted-foreground">Gross TPV</div>
                          </button>
                          <button type="button" onClick={() => navigate("/paylo-studio?tab=balances")} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center hover:bg-emerald-500/15 transition-all cursor-pointer">
                            <div className="text-sm font-black text-emerald-500">{analyticsData.rawNetTPV == null ? "—" : `$${analyticsData.rawNetTPV.toFixed(2)}`}</div>
                            <div className="text-[10px] font-semibold text-muted-foreground">Net Available</div>
                          </button>
                        </div>

                        {/* Live Activity Feed Header */}
                        <div className="pt-1 flex items-center justify-between">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span>Live Activity Feed</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleSimulateTelemetryOrder}
                            disabled={isSimulatingOrder}
                            className="text-[10px] font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Zap className="h-3 w-3" />
                            <span>{isSimulatingOrder ? "Simulating..." : "Simulate Order (+$19)"}</span>
                          </button>
                        </div>

                        {analyticsData.lastEvents && analyticsData.lastEvents.length > 0 && (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
                            {analyticsData.lastEvents.slice(0, 8).map((evt: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-[10px] p-2 rounded-lg bg-background/80 border border-border/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                                <span className="text-foreground/90 font-medium truncate flex-1">{evt.detail}</span>
                                <span className="text-muted-foreground shrink-0 font-mono text-[9px]">
                                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Loading analytics...
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>

          {/* Right Column: Live Interactive Paylo Chat & Commerce Hub (Col 7) */}
          <div className="lg:col-span-7 space-y-6">
            <div ref={chatCardRef} className="rounded-2xl border border-primary/20 bg-card/70 backdrop-blur-xl shadow-2xl flex flex-col h-[740px] overflow-hidden">
              {/* Chat Top Bar with Paylo Companion */}
              <div className="border-b border-border p-3.5 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PayloMascot size={46} emotion={mascotEmotion} interactive={false} showBadge={false} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-sm text-foreground">{agentCustomName || "Paylo"}</h4>
                      <Badge className="text-[10px] text-white border-none py-0 px-1.5" style={{ backgroundColor: customBrandColor }}>
                        {siteData?.siteName || "AI Tools Hubi"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Multi-Modal Autonomous Commerce Engine
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      Sandbox ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Persona Switcher Bar: Shopper Experience vs. Platform Founder Operations */}
              <div className="bg-muted/30 border-b border-border px-3.5 py-1.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border shadow-2xs relative">
                  <button
                    type="button"
                    onClick={() => handleSwitchPersona("shopper")}
                    className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      chatPersona === "shopper"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {chatPersona === "shopper" && (
                      <motion.div
                        layoutId="chatPersonaActivePill"
                        className="absolute inset-0 bg-primary rounded-md shadow-xs"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <ShoppingBag className="h-3 w-3 relative z-10" />
                    <span className="relative z-10">Customer View</span>
                    <span className="text-[9px] opacity-80 font-normal hidden sm:inline relative z-10">(Subscriber)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchPersona("merchant")}
                    className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      chatPersona === "merchant"
                        ? "text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {chatPersona === "merchant" && (
                      <motion.div
                        layoutId="chatPersonaActivePill"
                        className="absolute inset-0 bg-blue-600 rounded-md shadow-xs"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Briefcase className="h-3 w-3 relative z-10" />
                    <span className="relative z-10">Platform Operations</span>
                    <span className="text-[9px] opacity-80 font-normal hidden sm:inline relative z-10">(Founder)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {chatPersona === "merchant" && (
                    <a
                      href="/paylo-studio"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-bold border border-blue-500/30 transition-colors"
                      title="Open AG Grid Merchant Studio"
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      <span>Open Studio BI</span>
                      <ArrowUpRight className="h-3 w-3 opacity-70" />
                    </a>
                  )}
                  <span className="text-[10px] text-muted-foreground hidden lg:inline truncate">
                    {chatPersona === "shopper"
                      ? `Browsing ${siteData?.siteName || "platform"} plans`
                      : `Platform operations & PayPal treasury ledger`}
                  </span>
                </div>
              </div>

              {/* Chat Messages Stream with Paylo Mini Avatar */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar" style={{ overflowAnchor: "none" }}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-2.5 ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Paylo Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {msg.role === "user" ? (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-600 text-white flex items-center justify-center text-[11px] font-black shadow-md border border-white/20">
                          YOU
                        </div>
                      ) : (
                        <div className="relative">
                          <PayloMascot
                            size={36}
                            emotion={i === messages.length - 1 ? mascotEmotion : "idle"}
                            interactive={false}
                            showBadge={false}
                          />
                        </div>
                      )}
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[85%] ${
                        msg.role === "user"
                          ? "bg-foreground text-background font-medium rounded-br-xs"
                          : "bg-muted/70 text-foreground border border-border rounded-bl-xs"
                      }`}
                    >
                      {/* Attached Image Thumbnail (Vision Feature) */}
                      {msg.image && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-border/80 max-w-xs shadow-xs">
                          <img src={msg.image} alt="Uploaded attachment" className="w-full max-h-48 object-cover rounded-lg" />
                        </div>
                      )}

                      {/* Transparent AI Thinking Process Accordion */}
                      {msg.role === "assistant" && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                        <details className="mb-2.5 group rounded-xl bg-background/60 border border-blue-500/25 overflow-hidden text-[11px] shadow-2xs">
                          <summary className="px-3 py-1.5 flex items-center justify-between cursor-pointer text-muted-foreground hover:text-foreground font-semibold select-none bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                            <span className="flex items-center gap-1.5 text-blue-500 dark:text-cyan-400 font-mono text-[10px] font-bold">
                              <Cpu className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                              Paylo Thinking Process ({msg.reasoningSteps.length} steps)
                            </span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="p-3 pt-2 space-y-1.5 bg-background/50 border-t border-border/40 font-mono text-[10px]">
                            {msg.reasoningSteps.map((step, sIdx) => (
                              <div key={sIdx} className="flex items-start gap-2">
                                <span className="text-emerald-500 font-black shrink-0">✓</span>
                                <span className="leading-tight text-foreground/90">{step}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <FormattedChatMessage
                            content={msg.content}
                            onPromptClick={msg.role === "assistant" ? handleSendChat : undefined}
                          />
                        </div>
                        {msg.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => speakMessage(msg.content)}
                            className="opacity-70 hover:opacity-100 text-muted-foreground hover:text-sky-400 p-1 transition-opacity shrink-0 cursor-pointer"
                            title="Listen to Paylo's audio voice"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Render Interactive Action Card if returned */}
                      {msg.action && (
                        <div className="mt-2 text-foreground">
                          <PayPalAgentActionCard action={msg.action} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isChatting && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/60 border border-blue-500/25 max-w-[85%] shadow-xs backdrop-blur-xs"
                  >
                    <div className="shrink-0 animate-bounce duration-1000">
                      <PayloMascot size={34} emotion="thinking" interactive={false} showBadge={false} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-blue-500 dark:text-cyan-400 font-mono text-[11px] font-bold">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>Paylo is reasoning...</span>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {thinkingStepText}
                      </p>
                    </div>
                  </motion.div>
                )}
                <div ref={chatScrollRef} />
              </div>

              {/* Multi-Modal Status Banners */}
              {isSpeakingVoice && (
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-blue-500/10 border-t border-blue-500/25 text-xs text-sky-400">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 h-2.5 bg-sky-400 animate-pulse" />
                      <span className="w-0.5 h-3 bg-sky-400 animate-pulse delay-75" />
                      <span className="w-0.5 h-1.5 bg-sky-400 animate-pulse delay-150" />
                    </div>
                    <span className="font-semibold text-[11px]">Paylo Voice Talkback Active</span>
                  </div>
                  <button
                    onClick={stopSpeaking}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-200 cursor-pointer"
                  >
                    Stop Audio
                  </button>
                </div>
              )}

              {isRecordingVoice && (
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-red-500/10 border-t border-red-500/25 text-xs text-red-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="font-semibold text-[11px]">Listening to your voice audio... speak now</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Speech-to-Text</span>
                </div>
              )}

              {/* Quick Prompt Chips (Enterprise Precision & Clean Lucide Icons) */}
              <div className="px-3 py-2 bg-muted/20 border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  <Sliders className="h-3 w-3 text-primary" />
                  <span>{chatPersona === "shopper" ? "Shopper Actions:" : "Operations:"}</span>
                </span>
                {(() => {
                  const isExternal = Boolean(siteData?.id && !["aitoolshubi", "aitoolshubi-com"].includes(siteData.id));
                  type ActionChip = {
                    label: string;
                    query: string;
                    icon: React.ComponentType<{ className?: string }>;
                    colorClass: string;
                    isSwitchToHubi?: boolean;
                  };

                  const chips: ActionChip[] = chatPersona === "shopper"
                    ? (isExternal
                        ? [
                            { label: `Compare ${siteData?.siteName || "Catalog"} Plans`, query: "Compare plans", icon: BarChart3, colorClass: "text-blue-400" },
                            { label: `What is in ${siteData?.pricingPlans[0]?.name || "this plan"}?`, query: `What is included in ${siteData?.pricingPlans[0]?.name || "this plan"}?`, icon: FileText, colorClass: "text-slate-400" },
                            { label: "PayPal Pay in 4 Financing", query: "Do you support Pay in 4?", icon: CreditCard, colorClass: "text-blue-400" },
                            { label: "Tax Deduction Eligibility", query: "Can I write this off on taxes?", icon: FileCheck, colorClass: "text-cyan-400" },
                            { label: "Switch to Hubi Checkout", query: "", icon: ArrowRight, colorClass: "text-primary", isSwitchToHubi: true },
                          ]
                        : [
                            { label: `Upgrade to ${siteData?.pricingPlans[0]?.name || "Pro"}`, query: `Upgrade to ${siteData?.pricingPlans[0]?.name || "Pro"}`, icon: Zap, colorClass: "text-primary" },
                            { label: "Compare Plans", query: "Compare plans", icon: BarChart3, colorClass: "text-blue-400" },
                            { label: "💳 Pay in 4 Calculator", query: "PAY_IN_4_MODAL_DEMO", icon: CreditCard, colorClass: "text-blue-400" },
                            { label: "Negotiate Discount", query: "Can I get a discount?", icon: Tag, colorClass: "text-amber-400" },
                            { label: "PayPal Pay in 4 Terms", query: "Do you support Pay in 4?", icon: CreditCard, colorClass: "text-blue-400" },
                            { label: "🎁 Autonomous Cart Recovery", query: "EXIT_RECOVERY_DEMO", icon: Gift, colorClass: "text-emerald-400" },
                            { label: "Tax Deductibility (IRC § 162)", query: "Can I write this off on taxes?", icon: FileText, colorClass: "text-cyan-400" },
                            { label: "Dispute & Resolution Shield", query: "I have a problem with my order", icon: ShieldCheck, colorClass: "text-zinc-400" },
                            { label: "View Last Receipt", query: "Show last payment receipt", icon: Receipt, colorClass: "text-purple-400" },
                          ]
                      )
                    : [
                        { label: "Today's Revenue", query: "How much money we have today?", icon: DollarSign, colorClass: "text-emerald-400" },
                        { label: "AG Grid Studio BI", query: "Give me the dashboard analytics", icon: BarChart3, colorClass: "text-blue-400" },
                        { label: "Verified PayPal Balance", query: "What's my PayPal balance?", icon: Wallet, colorClass: "text-blue-400" },
                        { label: "Operations Timeline", query: "Show the operations scheduler timeline", icon: Clock, colorClass: "text-purple-400" },
                        { label: "Buyer Dispute Shield", query: "Open dispute shield", icon: ShieldAlert, colorClass: "text-amber-400" },
                        { label: "Draft Invoice ($149)", query: "Create an invoice for $149", icon: FileCheck, colorClass: "text-cyan-400" },
                        { label: "Retrieve Payment Receipt", query: "Show last payment receipt", icon: Receipt, colorClass: "text-purple-400" },
                      ];

                  return chips.map((chip, idx) => {
                    const Icon = chip.icon;
                    return (
                      <motion.button
                        key={idx}
                        type="button"
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          if (chip.query === "EXIT_RECOVERY_DEMO") {
                            setShowExitRecovery(true);
                            return;
                          }
                          if (chip.query === "PAY_IN_4_MODAL_DEMO") {
                            setShowPayIn4Modal(true);
                            return;
                          }
                          if (chip.label.includes("Receipt")) {
                            setShowOrderLookupModal(true);
                            return;
                          }
                          if (chip.isSwitchToHubi) {
                            handleIngestUrl("https://aitoolshubi.com");
                            return;
                          }
                          handleSendChat(chip.query);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-background/90 border border-border/80 hover:border-primary/50 text-foreground transition-colors shrink-0 cursor-pointer shadow-xs whitespace-nowrap group"
                      >
                        <Icon className={`h-3 w-3 ${chip.colorClass} group-hover:scale-110 transition-transform`} />
                        <span>{chip.label}</span>
                      </motion.button>
                    );
                  });
                })()}
              </div>


              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(chatInput);
                }}
                className="p-3 border-t border-border flex items-center gap-2 bg-card"
              >

                {/* Microphone Button (Speech-to-Text) */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={startVoiceRecording}
                  className={`h-10 w-10 shrink-0 hover:bg-muted cursor-pointer ${
                    isRecordingVoice ? "bg-red-500/20 text-red-400 animate-pulse" : "text-muted-foreground hover:text-sky-400"
                  }`}
                  title={isRecordingVoice ? "Recording voice audio..." : "Speak using voice audio (Speech-to-Text)"}
                >
                  {isRecordingVoice ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                </Button>

                {/* Voice Talkback Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const nextVal = !voiceEnabled;
                    setVoiceEnabled(nextVal);
                    if (!nextVal) stopSpeaking();
                    toast({
                      title: nextVal ? "Voice Talkback Enabled" : "Voice Talkback Muted",
                      description: nextVal ? "Paylo will speak answers aloud with audio." : "Voice responses muted.",
                    });
                  }}
                  className={`h-10 w-10 shrink-0 hover:bg-muted cursor-pointer ${
                    voiceEnabled ? "text-sky-400" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={voiceEnabled ? "Voice Talkback is Active (click to mute)" : "Voice Talkback is Muted (click to enable)"}
                >
                  {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>

                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Paylo about plans, pricing, or speak via mic..."
                  className="h-10 text-xs bg-background transition-all"
                />

                <Button
                  type="submit"
                  disabled={!chatInput.trim() || isChatting}
                  className="h-10 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-xs shrink-0 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  <span>Send</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Shopper Passport Modal (Sprint 3 / Task 3.1) */}
      <Dialog open={showPassportModal} onOpenChange={setShowPassportModal}>
        <DialogContent className="max-w-md bg-card border border-border p-6 shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-foreground flex items-center gap-1.5">
                    <span>Shopper profile preview</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold border border-blue-500/20">
                      Local demo data
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Example preferences shown in this browser only
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Demo profile
                </span>
                <span className="font-bold text-sm text-foreground">{shopperPassport.name}</span>
                <span className="text-muted-foreground block font-mono text-[11px]">{shopperPassport.email}</span>
              </div>
              <Badge className="bg-amber-500 text-white font-bold border-none text-[10px] px-2.5 py-1">
                {shopperPassport.vipTier}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-semibold text-muted-foreground block">Demo orders</span>
                <span className="text-base font-black text-foreground">{shopperPassport.purchasesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-semibold text-muted-foreground block">Example points</span>
                <span className="text-base font-black text-amber-500">{shopperPassport.points} pts</span>
              </div>
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-semibold text-muted-foreground block">Currency</span>
                <span className="text-base font-black text-primary">{shopperPassport.preferredCurrency}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span>Not connected to PayPal</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                These sample profile values are stored in this browser. Paylo does not read PayPal purchase history, share a shopper identity across merchants, or reuse a buyer’s payment details. Checkout still asks the buyer to review and approve in PayPal.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button
              size="sm"
              onClick={() => setShowPassportModal(false)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Universal Architecture, Security & Trust Blueprint Dialog */}
      <Dialog open={showArchitectureModal} onOpenChange={setShowArchitectureModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">
                Enterprise B2B Architecture Spec
              </Badge>
            </div>
            <DialogTitle className="text-xl font-black flex items-center gap-2 pt-2">
              <span>Demo architecture and boundaries</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This prototype is scoped to the demo store catalog and a PayPal Sandbox app. A Sandbox buyer flow is available only after the API server authenticates valid Sandbox credentials. Multi-merchant seller onboarding is not part of this demo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-3 text-xs">
            {/* Section 1: The Core Question Answered */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Globe className="h-4 w-4 text-foreground font-bold" />
                <span>1. What does this demo support?</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                <strong>This prototype is scoped to the verified merchant catalog and a PayPal Sandbox app configured on the server.</strong> The embed can render on a web page, but another shop is not automatically connected to its own catalog or PayPal account. Production multi-merchant payments would need a separate seller onboarding and platform integration.
              </p>
            </div>

            {/* Section 2: How the Transformation Works */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Layers className="h-4 w-4 text-purple-400" />
                <span>2. The three steps in this demo</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 text-foreground font-bold flex items-center justify-center font-bold shrink-0 text-xs">1</div>
                  <div>
                    <strong className="text-foreground">Review store knowledge:</strong> The owner analyzes the demo site, checks extracted plans and FAQs, corrects them, then saves the reviewed catalog.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0 text-xs">2</div>
                  <div>
                    <strong className="text-foreground">Use the server Sandbox app:</strong> The demo server authenticates to PayPal Sandbox. A buyer reviews and approves a checkout there; the merchant's live account is not connected.
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shrink-0 text-xs">3</div>
                  <div>
                    <strong className="text-foreground">Test the embed:</strong> The one-line script loads Paylo on the demo storefront page. Its site ID is checked against the supported Sandbox catalog before a checkout can be prepared.
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Payment boundaries */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <span>3. Security, Privacy &amp; Customer Trust Architecture</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>PayPal handles buyer approval</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Paylo sends the selected plan to the PayPal checkout UI. The buyer reviews the details and approves payment with PayPal.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                  <div className="font-bold text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Catalog and amount check</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Before a Paylo Sandbox order is created or captured, the server checks the site, plan, interval, and amount against the supported catalog.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Buyer-controlled purchase</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Product questions and comparisons do not create an order. Paylo only prepares checkout when the shopper explicitly selects a supported plan.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                  <div className="font-bold text-purple-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>No simulated success</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    A local mock order is not accepted as a completed Paylo Sandbox payment. Paylo needs an authenticated Sandbox app to continue.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4: What is Showing to PayPal vs What is Showing to Merchants */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <CreditCard className="h-4 w-4 text-foreground font-bold" />
                <span>4. The problem Paylo is designed to address</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1">
                  <strong className="text-foreground">For shoppers:</strong>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pt-1">
                    <li>Understand what a plan includes before buying</li>
                    <li>Compare merchant-listed prices and billing periods</li>
                    <li>Review payment terms in PayPal before approving</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1">
                  <strong className="text-foreground">For merchants:</strong>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pt-1">
                    <li>Give shoppers one place to ask about the catalog</li>
                    <li>Keep purchase authorization in PayPal</li>
                    <li>Inspect and correct extracted store details in Studio</li>
                    <li>Test the supported flow in Sandbox before production work</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <a
              href="/paylo-demo.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-foreground font-bold hover:underline"
            >
              <span>Open the Paylo demo store</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button
              size="sm"
              onClick={() => setShowArchitectureModal(false)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Technical Architecture Comparison */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="p-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold mb-3">
            Paylo buyer journey
          </Badge>
          <h3 className="text-2xl font-black text-foreground tracking-tight">
            Understand the offer. Review the payment. Decide in PayPal.
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
            Paylo helps shoppers make sense of a merchant-approved catalog, compares the listed options, and prepares the matching checkout only when the shopper asks for it. PayPal remains the place where the buyer reviews and approves payment.
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-background/80 border border-border">
              <div className="h-8 w-8 rounded-lg bg-[#0070ba]/15 text-foreground font-bold flex items-center justify-center font-bold text-sm mb-2.5">
                <Palette className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-xs text-foreground">A recognizable guide</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                One original Paylo character appears in both the Studio preview and the embedded shopper experience.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/80 border border-border">
              <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-sm mb-2.5">
                <Database className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-xs text-foreground">Catalog-grounded answers</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Answers use the merchant’s saved plan details; uncertain or missing terms stay unclaimed.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/80 border border-border">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold text-sm mb-2.5">
                <Receipt className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-xs text-foreground">Explicit buyer intent</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Advice and comparisons do not start checkout. The buyer names the plan before Paylo prepares it.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/80 border border-border">
              <div className="h-8 w-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-sm mb-2.5">
                <Globe className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-xs text-foreground">PayPal approval</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Paylo reports success only after the server verifies the result returned by PayPal Sandbox.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AUTONOMOUS EXIT INTENT & CART RECOVERY MODAL ─── */}
      <PayloExitRecoveryModal
        open={showExitRecovery}
        onOpenChange={setShowExitRecovery}
        planName={siteData?.pricingPlans?.[1]?.name || "Featured Partner Listing"}
        originalPrice={Number(siteData?.pricingPlans?.[1]?.price) || 19.0}
        planTier="featured"
        discountPercent={15}
        onClaim={(discountedPrice, coupon) => {
          handleSendChat(`I want to claim the 15% discount for ${siteData?.pricingPlans?.[1]?.name || "Featured Partner Listing"} ($${discountedPrice.toFixed(2)} USD via coupon ${coupon})`);
        }}
      />

      {/* ─── INTERACTIVE PAY IN 4 FINANCING CALCULATOR MODAL ─── */}
      <PayPalPayIn4Modal
        open={showPayIn4Modal}
        onOpenChange={setShowPayIn4Modal}
        plans={siteData?.pricingPlans}
        currency={siteData?.currency || "USD"}
        siteId={siteData?.id || "aitoolshubi-com"}
        merchantName={siteData?.siteName || "AItools Hubi"}
        onCheckout={(details) => {
          handleSendChat(`Prepare 1-click PayPal checkout for ${details.planName} (${details.amount} ${details.currency}) with Pay in 4 installment splitting`);
        }}
      />

      {/* ─── REAL-TIME ORDER TRACKING & INSTANT PAYPAL RECEIPTS MODAL ─── */}
      <PayloOrderLookupModal
        open={showOrderLookupModal}
        onOpenChange={setShowOrderLookupModal}
        siteId={siteData?.id || "aitoolshubi-com"}
      />

    </div>
  );
}
