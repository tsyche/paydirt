import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "PayDirt — Parent Dashboard",
  description: "Do. The. Thing.",
};

// Runs before paint to set data-theme/data-palette from saved prefs (resolving
// "system" from the OS), so there's no flash of the wrong theme on load.
const themeInit = `(function(){try{
  var el=document.documentElement;
  var mode=localStorage.getItem('paydirt-mode')||'system';
  var theme=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;
  el.setAttribute('data-theme',theme);
  var pal=localStorage.getItem('paydirt-palette');
  if(pal&&pal!=='goldrush')el.setAttribute('data-palette',pal);
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
