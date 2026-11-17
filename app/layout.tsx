import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OnceUpon · Little voices. Big adventures.",
  description: "Step inside a story. Talk to the characters, dream up a twist, and make every adventure your own.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <body><a className="skip-link" href="#content">Skip to content</a><Suspense fallback={<header className="nav"><Link className="brand" href="/">OnceUpon.</Link></header>}><Nav/></Suspense><div id="content">{children}</div></body>
    </html>
  );
}
