import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "Women's Day · Ronan SAT",
  description:
    "A small Women's Day celebration from Ronan SAT: a bloom that follows your scroll, a flower chosen from your name, a parcel, and a bouquet you can send.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Toasts for the share dialogs (react-hot-toast has no provider; one Toaster
            covers the whole standalone site). */}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
