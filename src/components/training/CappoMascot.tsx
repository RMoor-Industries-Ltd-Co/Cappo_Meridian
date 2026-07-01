// Image file should be placed at: public/images/cappo-meridian.png
"use client";

import { useState } from "react";

export type MascotMood = "neutral" | "happy" | "sad" | "celebrating";

interface CappoMascotProps {
  mood: MascotMood;
  className?: string;
}

const BORDER_CLASS: Record<MascotMood, string> = {
  neutral: "border-gold/40",
  happy: "border-gold",
  sad: "border-red-500/50",
  celebrating: "border-gold shadow-[0_0_24px_rgba(232,184,75,0.45)]",
};

export function CappoMascot({ mood, className = "" }: CappoMascotProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const bounceClass = mood === "celebrating" ? "animate-bounce" : "";

  return (
    <div
      className={[
        "relative flex items-center justify-center rounded-2xl border-2 bg-panel overflow-hidden transition-all duration-300",
        BORDER_CLASS[mood],
        bounceClass,
        className,
      ].join(" ")}
      style={{ width: 120, height: 120 }}
    >
      {!imgFailed ? (
        <img
          src="/images/cappo-meridian.png"
          alt="Cappo Meridian"
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full px-2 text-center">
          <span className="text-3xl font-bold text-gold leading-none">CM</span>
          <span className="mt-1 text-[10px] font-semibold text-gold/70 leading-tight">Cappo Meridian</span>
          <span className="text-[9px] text-subtle leading-tight">Apex Meridian Group</span>
        </div>
      )}
    </div>
  );
}
