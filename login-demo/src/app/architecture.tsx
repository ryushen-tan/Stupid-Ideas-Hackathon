export function Architecture() {
  return (
    <div className="architecture" aria-hidden="true">
      <div className="architecture-light" />
      <svg viewBox="0 0 1000 1100" preserveAspectRatio="xMidYMid slice" className="tunnel">
        <defs>
          <linearGradient id="arch" x1="0" y1="0" x2="1" y2="0.7">
            <stop offset="0" stopColor="#355b6d" />
            <stop offset="0.42" stopColor="#9bbbc3" />
            <stop offset="0.75" stopColor="#c4d9d8" />
            <stop offset="1" stopColor="#507481" />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#a6c4cb" /><stop offset="1" stopColor="#335b70" />
          </linearGradient>
          <filter id="shadow"><feDropShadow dx="-12" dy="10" stdDeviation="10" floodColor="#173d50" floodOpacity="0.45" /></filter>
        </defs>
        <rect width="1000" height="1100" fill="#a6c7ce" />
        <path d="M0 720 500 520 1000 720V1100H0Z" fill="url(#floor)" />
        {Array.from({ length: 10 }, (_, index) => {
          const scale = Math.pow(0.82, index);
          return <g key={index} transform={`translate(${500 - 500 * scale}, ${530 - 530 * scale}) scale(${scale})`}>
            <path d="M-180 1130V340C-180-270 1180-270 1180 340V1130H1010V340C1010-50-10-50-10 340V1130Z" fill="url(#arch)" stroke="#547b8a" strokeWidth="2" filter="url(#shadow)" />
            <path d="M-10 1100V340C-10-50 1010-50 1010 340V1100" fill="none" stroke="#d5e5df" strokeOpacity=".45" strokeWidth="3" />
          </g>;
        })}
      </svg>
      <div className="orbital"><div className="chrome-ring" /><div className="ring-shadow" /></div>
      <div className="scene-grain" />
    </div>
  );
}
