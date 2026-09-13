/** Local SVG placeholders — no external CDN (works offline). */
export function productImage(label: string, hue = 255): string {
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},52%,18%)"/>
      <stop offset="55%" stop-color="hsl(${(hue + 28) % 360},48%,28%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 55) % 360},62%,38%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="640" cy="120" r="90" fill="rgba(255,255,255,0.06)"/>
  <circle cx="120" cy="480" r="140" fill="rgba(255,255,255,0.05)"/>
  <rect x="80" y="180" width="640" height="240" rx="24" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <text x="400" y="290" fill="rgba(255,255,255,0.95)" font-family="Inter,system-ui,sans-serif" font-size="32" font-weight="700" text-anchor="middle">${safe}</text>
  <text x="400" y="335" fill="rgba(255,255,255,0.55)" font-family="Inter,system-ui,sans-serif" font-size="16" font-weight="500" text-anchor="middle">SERVER-PRICE</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
