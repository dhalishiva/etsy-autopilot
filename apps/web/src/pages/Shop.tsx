import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { isCloud } from '../lib/store';
import { etsy } from '../lib/supabase';
import type { EtsyConnection } from '../lib/types';
import { timeAgo } from '../lib/useAsset';

const RESULT_TEXT: Record<string, string> = {
  connected: 'Etsy shop connected',
  denied: 'Etsy access was not granted',
  expired: 'That sign-in took too long — try connecting again',
  error: 'Etsy connection failed',
};

export function Shop() {
  const [conn, setConn] = useState<EtsyConnection | null | undefined>(undefined);
  const [orders, setOrders] = useState<Record<string, unknown>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    const r = params.get('etsy');
    if (r) {
      toast(`${RESULT_TEXT[r] ?? r}${params.get('reason') ? `: ${params.get('reason')}` : ''}`, r === 'connected' ? 'ok' : 'error');
      setParams({}, { replace: true });
    }
    if (!isCloud) return;
    etsy
      .status()
      .then((s) => {
        setConn(s.connection);
        if (s.connection?.shop_id) etsy.orders().then((o) => setOrders(o.results)).catch(() => setOrders([]));
      })
      .catch((e) => {
        toast(e.message, 'error');
        setConn(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await etsy.connectUrl(`${window.location.origin}/shop`);
      window.location.href = url;
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your Etsy shop? Your listings on Etsy stay as they are.')) return;
    await etsy.disconnect();
    setConn(null);
    setOrders(null);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-extrabold md:text-4xl">Etsy shop</h1>

      {!isCloud ? (
        <p className="mt-4 text-slate">
          Local mode can make products but can’t talk to Etsy. Add your Supabase project details to <code>apps/web/.env</code> (see the README) to sign in and connect
          your shop.
        </p>
      ) : conn === undefined ? (
        <p className="mt-4 text-slate">Checking your connection…</p>
      ) : conn === null ? (
        <div className="panel mt-6 p-6">
          <h2 className="text-xl font-bold">Connect your shop</h2>
          <p className="mt-2 text-slate">
            You’ll sign in on Etsy and approve access to manage listings and read orders. Products are always sent as drafts first — you publish each one yourself.
          </p>
          <button className="btn-primary mt-5" onClick={connect} disabled={busy}>
            {busy ? 'Opening Etsy…' : 'Connect Etsy shop'}
          </button>
        </div>
      ) : (
        <>
          <div className="panel mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate">Connected {timeAgo(conn.connected_at)}</p>
              <h2 className="text-2xl font-bold">{conn.shop_name ?? 'Your Etsy account'}</h2>
              {!conn.shop_id && <p className="mt-1 text-sm text-danger">This Etsy account has no shop yet. Open one on Etsy, then reconnect.</p>}
              {conn.currency_code && <p className="text-sm text-slate">Prices are in {conn.currency_code}</p>}
            </div>
            <div className="flex gap-2">
              {conn.shop_url && (
                <a className="btn-quiet" href={conn.shop_url} target="_blank" rel="noreferrer">
                  Open shop
                </a>
              )}
              <button className="btn-quiet" onClick={connect}>
                Reconnect
              </button>
              <button className="btn-danger" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="text-xl font-bold">Recent orders</h2>
            {orders === null ? (
              <p className="mt-2 text-slate">Loading orders…</p>
            ) : orders.length === 0 ? (
              <p className="mt-2 text-slate">No orders yet. They’ll appear here once your first listing sells.</p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {orders.map((o) => {
                  const total = o.grandtotal as { amount: number; divisor: number; currency_code: string } | undefined;
                  return (
                    <li key={String(o.receipt_id)} className="flex justify-between py-3 text-sm">
                      <span>
                        Order #{String(o.receipt_id)} — {new Date(Number(o.created_timestamp) * 1000).toLocaleDateString()}
                      </span>
                      <span className="font-semibold">{total ? `${(total.amount / total.divisor).toFixed(2)} ${total.currency_code}` : ''}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
