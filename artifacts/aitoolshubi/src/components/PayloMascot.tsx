import React, { useState, useEffect, useId } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

export type PayloEmotion = "idle" | "thinking" | "speaking" | "happy" | "celebrating" | "money_check";

interface PayloMascotProps {
  emotion?: PayloEmotion;
  size?: number;
  interactive?: boolean;
  onTap?: () => void;
  showBadge?: boolean;
  className?: string;
}

/**
 * Paylo — Meta Muse 3D Tactile Autonomous Commerce Mascot
 * Designed with satin porcelain shading, 3D perspective parallax, glass orb eyes,
 * and zero harsh cartoon stroke lines.
 */
export function PayloMascot({
  emotion = "idle",
  size = 120,
  interactive = true,
  onTap,
  showBadge = true,
  className = "",
}: PayloMascotProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "_");
  const [blink, setBlink] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [tapBounce, setTapBounce] = useState(false);

  // Periodic natural blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, Math.random() * 3200 + 2400);
    return () => clearInterval(interval);
  }, []);

  // 3D Perspective Eye & Head Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const handleTap = () => {
    setTapBounce(true);
    setTimeout(() => setTapBounce(false), 600);
    if (onTap) onTap();
  };

  // Dynamic jump scaling so Paylo moves gently when small and never leaps out of bounds
  const jumpScale = Math.min(1, Math.max(0.2, size / 120));

  // Organic Meta-Muse squash-and-stretch breathing & emotion dynamics
  const bodyVariants: Variants = {
    idle: {
      y: [0, -4.5 * jumpScale, 0],
      scaleX: [1, 1.02, 0.99, 1],
      scaleY: [1, 0.985, 1.015, 1],
      rotate: [0, 0.6, -0.6, 0],
      transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
    },
    thinking: {
      y: [0, -3 * jumpScale, 0],
      rotate: [0, -2, 1, 0],
      scaleX: [1, 0.98, 1.01, 1],
      transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
    },
    speaking: {
      y: [0, -4 * jumpScale, 1 * jumpScale, -2 * jumpScale, 0],
      scaleX: [1, 1.02, 0.98, 1.01, 1],
      scaleY: [1, 0.98, 1.02, 0.99, 1],
      transition: { duration: 0.72, repeat: Infinity, ease: "easeInOut" },
    },
    happy: {
      y: [0, -5 * jumpScale, 0],
      scaleX: [1, 1.04, 0.98, 1],
      scaleY: [1, 0.96, 1.03, 1],
      transition: { duration: 0.65, repeat: Infinity, ease: "easeInOut" },
    },
    celebrating: {
      y: [0, -6 * jumpScale, 1.5 * jumpScale, -3 * jumpScale, 0],
      scaleX: [1, 1.05, 0.96, 1.03, 1],
      scaleY: [1, 0.94, 1.05, 0.98, 1],
      rotate: [0, -3, 3, -1.5, 0],
      transition: { duration: 0.85, repeat: Infinity, ease: "easeInOut" },
    },
    money_check: {
      y: [0, -4 * jumpScale, 0],
      scaleX: [1, 1.03, 0.98, 1],
      scaleY: [1, 0.97, 1.02, 1],
      rotate: [0, 1.5, -1.5, 0],
      transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    },
  };

  // Tactile Ground Shadow (Contracts and diffuses organically as mascot hovers)
  const shadowVariants: Variants = {
    idle: {
      scale: [1, 0.78, 1],
      opacity: [0.38, 0.18, 0.38],
      transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
    },
    thinking: {
      scale: [0.92, 0.82, 0.92],
      opacity: [0.32, 0.2, 0.32],
      transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
    },
    speaking: {
      scale: [1, 0.75, 1.02, 0.82, 1],
      opacity: [0.38, 0.16, 0.4, 0.22, 0.38],
      transition: { duration: 0.72, repeat: Infinity, ease: "easeInOut" },
    },
    happy: {
      scale: [1, 0.68, 1],
      opacity: [0.42, 0.15, 0.42],
      transition: { duration: 0.65, repeat: Infinity, ease: "easeInOut" },
    },
    celebrating: {
      scale: [1, 0.62, 1.05, 0.72, 1],
      opacity: [0.45, 0.12, 0.5, 0.2, 0.45],
      transition: { duration: 0.85, repeat: Infinity, ease: "easeInOut" },
    },
    money_check: {
      scale: [1, 0.76, 1],
      opacity: [0.4, 0.2, 0.4],
      transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
    },
  };

  const isSquinting = emotion === "happy" || emotion === "celebrating";

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none overflow-visible ${className}`}
      style={{ width: size, height: size }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
    >
      {/* 3D Gold PayPal Floating Token for Money and Celebration */}
      <AnimatePresence>
        {(emotion === "money_check" || emotion === "celebrating" || tapBounce) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.5, rotateY: 0 }}
            animate={{
              opacity: [0.9, 1, 0.9],
              y: [-14, -24, -14],
              rotateY: [0, 180, 360],
              scale: 1,
            }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-4 -right-1 z-30 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-amber-950 shadow-xl"
            style={{
              background: "radial-gradient(circle at 35% 25%, #fef08a, #eab308, #b45309)",
              boxShadow: "0 6px 14px rgba(234, 179, 8, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.8)",
            }}
          >
            $
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Mascot 3D Container with Real Perspective Tilt */}
      <motion.div
        variants={bodyVariants}
        animate={emotion}
        style={{
          perspective: 800,
          transformStyle: "preserve-3d",
          width: size * 0.9,
          height: size * 0.9,
          transform: `perspective(800px) rotateX(${mousePos.y * -0.7}deg) rotateY(${mousePos.x * 0.9}deg)`,
          transition: "transform 0.15s ease-out",
        }}
        whileHover={interactive ? { scale: 1.04 } : {}}
        whileTap={interactive ? { scale: 0.93, rotate: -3 } : {}}
        className="relative flex items-center justify-center cursor-pointer overflow-visible"
      >
        <svg
          viewBox="0 0 180 180"
          className="w-full h-full filter drop-shadow-[0_16px_32px_rgba(0,112,186,0.22)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* 1. Meta-Muse Satin Porcelain Shading (Zero Harsh Strokes, Pure Volume) */}
            <radialGradient id={`musePorcelain_${uid}`} cx="36%" cy="26%" r="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#fbfcfe" />
              <stop offset="55%" stopColor="#f1f5f9" />
              <stop offset="78%" stopColor="#e2e8f0" />
              <stop offset="92%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>

            {/* Subsurface Warm Translucency (Gives living flesh warmth) */}
            <radialGradient id={`museSSS_${uid}`} cx="50%" cy="85%" r="65%">
              <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#fed7aa" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            {/* Top-Left Specular Sheen (Silky Satin Rim) */}
            <linearGradient id={`museSpecular_${uid}`} x1="15%" y1="10%" x2="70%" y2="85%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="35%" stopColor="#f0f9ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Deep Glass Orb Eye Gradient */}
            <radialGradient id={`glassEyeCore_${uid}`} cx="42%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="65%" stopColor="#0f172a" />
              <stop offset="95%" stopColor="#020617" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>

            {/* Glowing Cerulean Iris Rim */}
            <radialGradient id={`eyeIrisGlow_${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0070ba" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#003087" stopOpacity="0" />
            </radialGradient>

            {/* Inner Ear Translucent Sapphire Depth */}
            <radialGradient id={`innerEarTranslucent_${uid}`} cx="38%" cy="28%" r="70%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="35%" stopColor="#0070ba" />
              <stop offset="80%" stopColor="#003087" />
              <stop offset="100%" stopColor="#001845" />
            </radialGradient>

            {/* Airbrushed Cheeks Blush */}
            <radialGradient id={`airbrushBlush_${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.5" />
              <stop offset="65%" stopColor="#f43f5e" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>

            {/* Gold Medallion Gradient */}
            <radialGradient id={`goldJewel_${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#eab308" />
              <stop offset="90%" stopColor="#a16207" />
              <stop offset="100%" stopColor="#713f12" />
            </radialGradient>
          </defs>

          {/* LEFT EAR (Smooth 3D porcelain pebble, zero harsh strokes) */}
          <g
            style={{
              transformOrigin: "52px 52px",
              transform: isHovered
                ? "rotate(-5deg) scale(1.04)"
                : emotion === "thinking"
                ? "rotate(-7deg)"
                : "rotate(0deg)",
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Outer Ear Shell Solid Porcelain Base */}
            <path
              d="M 52 56 C 36 28, 62 10, 76 38 Z"
              fill="#f8fafc"
            />
            {/* Outer Ear Shell Gradient Layer */}
            <path
              d="M 52 56 C 36 28, 62 10, 76 38 Z"
              fill={`url(#musePorcelain_${uid})`}
            />
            {/* Ear Specular Rim */}
            <path
              d="M 54 52 C 40 30, 60 14, 72 36 Z"
              fill="none"
              stroke={`url(#museSpecular_${uid})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Inner Ear Sapphire Concha */}
            <path
              d="M 54 50 C 44 32, 60 20, 70 40 Z"
              fill={`url(#innerEarTranslucent_${uid})`}
              opacity="0.95"
            />
          </g>

          {/* RIGHT EAR */}
          <g
            style={{
              transformOrigin: "128px 52px",
              transform: isHovered
                ? "rotate(5deg) scale(1.04)"
                : emotion === "thinking"
                ? "rotate(8deg)"
                : "rotate(0deg)",
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Outer Ear Shell Solid Porcelain Base */}
            <path
              d="M 128 56 C 144 28, 118 10, 104 38 Z"
              fill="#f8fafc"
            />
            {/* Outer Ear Shell Gradient Layer */}
            <path
              d="M 128 56 C 144 28, 118 10, 104 38 Z"
              fill={`url(#musePorcelain_${uid})`}
            />
            <path
              d="M 126 52 C 140 30, 120 14, 108 36 Z"
              fill="none"
              stroke={`url(#museSpecular_${uid})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            <path
              d="M 126 50 C 136 32, 120 20, 110 40 Z"
              fill={`url(#innerEarTranslucent_${uid})`}
              opacity="0.95"
            />
          </g>

          {/* MAIN 3D BODY / HEAD (Ultra-smooth Meta Muse egg pebble, no cartoon outlines) */}
          {/* Solid Porcelain Base (Guarantees bright white fill under all conditions) */}
          <path
            d="M 90 26 C 144 26, 160 62, 160 108 C 160 152, 134 166, 90 166 C 46 166, 20 152, 20 108 C 20 62, 36 26, 90 26 Z"
            fill="#f8fafc"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="1.5"
          />
          {/* Porcelain Gradient Volume */}
          <path
            d="M 90 26 C 144 26, 160 62, 160 108 C 160 152, 134 166, 90 166 C 46 166, 20 152, 20 108 C 20 62, 36 26, 90 26 Z"
            fill={`url(#musePorcelain_${uid})`}
          />

          {/* Warm Subsurface Scattering Glow on Lower Torso */}
          <path
            d="M 90 60 C 140 60, 158 85, 158 112 C 158 150, 132 165, 90 165 C 48 165, 22 150, 22 112 C 22 85, 40 60, 90 60 Z"
            fill={`url(#museSSS_${uid})`}
          />

          {/* Satin Silky Specular Highlight Dome */}
          <path
            d="M 90 28 C 136 28, 152 56, 152 96 C 152 114, 146 130, 136 140 C 112 94, 68 94, 44 140 C 34 130, 28 114, 28 96 C 28 56, 44 28, 90 28 Z"
            fill={`url(#museSpecular_${uid})`}
            opacity="0.65"
          />

          {/* Soft Airbrushed Rosy Cheeks */}
          <ellipse cx="46" cy="114" rx="15" ry="9" fill={`url(#airbrushBlush_${uid})`} />
          <ellipse cx="134" cy="114" rx="15" ry="9" fill={`url(#airbrushBlush_${uid})`} />

          {/* 3D GLASS ORB EYES WITH PERSPECTIVE PARALLAX */}
          {/* Left Eye */}
          {isSquinting ? (
            <path
              d="M 52 94 Q 63 80 74 94"
              stroke="#0f172a"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          ) : blink ? (
            <line
              x1="52"
              y1="94"
              x2="74"
              y2="94"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          ) : emotion === "money_check" ? (
            <g transform={`translate(${mousePos.x * 0.8}, ${mousePos.y * 0.8})`}>
              <ellipse cx="63" cy="94" rx="10.5" ry="13" fill={`url(#glassEyeCore_${uid})`} />
              <text x="63" y="99" fontSize="13" fontWeight="900" fill="#fbbf24" textAnchor="middle">
                $
              </text>
            </g>
          ) : (
            <g>
              {/* Eye Socket Shading */}
              <ellipse cx="63" cy="94" rx="11" ry="13.5" fill={`url(#glassEyeCore_${uid})`} />
              {/* Iris Glow with Mouse Parallax */}
              <ellipse
                cx={63 + mousePos.x * 0.55}
                cy={95 + mousePos.y * 0.55}
                rx="8"
                ry="8"
                fill={`url(#eyeIrisGlow_${uid})`}
              />
              {/* Dark Pupil with Dynamic Shift */}
              <ellipse
                cx={63 + mousePos.x * 0.85}
                cy={94 + mousePos.y * 0.85}
                rx="6"
                ry="7.5"
                fill="#000000"
              />
              {/* Primary Corneal Specular Catchlight (Stays relatively fixed to light source) */}
              <circle
                cx={59 + mousePos.x * 0.25}
                cy={89 + mousePos.y * 0.25}
                r="3.8"
                fill="#ffffff"
              />
              {/* Secondary Corneal Bounce Reflection */}
              <circle
                cx={66 + mousePos.x * 0.4}
                cy={98 + mousePos.y * 0.4}
                r="1.8"
                fill="#ffffff"
                opacity="0.65"
              />
              {/* Tiny Cyan Sparkle Glint */}
              <circle
                cx={62 + mousePos.x * 0.5}
                cy={96 + mousePos.y * 0.5}
                r="1"
                fill="#67e8f9"
                opacity="0.8"
              />
            </g>
          )}

          {/* Right Eye */}
          {isSquinting ? (
            <path
              d="M 106 94 Q 117 80 128 94"
              stroke="#0f172a"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          ) : blink ? (
            <line
              x1="106"
              y1="94"
              x2="128"
              y2="94"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          ) : emotion === "money_check" ? (
            <g transform={`translate(${mousePos.x * 0.8}, ${mousePos.y * 0.8})`}>
              <ellipse cx="117" cy="94" rx="10.5" ry="13" fill={`url(#glassEyeCore_${uid})`} />
              <text x="117" y="99" fontSize="13" fontWeight="900" fill="#fbbf24" textAnchor="middle">
                $
              </text>
            </g>
          ) : (
            <g>
              <ellipse cx="117" cy="94" rx="11" ry="13.5" fill={`url(#glassEyeCore_${uid})`} />
              <ellipse
                cx={117 + mousePos.x * 0.55}
                cy={95 + mousePos.y * 0.55}
                rx="8"
                ry="8"
                fill={`url(#eyeIrisGlow_${uid})`}
              />
              <ellipse
                cx={117 + mousePos.x * 0.85}
                cy={94 + mousePos.y * 0.85}
                rx="6"
                ry="7.5"
                fill="#000000"
              />
              <circle
                cx={113 + mousePos.x * 0.25}
                cy={89 + mousePos.y * 0.25}
                r="3.8"
                fill="#ffffff"
              />
              <circle
                cx={120 + mousePos.x * 0.4}
                cy={98 + mousePos.y * 0.4}
                r="1.8"
                fill="#ffffff"
                opacity="0.65"
              />
              <circle
                cx={116 + mousePos.x * 0.5}
                cy={96 + mousePos.y * 0.5}
                r="1"
                fill="#67e8f9"
                opacity="0.8"
              />
            </g>
          )}

          {/* MOUTH — Natural, Sculpted Organic Expression */}
          {emotion === "speaking" ? (
            <g>
              <ellipse cx="90" cy="110" rx="6.5" ry="8.5" fill="#1e293b" />
              <path d="M 86 113 Q 90 117 94 113" fill="#fb7185" />
            </g>
          ) : isSquinting ? (
            <path
              d="M 80 107 Q 90 120 100 107"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="#fb7185"
            />
          ) : emotion === "thinking" ? (
            <path
              d="M 84 110 Q 90 106 96 110"
              stroke="#1e293b"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <path
              d="M 82 108 Q 90 115 98 108"
              stroke="#1e293b"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* 3D EMBOSSED SATIN COLLAR & PAYPAL JEWEL MEDALLION */}
          <g transform="translate(76, 142)">
            {/* Satin Navy Collar Strap with Depth */}
            <path
              d="M -8 -4 Q 14 6 36 -4"
              stroke="#003087"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Specular Edge on Collar */}
            <path
              d="M -7 -5 Q 14 5 35 -5"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.75"
            />

            {/* Gold Outer Rim Ring with Radial Depth */}
            <circle cx="14" cy="14" r="15" fill={`url(#goldJewel_${uid})`} />
            {/* PayPal Blue Inner Core */}
            <circle cx="14" cy="14" r="12" fill={`url(#innerEarTranslucent_${uid})`} />

            {/* Official Embossed PayPal Monogram */}
            <path
              d="M 12 7 L 16.5 7 C 18.5 7 20 8.5 20 10.5 C 20 12.5 18.5 14 16.5 14 L 14 14 L 14 19 L 12 19 Z"
              fill="#00cfde"
              opacity="0.85"
            />
            <path
              d="M 10 9 L 14.5 9 C 16.5 9 18 10.5 18 12.5 C 18 14.5 16.5 16 14.5 16 L 12 16 L 12 21 L 10 21 Z"
              fill="#ffffff"
            />
            {/* Specular Catchlight on Medallion */}
            <circle cx="9" cy="9" r="2.5" fill="#ffffff" opacity="0.85" />
          </g>
        </svg>

        {/* Dynamic Thought Bubble when Thinking */}
        {emotion === "thinking" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 5 }}
            animate={{ opacity: 1, scale: [1, 1.12, 1], y: [-2, -6, -2] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="absolute -top-3 -right-2 h-7 w-7 rounded-full bg-gradient-to-br from-[#00cfde] to-[#0070ba] text-white flex items-center justify-center text-xs shadow-lg font-black border border-white/60"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </motion.div>
        )}

        {/* Dynamic Equalizer Waves when Speaking */}
        {emotion === "speaking" && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/90 border border-primary/30 px-2 py-0.5 rounded-full shadow-md backdrop-blur-md">
            {[1, 2, 3, 2, 1].map((val, idx) => (
              <motion.div
                key={idx}
                animate={{ height: [4, val * 5, 4] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: idx * 0.08 }}
                className="w-1 bg-[#0070ba] rounded-full"
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Dynamic Ground Floating Shadow (Dual-layered for ambient depth) */}
      <motion.div
        variants={shadowVariants}
        animate={emotion}
        className="mt-1 rounded-full bg-slate-900/60 dark:bg-black/80 blur-[8px] pointer-events-none"
        style={{
          width: size * 0.55,
          height: size * 0.1,
        }}
      />

      {/* Modern Paylo Brand Badge */}
      {showBadge && (
        <motion.div
          animate={isHovered ? { scale: 1.06, y: -2 } : { scale: 1, y: 0 }}
          className="mt-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/95 border border-primary/30 shadow-md backdrop-blur-md cursor-pointer hover:border-primary transition-all"
        >
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-black tracking-wide text-foreground">Paylo</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-500/10 px-1.5 rounded">
            AI
          </span>
        </motion.div>
      )}
    </div>
  );
}
