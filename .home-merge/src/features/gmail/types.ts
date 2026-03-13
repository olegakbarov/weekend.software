import type { LucideIcon } from "lucide-react";

export type MailItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  text: string;
  date: string;
  read: boolean;
  labels: string[];
};

export type MailAccount = {
  label: string;
  email: string;
  icon: LucideIcon;
};

export type MailNavLink = {
  title: string;
  label: string;
  icon: LucideIcon;
  variant: "default" | "ghost";
};

export type MailTab = "all" | "unread";
