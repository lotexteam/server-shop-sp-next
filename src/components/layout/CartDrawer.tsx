"use client";

import Link from "next/link";
import { ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "../ui/drawer";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { cartLineGoodsTotal, isLineOnRequest, useShop } from "@/store/shop";
import { formatPrice } from "@/lib/utils";
import { CartConfigurationSummary } from "@/components/cart/CartConfigurationSummary";

export function CartDrawer() {
  const { cart, cartCount, cartTotal, setQty, removeFromCart } = useShop();
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button className="relative flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary hover:text-primary" aria-label="Корзина">
          <ShoppingCart className="size-5" />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{cartCount}</span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent side="right" className="w-full max-w-md p-0">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="text-h5">Корзина <span className="text-muted-foreground">({cartCount})</span></h3>
        </div>

        {cart.length === 0 ? (
          <div className="p-5"><EmptyState icon={ShoppingCart} title="Корзина пуста" description="Добавьте оборудование из каталога, чтобы оформить заказ." action={<DrawerClose asChild><Link href="/catalog" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-sm font-semibold h-11 px-5 bg-brand-gradient text-white shadow-sm hover:brightness-105 transition-all duration-200 active:scale-[0.98]">В каталог</Link></DrawerClose>} /></div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-5 scrollbar-thin">
              {cart.map((l) => {
                const key = l.lineKey ?? l.product.id;
                return (
                <div key={key} className="flex gap-3 rounded-md border border-border p-3">
                  <img src={l.product.image} alt="" className="size-16 shrink-0 rounded-md object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-body-sm font-medium">{l.product.title}</p>
                    <CartConfigurationSummary line={l} />
                    {l.warranty?.isPaid && (
                      <p className="text-caption text-muted-foreground">{l.warranty.name}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button size="icon-sm" variant="outline" onClick={() => setQty(key, l.qty - 1)}><Minus className="size-3.5" /></Button>
                        <span className="w-8 text-center text-body-sm font-semibold">{l.qty}</span>
                        <Button size="icon-sm" variant="outline" onClick={() => setQty(key, l.qty + 1)}><Plus className="size-3.5" /></Button>
                      </div>
                      <span className="text-body-sm font-bold">
                        {isLineOnRequest(l) ? "Под заказ" : formatPrice(cartLineGoodsTotal(l))}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(key)} className="text-muted-foreground hover:text-destructive" aria-label="Удалить"><Trash2 className="size-4" /></button>
                </div>
                );
              })}
            </div>
            <div className="border-t border-border p-5">
              <div className="mb-4 flex items-center justify-between text-body">
                <span className="text-muted-foreground">Итого</span>
                <span className="text-h4 font-bold">
                  {cart.length > 0 && cart.every(isLineOnRequest)
                    ? "Под заказ"
                    : formatPrice(cartTotal)}
                </span>
              </div>
              <DrawerClose asChild><Link href="/checkout" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-sm font-semibold h-12 px-7 bg-brand-gradient text-white shadow-sm hover:brightness-105 transition-all duration-200 active:scale-[0.98] w-full">Оформить заказ</Link></DrawerClose>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
