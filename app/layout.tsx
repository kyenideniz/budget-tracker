import "./globals.css";
import {Metadata} from "next"; // This connects the styles!

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}

export const metadata: Metadata = {
  title: "Budget Tracker",
  manifest: "/manifest.json", // Add this line
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Budget",
  },
};