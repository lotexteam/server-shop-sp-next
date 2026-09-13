/** Fallback при ожидании серверного рендера — как Suspense-fallback в router.tsx SPA. */
export default function Loading() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}
