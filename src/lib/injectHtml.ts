/** Insert admin-trusted HTML. Recreates <script> so browsers actually run it. */
export function setHtmlWithScripts(host: HTMLElement, html: string) {
  host.innerHTML = "";
  if (!html.trim()) return;
  for (const node of materialize(html)) {
    host.appendChild(node);
  }
}

const HEAD_ATTR = "data-cms-head-snippet";

function materialize(html: string): Node[] {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const out: Node[] = [];
  tpl.content.childNodes.forEach((node) => {
    if (node instanceof HTMLScriptElement) {
      out.push(cloneScript(node));
      return;
    }
    if (node instanceof HTMLElement) {
      node.querySelectorAll("script").forEach((old) => {
        const s = cloneScript(old);
        old.replaceWith(s);
      });
    }
    out.push(node);
  });
  return out;
}

function cloneScript(old: HTMLScriptElement): HTMLScriptElement {
  const s = document.createElement("script");
  for (const attr of Array.from(old.attributes)) {
    s.setAttribute(attr.name, attr.value);
  }
  s.text = old.textContent || "";
  return s;
}

export function syncHeadSnippets(
  snippets: Array<{ id: string; html: string; enabled?: boolean }>,
) {
  document.head.querySelectorAll(`[${HEAD_ATTR}]`).forEach((el) => el.remove());
  for (const sn of snippets) {
    if (sn.enabled === false || !sn.html.trim()) continue;
    for (const node of materialize(sn.html)) {
      if (node instanceof HTMLElement) {
        node.setAttribute(HEAD_ATTR, sn.id);
      }
      document.head.appendChild(node);
    }
  }
}
