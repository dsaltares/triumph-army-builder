import { Path, Rect, Svg } from '@react-pdf/renderer';
import { encodeQr } from '@/lib/qr/qr-code';

const paper = '#ffffff';
const ink = '#000000';

export function SheetQr({ url, size }: { url: string; size: number }) {
  const qr = encodeQr(url);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`}>
      <Rect x={0} y={0} width={qr.size} height={qr.size} fill={paper} />
      <Path d={qr.path} fill={ink} />
    </Svg>
  );
}
