import type { CSSProperties } from 'react';
import type { CustomerDocument, DocLine } from '../../domain/customerDocument';

/**
 * The customer-facing quote. Renders only the CustomerDocument model; all
 * user text is rendered as React text nodes (escaped), never as raw HTML.
 */
export function QuoteDocument({ doc }: { doc: CustomerDocument }) {
  const style = { '--doc-brand': doc.brandColor, '--doc-brand-text': doc.brandTextColor, '--doc-brand-ink': doc.brandInk } as CSSProperties;
  return (
    <article className={`qdoc qdoc--${doc.paperSize}`} style={style} aria-label={`${doc.documentTitle} preview`}>
      <div className="qdoc__bar" aria-hidden />
      {doc.isSample && <p className="qdoc__sample">Sample data — fictional business, for demonstration only</p>}

      <header className="qdoc__header">
        <div className="qdoc__from">
          {doc.business.logoDataUrl && <img className="qdoc__logo" src={doc.business.logoDataUrl} alt={`${doc.business.name} logo`} />}
          <p className="qdoc__business">{doc.business.name}</p>
          {doc.business.address && <p className="qdoc__muted qdoc__pre">{doc.business.address}</p>}
          {doc.business.contactLines.map((l) => (
            <p key={l} className="qdoc__muted">
              {l}
            </p>
          ))}
        </div>
        <div className="qdoc__heading">
          <p className="qdoc__doc-title">{doc.documentTitle}</p>
          <dl className="qdoc__meta">
            {doc.meta.map((m) => (
              <div key={m.label}>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {(doc.customer || doc.serviceAddress) && (
        <section className="qdoc__parties">
          {doc.customer && (
            <div>
              <h3 className="qdoc__label">{doc.customer.heading}</h3>
              {doc.customer.lines.map((l, i) => (
                <p key={`${i}-${l}`} className={i === 0 ? 'qdoc__strong' : undefined}>
                  {l}
                </p>
              ))}
            </div>
          )}
          {doc.serviceAddress && (
            <div>
              <h3 className="qdoc__label">Service address</h3>
              <p className="qdoc__pre">{doc.serviceAddress}</p>
            </div>
          )}
        </section>
      )}

      {doc.title && <h2 className="qdoc__title">{doc.title}</h2>}
      {doc.scope && (
        <section className="qdoc__block">
          <h3 className="qdoc__label">Scope of work</h3>
          <p className="qdoc__pre">{doc.scope}</p>
        </section>
      )}

      {doc.lines.length > 0 ? (
        <ItemsTable lines={doc.lines} showQuantities={doc.showQuantities} />
      ) : (
        <p className="qdoc__empty">No items have been added to this quote yet.</p>
      )}

      <div className="qdoc__summary">
        <dl className="qdoc__totals">
          {doc.totals.map((r) => (
            <div key={r.key} className={`qdoc__trow qdoc__trow--${r.kind}`}>
              <dt>
                {r.label}
                {r.note && <span className="qdoc__tnote">{r.note}</span>}
              </dt>
              <dd>{r.value}</dd>
            </div>
          ))}
          <div className="qdoc__trow qdoc__trow--total">
            <dt>{doc.total.label}</dt>
            <dd>{doc.total.value}</dd>
          </div>
          {doc.afterTotal.map((r) => (
            <div key={r.key} className="qdoc__trow qdoc__trow--info">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
        {doc.deposit && (
          <dl className="qdoc__deposit">
            <div>
              <dt>{doc.deposit.depositLabel}</dt>
              <dd>{doc.deposit.deposit}</dd>
            </div>
            <div>
              <dt>{doc.deposit.balanceLabel}</dt>
              <dd>{doc.deposit.balance}</dd>
            </div>
          </dl>
        )}
      </div>

      {doc.optionalLines.length > 0 && (
        <section className="qdoc__block qdoc__optional">
          <h3 className="qdoc__label">Optional extras</h3>
          <ItemsTable lines={doc.optionalLines} showQuantities={doc.showQuantities} />
          <p className="qdoc__muted qdoc__small">{doc.optionalNote}</p>
        </section>
      )}

      {doc.sections.map((s) => (
        <section key={s.key} className="qdoc__block qdoc__keep">
          <h3 className="qdoc__label">{s.title}</h3>
          <p className="qdoc__pre">{s.body}</p>
        </section>
      ))}

      {doc.showSignature && (
        <section className="qdoc__signature qdoc__keep">
          <h3 className="qdoc__label">Customer acceptance</h3>
          <div className="qdoc__sign-fields">
            {['Name', 'Signature', 'Date'].map((f) => (
              <div key={f} className="qdoc__sign-field">
                <span className="qdoc__sign-line" />
                <span className="qdoc__muted qdoc__small">{f}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {doc.footer && <footer className="qdoc__footer">{doc.footer}</footer>}
    </article>
  );
}

function ItemsTable({ lines, showQuantities }: { lines: DocLine[]; showQuantities: boolean }) {
  return (
    <table className="qdoc__table">
      <thead>
        <tr>
          <th scope="col">Description</th>
          {showQuantities && (
            <>
              <th scope="col" className="qdoc__num">
                Qty
              </th>
              <th scope="col" className="qdoc__num">
                Unit price
              </th>
            </>
          )}
          <th scope="col" className="qdoc__num">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key}>
            <td>
              <span className="qdoc__item">{l.name}</span>
              {l.description && <span className="qdoc__item-desc qdoc__pre">{l.description}</span>}
              {l.note && <span className="qdoc__item-note">{l.note}</span>}
            </td>
            {showQuantities && (
              <>
                <td className="qdoc__num">{l.quantity}</td>
                <td className="qdoc__num">{l.unitPrice}</td>
              </>
            )}
            <td className="qdoc__num qdoc__strong">{l.amount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
