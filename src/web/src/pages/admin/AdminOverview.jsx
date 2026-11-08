import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Icon from '../../components/Icon.jsx';
import Poster from '../../components/Poster.jsx';
import { ErrorState, PageLoader } from '../../components/States.jsx';
import ChartCard, { ChartTooltip, LegendItem } from './ChartCard.jsx';
import PeriodPicker from './PeriodPicker.jsx';
import { C, axisProps, pctTicks } from './chartTheme.js';
import * as api from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { genreName } from '../../lib/genres.js';
import { num, pct, year } from '../../lib/format.js';

const KPIS = [
  {
    key: 'coverage',
    label: 'Cobertura',
    icon: 'grid',
    def: 'Películas distintas recomendadas alguna vez / películas del catálogo.',
  },
  {
    key: 'diversity',
    label: 'Diversidad',
    icon: 'sparkle',
    def: '1 − parecido medio de géneros entre las películas de cada top-10.',
  },
  {
    key: 'novelty',
    label: 'Novedad',
    icon: 'gem',
    def: 'Parte de las recomendaciones que son de cola larga (pocos votos).',
  },
  {
    key: 'acceptance',
    label: 'Aceptación',
    icon: 'check',
    def: 'Valoraciones de 4★ o más sobre películas recomendadas / (valoraciones + descartes).',
  },
];

