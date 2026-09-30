'use client';

import { useMemo } from 'react';
import { encodeQr } from '@/lib/qr/qr-code';

const paper = '#ffffff';
const ink = '#000000';

export function ListQr({ url, size = 132 }: { url: string; size?: number }) {
  const qr = useMemo(() => encodeQr(url), [url]);
  return (
    <svg
      role="img"
      aria-label={`QR code for ${url}`}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="rounded-sm border border-border"
    >
      <rect width={qr.size} height={qr.size} fill={paper} />
      <path d={qr.path} fill={ink} />
    </svg>
  );
}
