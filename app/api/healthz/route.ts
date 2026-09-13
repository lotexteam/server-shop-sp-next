/** Healthcheck для docker-compose (был /healthz через nginx, теперь Route Handler). */
export async function GET() {
  return Response.json({ status: "ok" });
}
