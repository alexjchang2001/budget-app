"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string };

const TABS: Tab[] = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/buckets", label: "Buckets", icon: "💰" },
  { href: "/projection", label: "History", icon: "📊" },
];

function TabLink({ tab, active, badge }: { tab: Tab; active: boolean; badge?: number }): JSX.Element {
  const color = active ? "text-black font-semibold" : "text-gray-400";
  return (
    <Link href={tab.href} className={`relative flex flex-1 flex-col items-center justify-center py-2 ${color}`}>
      <span className="text-lg leading-none">{tab.icon}</span>
      {!!badge && (
        <span className="absolute right-3 top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="mt-1 text-xs">{tab.label}</span>
    </Link>
  );
}

export default function AppShell({
  children,
  badgeCounts = {},
}: {
  children: React.ReactNode;
  badgeCounts?: Record<string, number>;
}): JSX.Element {
  const pathname = usePathname();
  return (
    <>
      <div className="pb-16">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 flex border-t bg-white">
        {TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname === tab.href} badge={badgeCounts[tab.href]} />
        ))}
      </nav>
    </>
  );
}
