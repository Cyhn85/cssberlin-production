import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { stripeConfigured } from '@/lib/payments/methods';

const SOLD_PENDING = ['PAID', 'SHIPPED', 'DELIVERED', 'DISPUTED'] as const;

/**
 * GET /api/wallet - Geldbeutel (Vinted style), computed from orders only:
 *  - ausstehend: online sales paid by the buyer but not yet completed (escrow)
 *  - verfügbar:  completed online sales (payout once Stripe Connect is live)
 *  - bar:        Abholung sales - the money went straight to the seller
 *  - transactions: last 100 purchases and sales, newest first
 * GET /api/wallet?report=income&year=2026 -> CSV "Einkommensbericht" (completed sales of that year)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const me = session.user.id;
    const report = request.nextUrl.searchParams.get('report');

    if (report === 'income') {
      const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getFullYear();
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));
      const rows = await prisma.order.findMany({
        where: { sellerId: me, status: 'COMPLETED', completedAt: { gte: from, lt: to } },
        orderBy: { completedAt: 'asc' },
        select: { id: true, completedAt: true, itemPrice: true, shippingFee: true, paymentMethod: true, product: { select: { title: true } } },
      });
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['Datum', 'Bestellung', 'Artikel', 'Verkaufspreis (EUR)', 'Zahlungsart'].map(esc).join(';'),
        ...rows.map((r) => [
          r.completedAt?.toISOString().slice(0, 10), r.id, r.product.title, r.itemPrice.toFixed(2).replace('.', ','),
          r.paymentMethod === 'pickup_cash' ? 'Barzahlung bei Abholung' : 'Online',
        ].map(esc).join(';')),
        '',
        [esc('Summe'), '', '', esc(rows.reduce((s, r) => s + r.itemPrice, 0).toFixed(2).replace('.', ',')), esc(`${rows.length} Verkäufe`)].join(';'),
      ];
      return new Response('﻿' + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cssberlin-einkommensbericht-${year}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const [sales, purchases, years] = await Promise.all([
      prisma.order.findMany({
        where: { sellerId: me },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, status: true, itemPrice: true, paymentMethod: true, createdAt: true, completedAt: true, product: { select: { title: true } } },
      }),
      prisma.order.findMany({
        where: { buyerId: me },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, status: true, totalAmount: true, paymentMethod: true, createdAt: true, product: { select: { title: true } } },
      }),
      prisma.order.findMany({ where: { sellerId: me, status: 'COMPLETED' }, select: { completedAt: true } }),
    ]);

    const online = (m: string | null) => m !== 'pickup_cash';
    const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

    const pending = sum(sales.filter((o) => online(o.paymentMethod) && (SOLD_PENDING as readonly string[]).includes(o.status)).map((o) => o.itemPrice));
    const available = sum(sales.filter((o) => online(o.paymentMethod) && o.status === 'COMPLETED').map((o) => o.itemPrice));
    const cash = sum(sales.filter((o) => !online(o.paymentMethod) && o.status === 'COMPLETED').map((o) => o.itemPrice));

    const transactions = [
      ...sales.map((o) => ({ id: o.id, kind: 'Verkauft' as const, title: o.product.title, amount: o.itemPrice, status: o.status, cash: !online(o.paymentMethod), date: o.completedAt ?? o.createdAt, href: `/sales/${o.id}` })),
      ...purchases.map((o) => ({ id: o.id, kind: 'Gekauft' as const, title: o.product.title, amount: -o.totalAmount, status: o.status, cash: !online(o.paymentMethod), date: o.createdAt, href: `/purchases/${o.id}` })),
    ]
      .filter((t) => t.status !== 'PENDING_PAYMENT')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100);

    const incomeYears = Array.from(new Set(years.map((y) => y.completedAt?.getUTCFullYear()).filter(Boolean) as number[])).sort((a, b) => b - a);

    return ApiResponse.success({ pending, available, cash, payoutsEnabled: stripeConfigured(), transactions, incomeYears });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('GET /api/wallet error:', error);
    return ApiResponse.serverError();
  }
}
