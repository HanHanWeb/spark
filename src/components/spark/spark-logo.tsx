export function SparkLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Spark logo"
    >
      <defs>
        <linearGradient
          id="spark-gradient"
          x1="6"
          y1="58"
          x2="58"
          y2="6"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ec4899" />
          <stop offset="0.5" stopColor="#a855f7" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#spark-gradient)" />
      <path d="M35.5 8 13.5 38.5H29l-3.5 17L47.5 25H32z" fill="#fff" />
    </svg>
  );
}
