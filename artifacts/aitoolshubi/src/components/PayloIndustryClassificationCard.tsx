import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Layers,
  CreditCard,
  CheckCircle2,
  Cpu,
  RefreshCw,
} from "lucide-react";

interface PayloIndustryClassificationCardProps {
  siteName?: string;
  planCount?: number;
}

export function PayloIndustryClassificationCard({
  siteName = "AItools Hubi",
  planCount = 6,
}: PayloIndustryClassificationCardProps) {
  return (
    <div className="mt-3.5 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-purple-500/10 p-4 shadow-sm space-y-3">
      {/* Header with Classification Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#0070ba] text-white flex items-center justify-center shadow-xs">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-foreground tracking-tight">
                Autonomous Industry Classification
              </span>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-bold"
              >
                Verified SaaS
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Deep crawler analyzed catalog schema and commerce model for {siteName}
            </p>
          </div>
        </div>

        <Badge className="bg-blue-600 text-white text-[10px] font-bold border-none px-2 py-0.5 shadow-2xs">
          AI & Developer Software
        </Badge>
      </div>

      {/* 3 Core Commerce Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400 font-bold text-[11px]">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span>Commerce Model</span>
          </div>
          <p className="text-[11px] text-foreground font-semibold">
            Digital Subscriptions & Passes
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {planCount} verified tiers ($6/mo - $99 one-time)
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-bold text-[11px]">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>Fulfillment Policy</span>
          </div>
          <p className="text-[11px] text-foreground font-semibold">
            Instant Digital Provisioning
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Zero physical shipping, instant access on capture
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-purple-500 dark:text-purple-400 font-bold text-[11px]">
            <CreditCard className="h-3.5 w-3.5 shrink-0" />
            <span>PayPal Optimization</span>
          </div>
          <p className="text-[11px] text-foreground font-semibold">
            Orders v2 + Subscriptions + Pay in 4
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Automated recurring renewals & bi-weekly installments
          </p>
        </div>
      </div>
    </div>
  );
}

