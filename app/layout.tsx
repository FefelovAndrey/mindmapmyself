import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mind Map Editor — задачи RULI',
  description: 'Локальный редактор mind map для управления задачами',
};

const themeInitScript = `(function(){try{var k='mindmap-theme';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
