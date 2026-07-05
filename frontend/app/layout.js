import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'SIMONDU WEB — Sistem Monitoring Pengaduan Polda Jabar',
  description: 'Aplikasi internal Kasubbid Paminal Polda Jabar untuk mengelola kasus pengaduan',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head />
      <body className="antialiased bg-slate-50">
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
