import { AlertTriangle, Check, CreditCard, PackageCheck, Truck, Undo2 } from 'lucide-react';
import { getOrderTimeline } from '@/lib/utils/condition-map';

/**
 * The four states an order walks through, drawn as a connected rail.
 *
 * The step data already existed (getOrderTimeline in lib/utils/condition-map);
 * what it was rendered as was four identical check circles floating in a
 * column, which reads as a list, not a progression. A reader could not tell
 * where the order stood without reading every line.
 *
 * The connector is drawn per row, from that row's marker down to the bottom of
 * the row, and the last row draws none. It therefore takes its length from the
 * content instead of from a fixed per-step height - a step whose description
 * wraps to two lines stretches its own segment. A single full-height rail would
 * need a hard-coded row height, which is exactly the kind of magic number that
 * breaks the moment a label wraps.
 *
 * Terminal states (DISPUTED / CANCELLED / REFUNDED) are not a fifth step. They
 * are an exit from the rail, so they get their own notice underneath instead of
 * being squeezed into a sequence they do not belong to.
 */

const STEP_ICONS = {
  payment: CreditCard,
  shipment: Truck,
  delivery: PackageCheck,
  completion: Check,
} as const;

const TERMINAL_NOTICES: Record<string, { icon: typeof AlertTriangle; text: string }> = {
  DISPUTED: {
    icon: AlertTriangle,
    text: 'Für diese Bestellung ist ein Streitfall offen. Der Ablauf pausiert, bis er geklärt ist.',
  },
  CANCELLED: {
    icon: Undo2,
    text: 'Diese Bestellung wurde storniert.',
  },
  REFUNDED: {
    icon: Undo2,
    text: 'Der Betrag wurde erstattet. Die Bestellung ist damit beendet.',
  },
};

type OrderTimelineProps = {
  status: string;
  /** Shown under the first step - the only moment we actually store a time for. */
  createdAt?: string | Date;
  /** Rendered under the current step, e.g. a tracking code. */
  activeDetail?: React.ReactNode;
};

export default function OrderTimeline({ status, createdAt, activeDetail }: OrderTimelineProps) {
  const steps = getOrderTimeline(status);
  const terminal = TERMINAL_NOTICES[status];
  const lastReachedIndex = steps.reduce(
    (acc, step, i) => (step.completed || step.active ? i : acc),
    -1
  );

  return (
    <div>
      <ol>
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.key as keyof typeof STEP_ICONS] ?? Check;
          const reached = step.completed || step.active;

          return (
            <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-8 bottom-0 w-0.5"
                  style={{
                    // Green only while the progression has actually reached
                    // past this point; an unreached gap stays grey so the eye
                    // can find the current step without reading labels.
                    background:
                      index < lastReachedIndex ? 'var(--color-primary)' : 'var(--color-border)',
                    opacity: index < lastReachedIndex && terminal ? 0.35 : 1,
                  }}
                />
              ) : null}
              <span
                className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                style={
                  step.completed
                    ? {
                        background: 'var(--color-primary)',
                        borderColor: 'var(--color-primary)',
                        color: '#FFFFFF',
                      }
                    : step.active
                      ? {
                          background: 'var(--color-bg-card)',
                          borderColor: 'var(--color-primary)',
                          color: 'var(--color-primary)',
                        }
                      : {
                          background: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-muted)',
                        }
                }
              >
                <Icon size={15} />
              </span>

              <div className="min-w-0 pt-0.5">
                <p
                  className="font-semibold"
                  style={{ color: reached ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                >
                  {step.label}
                  {step.active ? (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: 'var(--color-primary-50)',
                        color: 'var(--color-primary-dark)',
                      }}
                    >
                      Aktuell
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {step.description}
                </p>

                {index === 0 && createdAt ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(createdAt).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                ) : null}

                {step.active && activeDetail ? <div className="mt-2">{activeDetail}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {terminal ? (
        <div
          className="mt-2 flex items-start gap-3 rounded-2xl border p-4 text-sm"
          style={{
            borderColor: 'var(--color-orange)',
            background: 'var(--color-orange-50)',
            color: 'var(--color-text)',
          }}
        >
          <terminal.icon size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-orange-dark)' }} />
          <p>{terminal.text}</p>
        </div>
      ) : null}
    </div>
  );
}
