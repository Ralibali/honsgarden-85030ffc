import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
  className?: string;
}

/** Liten QR-renderare som ritar på canvas via qrcode-paketet. */
export default function SwishQR({ value, size = 180, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      /* ignore render errors */
    });
  }, [value, size]);

  if (!value) return null;
  return <canvas ref={ref} width={size} height={size} className={className} aria-label="Swish QR-kod" />;
}
