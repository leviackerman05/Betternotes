export interface MenuAnchor {
  top: number;
  bottom: number;
  left: number;
}

export function positionMenuInViewport(
  anchor: MenuAnchor,
  size: { width: number; height: number },
  margin = 8
): { top: number; left: number } {
  let top = anchor.bottom + 4;
  if (top + size.height > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - size.height - 4);
  }

  let left = anchor.left;
  if (left + size.width > window.innerWidth - margin) {
    left = window.innerWidth - size.width - margin;
  }
  left = Math.max(margin, left);

  return { top, left };
}
