export const refusalResponse = (
  status: number,
  error: string,
  details: Record<string, number> = {},
  headers: Record<string, string> = {},
) =>
  Response.json(
    { error, ...details },
    { status, headers: { 'cache-control': 'no-store', ...headers } },
  );

export const needsAccount = () => refusalResponse(401, 'needsAccount');
