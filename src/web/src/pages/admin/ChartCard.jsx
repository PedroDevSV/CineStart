import { useId, useState } from 'react';

/**
 * Tarjeta de gráfico con alternativa en tabla (accesibilidad: el dato nunca depende solo del color).
 * `table`: { columns: [{ key, label, format? }], rows: [] }
 */
export default function ChartCard({ title, subtitle, legend, table, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section className={`acard ${className}`} aria-labelledby={id}>
      <header className="acard__head">
        <div>
          <h2 id={id} className="acard__title">
            {title}
          </h2>
          {subtitle ? <p className="acard__sub">{subtitle}</p> : null}
        </div>
        {table ? (
          <button type="button" className="btn btn--sm btn--ghost" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
            {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        ) : null}
      </header>
      {legend && !asTable ? <div className="acard__legend">{legend}</div> : null}
      {asTable && table ? (
        <div className="atable-wrap atable-wrap--scroll">
          <table className="atable">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td key={c.key}>{c.format ? c.format(r[c.key], r) : r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="acard__body">{children}</div>
      )}
    </section>
  );
}

export function LegendItem({ color, label }) {
  return (
    <span className="legend-item">
      <span className="legend-item__swatch" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

export function ChartTooltip({ active, payload, label, format = (v) => v, labelFormat = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ctip">
      <p className="ctip__label">{labelFormat(label, payload[0]?.payload)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="ctip__row">
          <span className="legend-item__swatch" style={{ background: p.color || p.fill }} aria-hidden="true" />
          <span className="ctip__name">{p.name}</span>
          <span className="ctip__val">{format(p.value, p)}</span>
        </p>
      ))}
    </div>
  );
}
