import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "空气质量概率预报",
  description: "未来 6-7 天每日 PM2.5 概率分布，基于 Open-Meteo 合成集合",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
