import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "H2GROW",
  description: "Temperature, humidity, and relay control for an ESP32.",
  applicationName: "H2GROW",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "H2GROW",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080a09",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${instrument.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("h2grow-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#f4f1ea":"#080a09");}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
