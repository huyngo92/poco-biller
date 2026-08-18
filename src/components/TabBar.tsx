"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAdd, IconBell, IconGear, IconLedger, IconReceipt } from "./Icons";

/** Hai tab bên trái nút "Thêm bill" nổi ở giữa. */
const LEFT_TABS = [
  { href: "/", label: "Tổng quan", Icon: IconLedger },
  { href: "/bill", label: "Bill", Icon: IconReceipt },
];

/** Hai tab bên phải nút "Thêm bill". */
const RIGHT_TABS = [
  { href: "/nhac-no", label: "Nhắc nợ", Icon: IconBell },
  { href: "/cai-dat", label: "Cá nhân", Icon: IconGear },
];

export default function TabBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="tabbar" aria-label="Điều hướng chính">
      <div className="tabbar-inner">
        {LEFT_TABS.map((t) => (
          <Tab key={t.href} href={t.href} label={t.label} Icon={t.Icon} active={isActive(t.href)} />
        ))}

        <Link
          href="/them"
          className="tab-fab"
          aria-label="Thêm bill"
          aria-current={isActive("/them") ? "page" : undefined}
        >
          <IconAdd />
        </Link>

        {RIGHT_TABS.map((t) => (
          <Tab key={t.href} href={t.href} label={t.label} Icon={t.Icon} active={isActive(t.href)} />
        ))}
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: (typeof LEFT_TABS)[number]["Icon"];
  active: boolean;
}) {
  return (
    <Link href={href} className="tab" aria-current={active ? "page" : undefined}>
      {/* Tab đang chọn được tô đầy — quy ước filled variant của SF Symbols */}
      <Icon filled={active} />
      {label}
    </Link>
  );
}
