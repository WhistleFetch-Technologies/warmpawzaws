/**
 * Turn raw API/Lambda errors into actionable copy for local dev.
 */
export function formatCustomerApiError(message: string | undefined | null): string {
  const msg = String(message || 'Something went wrong').trim();
  if (
    /database connection timeout|connection refused|ECONNREFUSED|ENOTFOUND|DB_SECRET_ARN|database connection failed/i.test(
      msg
    )
  ) {
    return (
      'Search could not reach the database. Your app is probably calling http://localhost:3000 ' +
      'without a local Postgres + API running. From the repo root run: npm run dev:customer ' +
      '(uses the dev API). For a full local stack: start Postgres, run npm run start:local in backend/lambda, ' +
      'then npm run local:stack:customer.'
    );
  }
  return msg;
}
