const OPTIONS = [
  { v: 7, label: '7 días' },
  { v: 30, label: '30 días' },
  { v: 90, label: '90 días' },
];

export default function PeriodPicker({ value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Periodo">
      {OPTIONS.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
