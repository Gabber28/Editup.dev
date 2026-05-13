let nextId = 1;

export class PseudoPreviewManager {
  private styleEl: HTMLStyleElement | null = null;
  private rules = new Map<Element, { attr: string; entries: Map<string, Map<string, string>> }>();

  private ensureStyleEl(): HTMLStyleElement {
    if (!this.styleEl) {
      const el = document.createElement("style");
      el.id = "editup-pseudo-preview";
      document.head.appendChild(el);
      this.styleEl = el;
    }
    return this.styleEl;
  }

  private getOrCreateEntry(el: Element): { attr: string; entries: Map<string, Map<string, string>> } {
    let rec = this.rules.get(el);
    if (rec) return rec;
    const attr = `ep-${nextId++}`;
    el.setAttribute("data-editup-ps", attr);
    rec = { attr, entries: new Map() };
    this.rules.set(el, rec);
    return rec;
  }

  preview(el: Element, pseudo: string, property: string, value: string): void {
    const rec = this.getOrCreateEntry(el);
    let props = rec.entries.get(pseudo);
    if (!props) {
      props = new Map();
      rec.entries.set(pseudo, props);
    }
    props.set(property, value);
    this.rebuild();
  }

  resetAll(): void {
    for (const [el, rec] of this.rules) {
      el.removeAttribute("data-editup-ps");
      void rec;
    }
    this.rules.clear();
    if (this.styleEl) this.styleEl.textContent = "";
  }

  resetElement(el: Element): void {
    const rec = this.rules.get(el);
    if (!rec) return;
    el.removeAttribute("data-editup-ps");
    this.rules.delete(el);
    this.rebuild();
  }

  private rebuild(): void {
    const style = this.ensureStyleEl();
    const lines: string[] = [];
    for (const [, rec] of this.rules) {
      for (const [pseudo, props] of rec.entries) {
        const decls = Array.from(props.entries())
          .map(([p, v]) => `${p}: ${v} !important`)
          .join("; ");
        lines.push(`[data-editup-ps="${rec.attr}"]${pseudo} { ${decls}; }`);
      }
    }
    style.textContent = lines.join("\n");
  }
}
