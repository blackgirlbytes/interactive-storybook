"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export default function Nav() {
  const path = usePathname();
  return <header className="nav"><Link href="/" className="brand" aria-label="OnceUpon home"><span className="brand-mark">✦</span> OnceUpon<span className="brand-dot">.</span></Link><nav aria-label="Main navigation"><Link className={path === "/" ? "active" : ""} href="/">Story library</Link><Link className={path.startsWith("/adventures") ? "active" : ""} href="/adventures">My adventures</Link><Link className="nav-create" href="/create">✧ Create a story</Link></nav></header>;
}
