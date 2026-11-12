import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PayloMascot } from "@/components/PayloMascot";
import {
  Sparkles,
  Clock,
  Tag,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  CreditCard,
} from "lucide-react";

export interface PayloExitRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  originalPrice?: number;
  planTier?: "community" | "featured" | "premium" | "lifetime";
  billingInterval?: "monthly" | "yearly" | "one-time";
  siteId?: string;
  discountPercent?: number;
  onClaim?: (discountedPrice: number, couponCode: string) => void;
}

export function PayloExitRecoveryModal({
  open,
  onOpenChange,
  planName = "Featured Partner Listing",
  originalPrice = 19.0,
  planTier = "featured",
  billingInterval = "monthly",
  siteId = "aitoolshubi-com",
  discountPercent = 15,
  onClaim,
}: PayloExitRecoveryModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(600); // 10 minutes
  const [voiceMuted, setVoiceMuted] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const discountedPrice = Math.max(
    1,
    Number((originalPrice * (1 - discountPercent / 100)).toFixed(2))
  );
  const savings = (originalPrice - discountedPrice).toFixed(2);
  const couponCode = `PAYLO${discountPercent}`;

  // Countdown timer
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  // Voice speech synthesis
  useEffect(() => {
    if (!open || voiceMuted) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text = `Wait! Before you leave, as your Paylo commerce rep, I'm authorized to unlock a 15% instant discount on your ${planName} if you approve with PayPal right now.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          /Jenny|Aria|Zira|Samantha|Google US English|Natural/i.test(v.name) &&
          v.lang.startsWith("en")
      );
      if (preferred) utterance.voice = preferred;

      speechRef.current = utterance;
      try {
        window.speechSynthesis.speak(utterance);
      } catch { }
    }

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [open, voiceMuted, planName]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleClaimDiscount = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    onOpenChange(false);
    if (onClaim) {
      onClaim(discountedPrice, couponCode);
    }
  };

  const handleDismiss = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden border border-emerald-500/30 bg-slate-950 text-white shadow-2xl rounded-3xl">
        {/* Top glowing ambient gradient banner */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 p-6 pb-7 text-white overflow-hidden">
          {/* Subtle background ring effects */}
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          {/* Close & Voice controls */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 backdrop-blur-md">
              <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
              Autonomous Deal Unlock
            </Badge>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVoiceMuted(!voiceMuted)}
                className="w-7 h-7 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white/90 transition-all cursor-pointer"
                title={voiceMuted ? "Unmute Paylo Voice" : "Mute Voice"}
              >
                {voiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white/90 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mascot & Headline */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-lg">
              <PayloMascot emotion="celebrating" size={54} interactive={false} showBadge={false} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight leading-tight">
                Wait! Before you leave...
              </h3>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Paylo is authorized to unlock an exclusive <strong className="text-white underline">{discountPercent}% instant discount</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 bg-[#0b0f17]">
          {/* Discount details callout box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Selected Plan</p>
                <p className="text-sm font-bold text-white">{planName}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 line-through mr-2 font-mono">
                  ${originalPrice.toFixed(2)}
                </span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  ${discountedPrice.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {billingInterval === "one-time" ? "one-time" : `/${billingInterval}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Tag className="w-3.5 h-3.5 text-emerald-400" /> Coupon Applied:
                <code className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                  {couponCode}
                </code>
              </span>
              <span className="text-emerald-400 font-bold">Save ${savings} USD</span>
            </div>
          </div>

          {/* Value Props & PayPal Guarantee */}
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Full commercial access with 100% money-back satisfaction</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Protected by official PayPal Zero-Liability Buyer Shield</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Eligible for PayPal Pay in 4 flexible installments</span>
            </div>
          </div>

          {/* Urgency countdown ticker */}
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Autonomous offer reserved for the next:</span>
            <span className="font-mono font-bold text-amber-200 text-sm">
              {formatTimer(secondsLeft)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              type="button"
              onClick={handleClaimDiscount}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Claim {discountPercent}% Off with PayPal</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer font-medium"
            >
              No thanks, I'll pay full price later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to automatically trigger exit-intent recovery.
 */
export function useExitIntent({
  onTrigger,
  delayMs = 20000,
  enabled = true,
}: {
  onTrigger: () => void;
  delayMs?: number;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const key = "paylo_exit_recovery_triggered";
    if (sessionStorage.getItem(key)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 8) {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "true");
          onTrigger();
        }
      }
    };

    const idleTimer = setTimeout(() => {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "true");
        onTrigger();
      }
    }, delayMs);

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      clearTimeout(idleTimer);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, delayMs, onTrigger]);
}

