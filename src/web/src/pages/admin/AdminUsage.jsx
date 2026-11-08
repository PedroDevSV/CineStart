import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState, PageLoader } from '../../components/States.jsx';
import ChartCard, { ChartTooltip, LegendItem } from './ChartCard.jsx';
import PeriodPicker from './PeriodPicker.jsx';
import { C, axisProps } from './chartTheme.js';
import * as api from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { num, pct } from '../../lib/format.js';

export default function AdminUsage() {
  useDocumentTitle('Panel · Uso');
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAsync(() => api.adminGetUsage({ days }), [days]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageLoader />;
  const funnelMax = Math.max(1, data.funnel[0]?.value ?? 1);
  const per = days > 31 ? 'Por semana' : 'Por día';

  return (
    <div className={loading ? 'admin-page is-loading' : 'admin-page'}>
      <header className="admin-head">
        <div>
          <p className="eyebrow">Panel de administración</p>
          <h1 className="page-title">Uso de la aplicación</h1>
          <p className="muted">Para detectar problemas en el registro y el onboarding.</p>
        </div>
        <PeriodPicker value={days} onChange={setDays} />
      </header>

      <ul className="kpis kpis--compact">
        <li className="kpi">
          <span className="kpi__label">Registros</span>
          <span className="kpi__value">{num(data.totals.registrations)}</span>
          <span className="kpi__def">en los últimos {days} días</span>
        </li>
        <li className="kpi">
          <span className="kpi__label">Onboarding completado</span>
          <span className="kpi__value">{pct(data.onboarding_completion)}</span>
          <span className="kpi__def">de los registrados valoró 3 películas o más</span>
        </li>
        <li className="kpi">
          <span className="kpi__label">Valoraciones</span>
          <span className="kpi__value">{num(data.totals.ratings)}</span>
          <span className="kpi__def">{num(data.totals.dismissals)} descartes en el mismo periodo</span>
        </li>
        <li className="kpi">
          <span className="kpi__label">Cuentas activas</span>
          <span className="kpi__value">{num(data.totals.active_users)}</span>
          <span className="kpi__def">sin contar administradores</span>
        </li>
      </ul>

      <div className="acards">
        <section className="acard" aria-labelledby="funnel">
          <header className="acard__head">
            <div>
              <h2 id="funnel" className="acard__title">
                Embudo de nuevos usuarios
              </h2>
              <p className="acard__sub">Usuarios registrados en el periodo que llegan a cada paso</p>
            </div>
          </header>
          <ol className="funnel">
            {data.funnel.map((f, i) => (
              <li key={f.step} className="funnel__row">
                <span className="funnel__label">{f.step}</span>
                <span className="funnel__bar" aria-hidden="true">
                  <span style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                </span>
                <span className="funnel__val">
                  {num(f.value)}
                  {i > 0 ? <span className="subtle"> · {pct(f.value / funnelMax)}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <ChartCard
          title="Registros"
          subtitle={per}
          table={{ columns: [{ key: 'label', label: 'Periodo' }, { key: 'registrations', label: 'Registros' }], rows: data.series }}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip cursor={{ fill: 'rgba(243,238,230,0.05)' }} content={<ChartTooltip />} />
              <Bar dataKey="registrations" name="Registros" fill={C.s1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="acard--wide"
          title="Valoraciones y descartes"
          subtitle={per}
          legend={
            <>
              <LegendItem color={C.s1} label="Valoraciones" />
              <LegendItem color={C.s2} label="Descartes" />
            </>
          }
          table={{
            columns: [
              { key: 'label', label: 'Periodo' },
              { key: 'ratings', label: 'Valoraciones' },
              { key: 'dismissals', label: 'Descartes' },
            ],
            rows: data.series,
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip cursor={{ stroke: C.axis, strokeDasharray: '3 3' }} content={<ChartTooltip />} />
              <Line type="monotone" dataKey="ratings" name="Valoraciones" stroke={C.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: C.surface, strokeWidth: 2 }} />
              <Line type="monotone" dataKey="dismissals" name="Descartes" stroke={C.s2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: C.surface, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
