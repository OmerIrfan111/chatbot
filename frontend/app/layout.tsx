import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "AI Support Agent",
  description: "RAG-powered customer support — answers grounded in your documents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${outfit.variable}`}>
      <body className="font-sans bg-[#0D0D1A] text-[#FAFAFF]">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <Providers>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </Providers>
          <Toaster
            toastOptions={{
              style: {
                background: "#1C1133",
                border: "2px solid #FF3AF2",
                color: "#FAFAFF",
                fontFamily: "var(--font-sans)",
              },
            }}
            position="top-right"
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
