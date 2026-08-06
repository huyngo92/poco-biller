"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAdd, IconBell, IconGear, IconLedger } from "./Icons";

const TABS = [
  { href: "/", label: "Sổ bill", Icon: IconLedger },
  { href: "/them", label: "Thêm bill", Icon: IconAdd },
  { href: "/nhac-no", label: "Nhắc nợ", Icon: IconBell },
  { href: "/cai-dat", label: "Cài đặt", Icon: IconGear },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Điều hướng chính">
      <div className="tabbar-inner">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="tab"
              aria-current={active ? "page" : undefined}
            >
              {/* Tab đang chọn được tô đầy — quy ước filled variant của SF Symbols */}
              <Icon filled={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
