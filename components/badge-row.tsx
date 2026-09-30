import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function BadgeRow({
  labels,
  warning = null,
  className,
}: {
  labels: readonly (string | null | false)[];
  warning?: string | null | false;
  className?: string;
}) {
  const shown = labels.filter((label): label is string => Boolean(label));
  if (shown.length === 0 && !warning) {
    return null;
  }
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
      {warning && <Badge variant="destructive">{warning}</Badge>}
    </div>
  );
}
