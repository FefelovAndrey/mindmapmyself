import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mind Map Editor — задачи RULI',
  description: 'Локальный редактор mind map для управления задачами',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
