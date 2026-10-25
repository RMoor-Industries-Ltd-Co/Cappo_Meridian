import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ShoppingBag,
  GraduationCap,
  Sparkles,
  Boxes,
  PhoneCall,
  Wallet,
  Landmark,
  BookText,
  Scale,
  Mail,
  HardDrive,
  BookOpen,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short blurb shown on each section's placeholder page. */
  blurb: string;
  /** Gets the hover priority-highlight flyout (see components/shell/MeetingHighlight.tsx). */
  highlight?: boolean;
}

/** The business-operation functions, in rail order. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, blurb: "Company-wide pulse from the AMG ClickUp space, by quarter." },
  { href: "/proposals", label: "Proposals", icon: ClipboardList, blurb: "Idea intake, governance review, and proposal decisions." },
  { href: "/meetings", label: "Meetings", icon: Video, blurb: "Transcribed & logged conversations — Fathom, Gemini, Calendly, ClickUp, and Notion, in one index.", highlight: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, blurb: "Schedule across the team — month, week, and day." },
  { href: "/commerce-operations", label: "Commerce Operations", icon: ShoppingBag, blurb: "Marketing, Sales, and Promotions — campaigns, pipeline, content, and revenue." },
  { href: "/ai", label: "AI", icon: Sparkles, blurb: "AI research workspace — switch between Claude and GPT." },
  { href: "/inventory", label: "Inventory", icon: Boxes, blurb: "Stock levels, SKUs, and supply tracking." },
  { href: "/contact-center", label: "Contact Center", icon: PhoneCall, blurb: "Outbound call console for suppliers, wholesalers & contractors — scripts, capture, outcomes." },
  { href: "/financials", label: "Financials", icon: Wallet, blurb: "Accounts, transactions, contributions, revenue, expenses, budgets, forecasting, and reports." },
  { href: "/grantops", label: "GrantOps", icon: Landmark, blurb: "Funding Command Center — research, score, and prepare grant & funding applications with CAPPO governance and ALLIE prep. Human approval before any submission." },
  { href: "/operations", label: "Operations", icon: BookText, blurb: "Live AMG structure, current work swim lanes, and meeting notes." },
  { href: "/drive", label: "Drive", icon: HardDrive, blurb: "Browse and manage the AMG Google Drive — files & folders." },
  { href: "/legal", label: "Legal", icon: Scale, blurb: "Contracts, compliance, and entity documents." },
  { href: "/messages", label: "Messages", icon: Mail, blurb: "Unified email and team messages." },
  { href: "/training", label: "Training", icon: GraduationCap, blurb: "Quiz yourself on the AMG lexicon. Sharpen your brand vocabulary." },
  { href: "/lexicon", label: "Lexicon", icon: BookOpen, blurb: "The AMG knowledge base — terms, frameworks, playbooks, and operating definitions." },
];
