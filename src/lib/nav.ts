import {
  LayoutDashboard,
  CalendarDays,
  Megaphone,
  TrendingUp,
  Sparkles,
  Boxes,
  Users,
  Wallet,
  BookText,
  Scale,
  Mail,
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
  { href: "/ai", label: "AI", icon: Sparkles, blurb: "Claude-powered AI workspace — research & ClickUp control (coming soon)." },
  { href: "/inventory", label: "Inventory", icon: Boxes, blurb: "Stock levels, SKUs, and supply tracking." },
  { href: "/affiliates", label: "Affiliates", icon: Users, blurb: "Partner network, referrals, and payouts." },
  { href: "/budget", label: "Budget", icon: Wallet, blurb: "Spend, forecasts, and financial health." },
  { href: "/operations", label: "Operations", icon: BookText, blurb: "Process documentation and SOPs." },
  { href: "/legal", label: "Legal", icon: Scale, blurb: "Contracts, compliance, and entity documents." },
  { href: "/messages", label: "Messages", icon: Mail, blurb: "Unified email and team messages." },
];
