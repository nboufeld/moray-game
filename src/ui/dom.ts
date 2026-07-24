/**
 * The HUD and panels are authored in `index.html` rather than built at runtime,
 * so every controller looks its nodes up by id and fails loudly if the markup
 * and the controller have drifted apart.
 */
export function requireElement(root: Document, id: string): HTMLElement {
  const element = root.getElementById(id);
  if (!element) {
    throw new Error(`Missing UI element #${id}`);
  }
  return element;
}
