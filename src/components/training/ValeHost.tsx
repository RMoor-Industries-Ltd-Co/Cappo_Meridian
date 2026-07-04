"use client";

import Image from "next/image";

// Vale, HVN Havenry's concierge, also hosts/congratulates on the Lexicon Training
// quiz. Source images live in HVN_HAVENRY_SITE/01_HERO/CHARACTERS/VALE (Drive) —
// see hvnhavenry-com/ASSETS.md for the naming convention.
type ValePose = "quiz-welcome" | "stance";

interface ValeHostProps {
  pose: ValePose;
  className?: string;
  priority?: boolean;
}

const POSE_SRC: Record<ValePose, string> = {
  "quiz-welcome": "/characters/vale/character__vale__quiz-welcome.png",
  stance: "/characters/vale/character__vale__stance.png",
};

export function ValeHost({ pose, className = "", priority = false }: ValeHostProps) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src={POSE_SRC[pose]}
        alt="Vale, your Lexicon Training host"
        fill
        className="object-contain object-bottom"
        sizes="(max-width: 1024px) 140px, 400px"
        priority={priority}
      />
    </div>
  );
}
