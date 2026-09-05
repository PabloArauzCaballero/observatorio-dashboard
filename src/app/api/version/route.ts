/**
 * When this process started, so a deployment can tell that it happened.
 *
 * A deploy that changes no page renders byte-identical output, so nothing in
 * the HTML distinguishes the new container from the one it replaced; and asking
 * Coolify how its deployment went needs an API token with read permission,
 * which the deploy credential does not carry. What does distinguish them is
 * that a redeploy restarts the process: a start time later than the moment the
 * deploy was requested can only belong to the container that deploy created.
 */

export const dynamic = 'force-dynamic';

/** Fixed when the module is first evaluated, which is process start. */
const STARTED_AT = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();

export function GET(): Response {
  return Response.json(
    { startedAt: STARTED_AT, uptimeSeconds: Math.round(process.uptime()) },
    { headers: { 'cache-control': 'no-store' } },
  );
}
