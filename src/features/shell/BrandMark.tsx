export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect width="32" height="32" rx="9" fill="#25A66A" />
      <path d="M9 10.5h14M16 10.5v12" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M19.5 20.5l2.6-2.6 2.4 2.4" stroke="#DDF5E7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
