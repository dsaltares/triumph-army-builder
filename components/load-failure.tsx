import { IconAlertTriangle } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function LoadFailure({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Alert variant="destructive">
      <IconAlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}. Reload the page — nothing you have saved is affected.
      </AlertDescription>
    </Alert>
  );
}
