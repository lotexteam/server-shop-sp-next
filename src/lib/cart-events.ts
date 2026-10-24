export const OPEN_CART_EVENT = "server-price:open-cart";

export function openCartDrawer() {
  window.dispatchEvent(new Event(OPEN_CART_EVENT));
}
