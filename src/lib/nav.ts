import {
  LayoutDashboard,
  CalendarDays,
  Megaphone,
  TrendingUp,
  Sparkles,
  Boxes,
  PhoneCall,
  Wallet,
  BookText,
  Scale,
  Mail,
  HardDrive,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short blurb shown on each section's placeholder page. */
  blurb: string;
}

/** The ten business-operation functions, in rail order. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, blurb: "Company-wide pulse from the AMG ClickUp space, by quarter." },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, blurb: "Schedule across the team — month, week, and day." },
  { href: "/marketing", label: "Marketing", icon: Megaphone, blurb: "Campaigns, content calendar, and channel performance." },
  { href: "/sales", label: "Sales", icon: TrendingUp, blurb: "Pipeline, deals, and revenue tracking." },
  { href: "/ai", label: "AI", icon: Sparkles, blurb: "AI research workspace — switch between Claude and GPT." },
  { href: "/inventory", label: "Inventory", icon: Boxes, blurb: "Stock levels, SKUs, and supply tracking." },
  { href: "/contact-center", label: "Contact Center", icon: PhoneCall, blurb: "Outbound call console for suppliers, wholesalers & contractors — scripts, capture, outcomes." },
  { href: "/budget", label: "Budget", icon: Wallet, blurb: "Spend, forecasts, and financial health." },
  { href: "/operations", label: "Operations", icon: BookText, blurb: "Live AMG structure, current work swim lanes, and meeting notes." },
  { href: "/drive", label: "Drive", icon: HardDrive, blurb: "Browse and manage the AMG Google Drive — files & folders." },
  { href: "/legal", label: "Legal", icon: Scale, blurb: "Contracts, compliance, and entity documents." },
  { href: "/messages", label: "Messages", icon: Mail, blurb: "Unified email and team messages." },
  { href: "/lexicon", label: "Lexicon", icon: BookOpen, blurb: "The AMG knowledge base — terms, frameworks, playbooks, and operating definitions." },
];
