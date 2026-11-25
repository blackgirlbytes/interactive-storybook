import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import Nav from "@/components/Nav";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import "./night.css";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["SOFT"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "OnceUpon · Little voices. Big adventures.",
  description: "Step inside a story. Talk to the characters, dream up a twist, and make every adventure your own.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable}`}
      data-scroll-behavior="smooth"
    >
      <body><a className="skip-link" href="#content">Skip to content</a><Suspense fallback={<header className="nav"><Link className="brand" href="/">OnceUpon.</Link></header>}><Nav/></Suspense><div id="content">{children}</div></body>
    </html>
  );
}
