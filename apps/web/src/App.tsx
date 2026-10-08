import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { isCloud } from './lib/store';
import { supabase } from './lib/supabase';
import { Login } from './pages/Login';
import { NewProduct } from './pages/NewProduct';
import { ProductDetail } from './pages/ProductDetail';
import { Products } from './pages/Products';
import { SettingsPage } from './pages/Settings';
import { Shop } from './pages/Shop';

function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(isCloud ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

const NAV = [
  { to: '/', label: 'Products', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/new', label: 'New', icon: 'M12 5v14M5 12h14' },
  { to: '/shop', label: 'Etsy shop', icon: 'M4 9l1.5-5h13L20 9M4 9v10h16V9M4 9h16M9 19v-6h6v6' },
  { to: '/settings', label: 'Settings', icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-card px-4 py-6 md:flex">
        <div className="mb-8 px-2">
          <p className="font-display text-xl font-extrabold leading-none">Etsy Autopilot</p>
          <p className="mt-1 text-xs text-slate">{isCloud ? 'Synced to your account' : 'Local mode (this browser only)'}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-mist'}`
              }
            >
              <Icon d={n.icon} />
              {n.label === 'New' ? 'New product' : n.label}
            </NavLink>
          ))}
        </nav>
        {isCloud && supabase && (
          <button className="mt-auto px-3 text-left text-sm text-slate hover:text-ink" onClick={() => supabase!.auth.signOut()}>
            Sign out
          </button>
        )}
      </aside>
      <main className="pb-24 md:pb-10">{children}</main>
      {/* Mobile tab bar — mirrors the planned Android navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-rule bg-card md:hidden" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${isActive ? 'text-ink' : 'text-slate'}`}
          >
            <Icon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  const session = useSession();
  if (session === undefined) return <div className="grid min-h-dvh place-items-center text-slate">Loading…</div>;
  if (isCloud && !session) return <Login />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Products />} />
        <Route path="/new" element={<NewProduct />} />
        <Route path="/p/:id" element={<ProductDetail />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
