// The landing's logo mark (same SVG as the site header).
export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`brand-mark shrink-0 ${className}`}>
      <rect x="2.5" y="2.5" width="27" height="27" rx="5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M8.5 10.5h15M8.5 15.5h9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="8.5" y="20" width="11" height="5" rx="1.5" fill="#3ce8ff" />
    </svg>
  );
}