export default function AdminOverview() {
  useDocumentTitle('Panel · Resumen');
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useAsync(() => api.adminGetKpis({ days }), [days]);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageLoader />;

  return (
    <div className={loading ? 'admin-page is-loading' : 'admin-page'}>
      <header className="admin-head">
        <div>
          <p className="eyebrow">Panel de administración</p>
          <h1 className="page-title">¿Funciona el recomendador?</h1>
          <p className="muted">
            {num(data.recommendations_served)} recomendaciones servidas en los últimos {days} días · modelo{' '}
            <code className="code">{data.model_version}</code>
          </p>
        </div>
        <PeriodPicker value={days} onChange={setDays} />
      </header>

      <ul className="kpis">
        {KPIS.map((k) => {
          const v = data.kpis[k.key];
          const delta = v.previous !== null && v.previous !== undefined ? v.value - v.previous : null;
          return (
            <li key={k.key} className="kpi">
              <div className="kpi__top">
                <span className="kpi__label">{k.label}</span>
                <span className="kpi__icon" aria-hidden="true">
                  <Icon name={k.icon} size={16} />
                </span>
              </div>
              <span className="kpi__value">{pct(v.value)}</span>
              {delta !== null ? (
                <span className={delta >= 0 ? 'kpi__delta is-up' : 'kpi__delta is-down'}>
                  <span aria-hidden="true">{delta >= 0 ? '▲' : '▼'}</span> {(Math.abs(delta) * 100).toFixed(1).replace('.', ',')} pts
                  <span className="subtle"> frente a los {days} días anteriores</span>
                </span>
              ) : (
                <span className="kpi__delta subtle">Sin periodo anterior para comparar</span>
              )}
              <p className="kpi__def">{k.def}</p>
            </li>
          );
        })}
      </ul>

      <div className="acards">
        <ChartCard
          className="acard--wide"
          title="Aceptación de las recomendaciones"
          subtitle={days > 31 ? 'Por semana' : 'Por día'}
          table={{
            columns: [
              { key: 'label', label: 'Periodo' },
              { key: 'value', label: 'Aceptación', format: (v) => pct(v) },
              { key: 'n', label: 'Respuestas' },
            ],
            rows: data.acceptance_series,
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.acceptance_series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)} %`} width={56} />
              <Tooltip
                cursor={{ stroke: C.axis, strokeDasharray: '3 3' }}
                content={<ChartTooltip format={(v, p) => `${pct(v)} (${p.payload.n} respuestas)`} />}
              />
              <Line type="monotone" dataKey="value" name="Aceptación" stroke={C.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: C.surface, strokeWidth: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Qué géneros se recomiendan"
          subtitle="Recomendaciones por género principal"
          table={{
            columns: [
              { key: 'genre_id', label: 'Género', format: (g) => genreName(g) },
              { key: 'count', label: 'Recomendaciones', format: num },
            ],
            rows: data.recs_by_genre,
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.recs_by_genre.map((r) => ({ ...r, name: genreName(r.genre_id) }))} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" {...axisProps} width={110} />
              <Tooltip cursor={{ fill: 'rgba(243,238,230,0.05)' }} content={<ChartTooltip format={num} />} />
              <Bar dataKey="count" name="Recomendaciones" fill={C.s1} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Visibilidad por grupo de películas"
          subtitle="Peso de cada grupo de K-means en el catálogo y en lo recomendado"
          legend={
            <>
              <LegendItem color={C.s1} label="Catálogo" />
              <LegendItem color={C.s2} label="Recomendado" />
            </>
          }
          table={{
            columns: [
              { key: 'cluster', label: 'Grupo' },
              { key: 'catalog', label: '% del catálogo', format: pct },
              { key: 'recommended', label: '% de lo recomendado', format: pct },
            ],
            rows: data.clusters,
          }}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.clusters} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="cluster" {...axisProps} />
              <YAxis
                {...axisProps}
                ticks={pctTicks(data.clusters.flatMap((c) => [c.catalog, c.recommended]))}
                domain={[0, 'dataMax']}
                tickFormatter={(v) => `${Math.round(v * 100)} %`}
                width={52}
              />
              <Tooltip cursor={{ fill: 'rgba(243,238,230,0.05)' }} content={<ChartTooltip format={pct} labelFormat={(l) => `Grupo ${l}`} />} />
              <Bar dataKey="catalog" name="Catálogo" fill={C.s1} radius={[4, 4, 0, 0]} />
              <Bar dataKey="recommended" name="Recomendado" fill={C.s2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="acard" aria-labelledby="top-recs">
          <header className="acard__head">
            <div>
              <h2 id="top-recs" className="acard__title">
                Las más recomendadas
              </h2>
              <p className="acard__sub">En los últimos {days} días</p>
            </div>
          </header>
          <ol className="toplist">
            {data.top_recommended.map((m, i) => (
              <li key={m.id} className="toplist__item">
                <span className="toplist__n">{i + 1}</span>
                <Poster movie={m} size="sm" decorative className="toplist__poster" />
                <span className="toplist__text">
                  <span className="toplist__title">{m.title}</span>
                  <span className="toplist__meta">
                    {year(m.release_date)} · {genreName(m.genre_ids?.[0])}
                  </span>
                </span>
                <span className="toplist__val">{num(m.times_recommended)}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="acol">
          <ChartCard
            title="Notas a las películas recomendadas"
            subtitle="Cuántas estrellas reciben cuando el usuario las valora"
            table={{
              columns: [
                { key: 'stars', label: 'Estrellas' },
                { key: 'count', label: 'Valoraciones', format: num },
              ],
              rows: data.ratings_distribution,
            }}
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.ratings_distribution.map((d) => ({ ...d, name: `${d.stars} ★` }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} width={40} />
                <Tooltip cursor={{ fill: 'rgba(243,238,230,0.05)' }} content={<ChartTooltip format={num} />} />
                <Bar dataKey="count" name="Valoraciones" fill={C.s1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="acard acard--callout" aria-labelledby="never">
            <span className="acard__callout-icon" aria-hidden="true">
              <Icon name="eyeOff" size={22} />
            </span>
            <div>
              <h2 id="never" className="acard__title">
                {num(data.never_recommended)} películas sin recomendar
              </h2>
              <p className="acard__sub">
                {pct(data.never_recommended / data.catalog_size)} del catálogo no ha aparecido en ningún top-10 en los últimos {days} días.
              </p>
            </div>
            <Link to="/admin/catalogo?nunca=1" className="btn">
              Revisarlas <Icon name="arrowRight" size={16} />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
