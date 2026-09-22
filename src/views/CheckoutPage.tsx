"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, Truck, User, MapPin, Package, Gift, Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BonusRedeemBlock } from "@/components/checkout/BonusRedeemBlock";
import { CartConfigurationSummary } from "@/components/cart/CartConfigurationSummary";
import { RequisitesFilePicker } from "@/components/checkout/RequisitesFilePicker";
import { ConsentCheckbox } from "@/components/consent/ConsentCheckbox";
import { logConsent } from "@/lib/consent/consent";
import { isLineOnRequest, useShop } from "@/store/shop";
import { useAuth } from "@/store/auth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatPrice, cn } from "@/lib/utils";
import { VatHint } from "@/components/common/Price";
import { formatBonus, bonusWord } from "@/lib/bonuses";
import { quoteDeliveryMethod, groupDeliveryMethods } from "@/lib/commerce";
import { purchase as metricaPurchase, toMetricaProduct, clientId as metricaClientId } from "@/lib/analytics/metrica";
import {
  fetchDeliveryMethods,
  fetchPaymentMethods,
  apiCheckoutPreview,
  apiPreviewBonusSpend,
  apiValidatePromoCode,
  placeCheckout,
  quoteShipping,
  resolveCartLineProductId,
  syncLocalCartToServer,
  searchDellinCities,
  searchDellinTerminals,
  uploadOrderRequisites,
  StorefrontApiError,
  type CommerceMethod,
  type DellinCity,
  type DellinTerminal,
  type ShippingQuoteResult,
} from "@/lib/api";

export function CheckoutPage() {
  const { cart, cartTotal, clearCart, promoCode, setPromoCode } = useShop();
  const {
    isAuthenticated,
    user,
    refreshBonusBalance,
    addresses,
    legalEntities,
  } = useAuth();
  const { site } = useSiteSettings();
  const bonusesOn = site?.bonusesEnabled !== false;
  const [delivery, setDelivery] = useState<string>("");
  const [payment, setPayment] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [selectedLegalId, setSelectedLegalId] = useState<string>("");
  const [done, setDone] = useState(false);
  const [orderMeta, setOrderMeta] = useState<{
    id: string;
    redeemed: number;
    earned: number;
    grand: number;
    shipping: number;
    deliveryTitle: string;
  } | null>(null);

  const [redeemEnabled, setRedeemEnabled] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(0);
  // Потолок списания — только с сервера (группа покупателя, не константы).
  const [serverBonusMax, setServerBonusMax] = useState(0);
  const [serverBonusEarn, setServerBonusEarn] = useState(0);
  const [serverBonusEarnPercent, setServerBonusEarnPercent] = useState<number | null>(null);
  const [serverBonusPending, setServerBonusPending] = useState(false);
  const [promoInput, setPromoInput] = useState(promoCode);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Согласие 152-ФЗ (блок Б ТЗ): пусто по умолчанию, блокирует отправку формы.
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [apiMethods, setApiMethods] = useState<CommerceMethod[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<CommerceMethod[]>([]);
  const [dellinQuote, setDellinQuote] = useState<ShippingQuoteResult | null>(null);
  const [dellinLoading, setDellinLoading] = useState(false);
  const [dellinError, setDellinError] = useState<string | null>(null);
  const [dellinCityQuery, setDellinCityQuery] = useState("");
  const [dellinCities, setDellinCities] = useState<DellinCity[]>([]);
  const [dellinTerminals, setDellinTerminals] = useState<DellinTerminal[]>([]);
  const [dellinTerminalId, setDellinTerminalId] = useState("");
  const dellinQuoteSeq = useRef(0);

  useEffect(() => {
    void fetchDeliveryMethods().then(setApiMethods);
    void fetchPaymentMethods().then((list) => {
      setPaymentMethods(list);
      if (list.length && !payment) setPayment(list[0].code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);

  const cartSlugs = useMemo(
    () => [...new Set(cart.flatMap((l) => l.product.categorySlugs ?? (l.product.category ? [l.product.category] : [])))],
    [cart],
  );

  const apiMethod = apiMethods.find((m) => m.code === delivery);
  const isDellin =
    apiMethod?.driver === "dellin" ||
    delivery.startsWith("dellin");

  const methodOptions = useMemo(
    () =>
      apiMethods.map((m) => ({
        id: m.code,
        title: m.name,
        subtitle:
          m.config?.description ||
          (m.config?.payer_label &&
          (m.driver === "pickup" || m.config.payer_label !== "Бесплатно")
            ? m.config.payer_label
            : m.driver === "dellin"
              ?
              (m.config?.payer_mode === "receiver"
                ? "Оплата ТК при получении"
                : "ТК Деловые Линии")
              : ""),
        requiresAddress: m.config?.requires_address !== false && m.driver !== "pickup",
        driver: m.driver || "manual",
        payer_label: m.config?.payer_label || null,
        groupSlug: m.delivery_category?.slug || "",
        method: m,
      })),
    [apiMethods],
  );

  /**
   * Категория доставки = radio, как тип. За категорией скрыты её типы:
   * выбор категории обязан выбрать тип внутри. Типы без категории —
   * отдельные radio в том же списке. Сортировка — sort_order.
   */
  const deliveryGroups = useMemo(() => {
    const { groups, ungrouped } = groupDeliveryMethods(apiMethods);
    const byCode = new Map(methodOptions.map((m) => [m.id, m]));
    const items = [
      ...groups.map((g) => ({
        key: g.key,
        isSingle: false,
        title: g.title,
        methods: g.methods
          .map((m) => byCode.get(m.code))
          .filter((m): m is (typeof methodOptions)[number] => Boolean(m)),
        sort: g.sort,
      })),
      ...ungrouped.map((m) => {
        const opt = byCode.get(m.code);
        return {
          key: `__single:${m.code}`,
          isSingle: true,
          title: null as string | null,
          methods: opt ? [opt] : [],
          sort: Number(m.sort_order ?? 0),
        };
      }),
    ];
    return items
      .filter((g) => g.methods.length)
      .sort((a, b) => a.sort - b.sort);
  }, [apiMethods, methodOptions]);

  const selectedGroupSlug =
    methodOptions.find((m) => m.id === delivery)?.groupSlug || "";
  const topRadioValue = selectedGroupSlug
    ? `cat:${selectedGroupSlug}`
    : delivery
      ? `method:${delivery}`
      : "";

  useEffect(() => {
    if (delivery || !deliveryGroups.length) return;
    const first = deliveryGroups[0];
    if (first.methods[0]) setDelivery(first.methods[0].id);
  }, [delivery, deliveryGroups]);

  const pickDelivery = (v: string) => {
    setDelivery(v);
    setDellinQuote(null);
    setDellinError(null);
  };

  /** Выбор категории: если текущий тип не из неё — берём первый по sort_order. */
  const pickTopLevel = (v: string) => {
    if (v.startsWith("cat:")) {
      const slug = v.slice(4);
      const group = deliveryGroups.find((g) => g.key === slug);
      if (!group?.methods.length) return;
      if (!group.methods.some((m) => m.id === delivery)) {
        pickDelivery(group.methods[0].id);
      }
      return;
    }
    if (v.startsWith("method:")) {
      pickDelivery(v.slice(7));
    }
  };

  const localQuote = useMemo(() => {
    if (!apiMethod || isDellin) return null;
    return quoteDeliveryMethod(apiMethod, cartSlugs, cartTotal);
  }, [apiMethod, isDellin, cartSlugs, cartTotal]);

  const shipping = isDellin
    ? (dellinQuote?.available ? dellinQuote.price_for_order : 0)
    : localQuote
      ? localQuote.price
      : 0;
  const redeemApplied = redeemEnabled ? Math.max(0, Math.min(Number(redeemAmount) || 0, serverBonusMax)) : 0;
  const goodsAfterBonus = Math.max(0, cartTotal - redeemApplied - promoDiscount);
  const grand = goodsAfterBonus + shipping;

  useEffect(() => {
    if (!isAuthenticated) {
      setServerBonusMax(0);
      setServerBonusEarn(0);
      setServerBonusEarnPercent(null);
      setServerBonusPending(false);
      return;
    }
    let cancelled = false;
    setServerBonusPending(true);
    void apiPreviewBonusSpend(cartTotal, redeemEnabled ? redeemAmount : 0)
      .then((p) => {
        if (cancelled) return;
        setServerBonusMax(p.maxSpendablePoints);
        setServerBonusEarn(p.earnPreviewPoints);
        setServerBonusEarnPercent(p.earnPercent);
        setServerBonusPending(false);
        if (redeemAmount > p.maxSpendablePoints) setRedeemAmount(p.maxSpendablePoints);
      })
      .catch(() => {
        if (!cancelled) {
          setServerBonusMax(0);
          setServerBonusEarn(0);
          setServerBonusEarnPercent(null);
          setServerBonusPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, cartTotal, redeemEnabled, redeemAmount]);
  const promoCodeTrimmed = promoCode.trim();

  useEffect(() => {
    setPromoInput(promoCode);
  }, [promoCode]);

  const applyPromoCode = useCallback(() => {
    const code = promoInput.trim();
    if (!code) {
      setPromoCode("");
      setPromoDiscount(0);
      setPromoError(null);
      return;
    }
    void apiValidatePromoCode(code, cartTotal)
      .then((res) => {
        const discount = Math.round(Number(res.discount ?? 0));
        setPromoDiscount(discount);
        setPromoError(discount > 0 ? null : "Промокод недействителен");
        setPromoCode(discount > 0 ? code : "");
      })
      .catch(() => {
        setPromoDiscount(0);
        setPromoError("Промокод недействителен");
        setPromoCode("");
      });
  }, [promoInput, cartTotal, setPromoCode]);
  // All lines are «Под заказ» — no total to display
  const allOnRequest = cart.length > 0 && cart.every(isLineOnRequest);
  const willEarn = serverBonusEarn;
  const methodMeta = methodOptions.find((m) => m.id === delivery);

  const contactDefaults = useMemo(
    () =>
      user
        ? {
            name: `${user.firstName} ${user.lastName}`,
            phone: user.phone,
            email: user.email,
          }
        : { name: "", phone: "", email: "" },
    [user]
  );

  const defaultAddressId = addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "";
  const defaultLegalId = legalEntities.find((e) => e.isDefault)?.id ?? legalEntities[0]?.id ?? "";

  useEffect(() => {
    if (defaultAddressId && !selectedAddressId) setSelectedAddressId(defaultAddressId);
  }, [defaultAddressId, selectedAddressId]);

  useEffect(() => {
    if (defaultLegalId && !selectedLegalId) setSelectedLegalId(defaultLegalId);
  }, [defaultLegalId, selectedLegalId]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const resolveDellinDestination = useCallback(() => {
    const city =
      dellinCityQuery.trim() ||
      selectedAddress?.city ||
      "Москва";
    const street =
      selectedAddress?.street ||
      (typeof document !== "undefined"
        ? (document.getElementById("addr") as HTMLInputElement | null)?.value
        : "") ||
      city;
    const matched = dellinCities.find(
      (c) => c.name.toLowerCase() === city.toLowerCase() || c.name.toLowerCase().includes(city.toLowerCase()),
    );
    return {
      city,
      address: street,
      kladr: matched?.code || matched?.id || undefined,
      terminal_id: dellinTerminalId || undefined,
    };
  }, [dellinCityQuery, selectedAddress, dellinCities, dellinTerminalId]);

  const runDellinQuote = useCallback(async () => {
    if (!isDellin || cart.length === 0) return;
    const seq = ++dellinQuoteSeq.current;
    setDellinLoading(true);
    setDellinError(null);
    try {
      const items: Array<{ product_id: string; qty: number }> = [];
      for (const line of cart) {
        const id = await resolveCartLineProductId(line.product);
        if (id) items.push({ product_id: id, qty: line.qty });
      }
      if (!items.length) throw new Error("Нет товаров для расчёта");
      const destination = resolveDellinDestination();
      const q = await quoteShipping({
        delivery_method_code: delivery,
        items,
        destination,
        declared_value: cartTotal,
      });
      if (seq !== dellinQuoteSeq.current) return;
      setDellinQuote(q);
      if (!q.available) setDellinError(q.display_note || "Расчёт недоступен");
    } catch (err) {
      if (seq !== dellinQuoteSeq.current) return;
      setDellinQuote(null);
      setDellinError(err instanceof Error ? err.message : "Ошибка расчёта Dellin");
    } finally {
      if (seq === dellinQuoteSeq.current) setDellinLoading(false);
    }
  }, [isDellin, cart, delivery, cartTotal, resolveDellinDestination]);

  // Auto-quote Dellin when city/method/cart change (debounced)
  useEffect(() => {
    if (!isDellin) {
      setDellinQuote(null);
      setDellinError(null);
      return;
    }
    const city = dellinCityQuery.trim() || selectedAddress?.city || "";
    if (city.length < 2 || cart.length === 0) return;
    const t = window.setTimeout(() => {
      void runDellinQuote();
    }, 650);
    return () => window.clearTimeout(t);
  }, [
    isDellin,
    dellinCityQuery,
    dellinTerminalId,
    selectedAddress?.city,
    selectedAddress?.street,
    cart,
    delivery,
    cartTotal,
    runDellinQuote,
  ]);
  const selectedLegal = legalEntities.find((e) => e.id === selectedLegalId);

  if (done && orderMeta) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-10 text-success" />
        </div>
        <h1 className="mt-6 text-h2">Заказ оформлен!</h1>
        <p className="mt-2 max-w-md text-body text-muted-foreground">
          Номер заказа <span className="font-semibold text-foreground">#{orderMeta.id}</span>. Сумма{" "}
          <span className="font-semibold text-foreground">
            {allOnRequest ? "под заказ" : formatPrice(orderMeta.grand)}
          </span>
          . Мы
          отправили детали на почту и скоро свяжемся для подтверждения.
        </p>
        {bonusesOn && isAuthenticated && (orderMeta.redeemed > 0 || orderMeta.earned > 0) && (
          <div className="mt-6 w-full max-w-md rounded-xl border border-border bg-card p-5 text-left shadow-card">
            <p className="flex items-center gap-2 text-body-sm font-semibold">
              <Gift className="size-4 text-primary" /> Бонусы по заказу
            </p>
            <dl className="mt-3 space-y-2 text-body-sm">
              {orderMeta.redeemed > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Списано</dt>
                  <dd className="font-semibold">
                    −{formatBonus(orderMeta.redeemed)} {bonusWord(orderMeta.redeemed)}
                  </dd>
                </div>
              )}
              {orderMeta.earned > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Начислено</dt>
                  <dd className="font-semibold text-success">
                    +{formatBonus(orderMeta.earned)} {bonusWord(orderMeta.earned)}
                  </dd>
                </div>
              )}
            </dl>
            <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0">
              <Link href="/account/bonuses">Открыть бонусный счёт</Link>
            </Button>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="gradient">
            <Link href="/account/orders">Мои заказы</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/catalog">Продолжить покупки</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Оформление заказа" }]} className="mb-4" />
      <h1 className="mb-6 text-h2">Оформление заказа</h1>

      <form
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (cart.length === 0 || submitting) return;
          if (!consentChecked) {
            // Чекбокс согласия обязателен: подсвечиваем и не отправляем.
            setConsentError(true);
            document.getElementById("checkout-consent")?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          setConsentError(false);
          setSubmitError(null);
          setSubmitting(true);

          const form = e.currentTarget;
          const fd = new FormData(form);
          const name =
            String(fd.get("name") || (form.querySelector("#name") as HTMLInputElement | null)?.value || "").trim();
          const phone =
            String(fd.get("phone") || (form.querySelector("#phone") as HTMLInputElement | null)?.value || "").trim();
          const email =
            String(fd.get("email") || (form.querySelector("#email") as HTMLInputElement | null)?.value || "").trim();
          const addr =
            String((form.querySelector("#addr") as HTMLInputElement | null)?.value || "").trim();
          // Реквизиты как в ЛК (все поля) или файл — только для invoice.
          const rq = (id: string) =>
            String((form.querySelector(`#${id}`) as HTMLInputElement | null)?.value || "").trim();
          const requisites = {
            company_name: rq("rq-company"),
            inn: rq("rq-inn"),
            kpp: rq("rq-kpp"),
            ogrn: rq("rq-ogrn"),
            legal_address: rq("rq-legal-address"),
            bank_name: rq("rq-bank"),
            bik: rq("rq-bik"),
            checking_account: rq("rq-account"),
            correspondent_account: rq("rq-corr"),
          };
          const requisitesFile =
            (form.querySelector("#rq-file") as HTMLInputElement | null)?.files?.[0] || null;

          try {
            const serverCart = await syncLocalCartToServer(cart, promoCodeTrimmed);

            const redeemReq = bonusesOn && redeemEnabled ? Math.max(0, Math.min(Number(redeemAmount) || 0, serverBonusMax)) : 0;

            // Saved address book entry → server snapshots by id;
            // otherwise a raw one-off address object.
            const useSavedAddress = Boolean(selectedAddress) && methodMeta?.requiresAddress;
            const shipping_address =
              methodMeta?.requiresAddress && !useSavedAddress
                ? {
                    city: addr || "Москва",
                    street: addr || undefined,
                    full_name: name || undefined,
                    phone: phone || undefined,
                  }
                : undefined;

            let ship = shipping;
            let quoteToken: string | undefined;
            let deliveryMeta: Record<string, unknown> | undefined;

            if (isDellin) {
              const destination = resolveDellinDestination();
              let q = dellinQuote;
              if (!q?.quote_token) {
                q = await quoteShipping({
                  delivery_method_code: delivery,
                  items: serverCart.items
                    .filter((i) => i.price_kind !== "warranty")
                    .map((i) => ({ product_id: i.product_id || "", qty: i.qty })),
                  destination,
                  declared_value: cartTotal,
                });
                setDellinQuote(q);
              }
              if (!q.available || !q.quote_token) {
                throw new Error(q.display_note || "Не удалось рассчитать доставку Dellin");
              }
              ship = q.price_for_order;
              quoteToken = q.quote_token || undefined;
              deliveryMeta = {
                ...(q.delivery_meta_preview || {}),
                destination,
              };
              // Prefer Dellin city in shipping snapshot when user typed it
              if (shipping_address && destination.city) {
                shipping_address.city = destination.city;
              }
            }

            const ymClientId = metricaClientId();
            const invoiceLegal =
              (paymentMethods.find((m) => m.code === payment)?.driver === "invoice" ||
                paymentMethods.find((m) => m.code === payment)?.config?.requires_legal)
            const previewPayload = {
              from_cart: true,
              customer_name: name || contactDefaults.name || "Покупатель",
              customer_email: email || contactDefaults.email,
              guest_email: email || contactDefaults.email,
              customer_phone: phone || contactDefaults.phone || undefined,
              // Реквизиты как в ЛК — только для счёта (invoice).
              ...(invoiceLegal
                ? {
                    customer_company: requisites.company_name || undefined,
                    customer_inn: requisites.inn || undefined,
                    legal_entity_data:
                      requisites.company_name || requisites.inn
                        ? {
                            company_name: requisites.company_name || undefined,
                            inn: requisites.inn || undefined,
                            kpp: requisites.kpp || undefined,
                            ogrn: requisites.ogrn || undefined,
                            legal_address: requisites.legal_address || undefined,
                            bank_name: requisites.bank_name || undefined,
                            bik: requisites.bik || undefined,
                            checking_account: requisites.checking_account || undefined,
                            correspondent_account: requisites.correspondent_account || undefined,
                          }
                        : undefined,
                  }
                : {}),
              promo_code: promoCodeTrimmed || undefined,
              // Обычные способы: сумму ставит сервер из тарифов админки
              // (ShippingQuoteService::applyToOrderPayload). Dellin: из quote_token.
              ...(isDellin ? { shipping_amount: ship } : {}),
              bonus_to_spend: isAuthenticated ? redeemReq : 0,
              delivery_method_code: delivery,
              payment_method_code: payment || paymentMethods[0]?.code,
              delivery_category_slug: apiMethod?.delivery_category?.slug || undefined,
              shipping_address,
              delivery_meta: {
                ...(deliveryMeta || {}),
                ...(apiMethod?.delivery_category?.slug
                  ? { delivery_category_slug: apiMethod.delivery_category.slug }
                  : {}),
              },
              quote_token: quoteToken,
              customer_type:
                invoiceLegal && (selectedLegal || requisites.company_name || requisites.inn || requisitesFile)
                  ? ("legal" as const)
                  : ("individual" as const),
              legal_entity_id:
                isAuthenticated && selectedLegal ? selectedLegal.id : undefined,
              shipping_address_id: useSavedAddress ? selectedAddress?.id : undefined,
              custom_fields: ymClientId
                ? { metrica_client_id: ymClientId }
                : undefined,
            };
            await apiCheckoutPreview(previewPayload);
            const order = await placeCheckout({
              ...previewPayload,
              idempotency_key:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `fe-${Date.now()}`,
            });
            if (requisitesFile && (order as { id?: string })?.id) {
              try {
                const fdReq = new FormData();
                fdReq.append("file", requisitesFile);
                fdReq.append("title", "Реквизиты");
                fdReq.append("type", "requisites");
                await uploadOrderRequisites((order as { id: string }).id, fdReq);
              } catch {
                /* заказ создан — файл можно прикрепить позже */
              }
            }

            const orderId = order.number || order.id;
            // Фиксируем согласие из формы заказа (блок Г ТЗ).
            void logConsent("order_form_consent");
            const redeemed = Number(order.bonus_spent_points ?? order.bonus_spent ?? redeemReq) || 0;
            // Сервер — источник правды по бонусам: начисление приходит
            // статусом заказа позже, локально только обновляем баланс.
            const earned = Number(order.bonus_earned_points) || 0;
            if (isAuthenticated) void refreshBonusBalance();

            setOrderMeta({
              id: orderId,
              redeemed,
              earned: Number(order.bonus_earned_points) || earned,
              grand: Number(order.total) || Math.max(0, cartTotal - redeemed) + ship,
              shipping: Number(order.shipping_amount) || ship,
              deliveryTitle: methodOptions.find((m) => m.id === delivery)?.title ?? delivery,
            });
            // Ecommerce: purchase confirmation (SPA screen — no page transition).
            metricaPurchase(
              {
                id: orderId,
                total: Number(order.total) || Math.max(0, cartTotal - redeemed) + ship,
              },
              cart.map((l) => toMetricaProduct(l.product, { qty: l.qty })),
            );
            clearCart();
            setDone(true);
          } catch (err) {
            const msg =
              err instanceof StorefrontApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Не удалось оформить заказ";
            setSubmitError(msg);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {/* min-w-0: грид-колонка формы не должна распираться контентом (мобильный overflow) */}
        <div className="min-w-0 space-y-6">
          <fieldset className="surface-card min-w-0 p-6">
            <legend className="mb-4 flex items-center gap-2 text-h5">
              <User className="size-5 text-primary" /> Контактные данные
              {isAuthenticated && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-caption font-semibold text-success">
                  Авторизован
                </span>
              )}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя и фамилия</Label>
                <Input id="name" name="name" required placeholder="Иван Иванов" defaultValue={contactDefaults.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+7 (___) ___-__-__"
                  defaultValue={contactDefaults.phone}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="mail@example.ru"
                  defaultValue={contactDefaults.email}
                />
              </div>
            </div>
            {!isAuthenticated && (
              <p className="mt-3 text-caption text-muted-foreground">
                <Link href="/account" className="font-semibold text-primary hover:underline">
                  Войдите
                </Link>
                , чтобы использовать сохранённые адреса, юр. лица и бонусы.
              </p>
            )}
          </fieldset>

          <fieldset className="surface-card min-w-0 p-6">
            <legend className="mb-4 flex items-center gap-2 text-h5">
              <Truck className="size-5 text-primary" /> Доставка
            </legend>
            {methodOptions.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">Способы доставки не настроены.</p>
            ) : (
            <div className="space-y-3">
              <RadioGroup
                value={topRadioValue}
                onValueChange={pickTopLevel}
                className="gap-3"
              >
                {deliveryGroups.map((g) => {
                  const methodRow = (
                    m: (typeof methodOptions)[number],
                    radioValue: string,
                  ) => {
                    const isDl = m.driver === "dellin";
                    const q = !isDl
                      ? quoteDeliveryMethod(m.method, cartSlugs, cartTotal)
                      : null;
                    const available = isDl ? true : Boolean(q?.available);
                    let priceLabel = "—";
                    if (isDl && delivery === m.id && dellinQuote?.available) {
                      priceLabel =
                        dellinQuote.price_for_order === 0
                          ? `0 ₽ (ТК ~${formatPrice(dellinQuote.price)})`
                          : formatPrice(dellinQuote.price_for_order);
                    } else if (isDl) {
                      priceLabel = "расчёт…";
                    } else if (q?.available) {
                      priceLabel =
                        m.driver === "pickup" && (q.free || q.price === 0)
                          ? "Бесплатно"
                          : formatPrice(q.price);
                    }
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors",
                          !available && "cursor-not-allowed opacity-50",
                          delivery === m.id && available
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <RadioGroupItem value={radioValue} disabled={!available} />
                        <span className="flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-body-sm font-semibold">{m.title}</span>
                            <span
                              className={cn(
                                "text-body-sm font-bold",
                                !isDl && (q?.free || q?.price === 0)
                                  ? "text-success"
                                  : "text-foreground",
                              )}
                            >
                              {priceLabel}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-caption text-muted-foreground">
                            {m.subtitle}
                            {m.driver === "dellin" &&
                            m.payer_label &&
                            m.subtitle !== m.payer_label
                              ? ` · ${m.payer_label}`
                              : ""}
                            {!isDl && q?.note ? ` · ${q.note}` : ""}
                            {isDl && delivery === m.id && dellinQuote?.display_note
                              ? ` · ${dellinQuote.display_note}`
                              : ""}
                          </span>
                        </span>
                        <MapPin className="size-5 shrink-0 text-muted-foreground" />
                      </label>
                    );
                  };
                  if (g.isSingle) {
                    return (
                      <div key={g.key}>
                        {methodRow(g.methods[0], `method:${g.methods[0].id}`)}
                      </div>
                    );
                  }
                  const catSelected = selectedGroupSlug === g.key;
                  return (
                    <div key={g.key} className="space-y-2">
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors",
                          catSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <RadioGroupItem value={`cat:${g.key}`} />
                        <span className="flex-1">
                          <span className="text-body-sm font-semibold">{g.title}</span>
                          <span className="mt-0.5 block text-caption text-muted-foreground">
                            {g.methods.map((m) => m.title).join(" · ")}
                          </span>
                        </span>
                        <Truck className="size-5 shrink-0 text-muted-foreground" />
                      </label>
                      {catSelected ? (
                        <RadioGroup
                          value={delivery}
                          onValueChange={pickDelivery}
                          className="ml-5 gap-3"
                        >
                          {g.methods.map((m) => methodRow(m, m.id))}
                        </RadioGroup>
                      ) : null}
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
            )}
            {isDellin ? (
              <div className="mt-4 space-y-3 rounded-md border border-border p-4">
                <p className="text-body-sm font-medium">Параметры ТК Деловые Линии</p>
                <div className="space-y-1.5">
                  <Label htmlFor="dellin-city">Город доставки</Label>
                  <Input
                    id="dellin-city"
                    list="dellin-cities-list"
                    value={dellinCityQuery}
                    placeholder="Начните вводить город…"
                    onChange={(e) => {
                      const v = e.target.value;
                      setDellinCityQuery(v);
                      setDellinQuote(null);
                      setDellinTerminalId("");
                      setDellinTerminals([]);
                      if (v.trim().length >= 2) {
                        void searchDellinCities(v.trim()).then(setDellinCities);
                      } else setDellinCities([]);
                    }}
                  />
                  <datalist id="dellin-cities-list">
                    {dellinCities.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  <p className="text-caption text-muted-foreground">
                    Расчёт обновляется автоматически после ввода города
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dellin-terminal">Терминал (необязательно)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="dellin-terminal"
                      list="dellin-terminals-list"
                      value={dellinTerminalId}
                      placeholder="ID или выберите из списка"
                      onChange={(e) => {
                        setDellinTerminalId(e.target.value);
                        setDellinQuote(null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!dellinCityQuery.trim() && !selectedAddress?.city}
                      onClick={async () => {
                        const city = dellinCityQuery.trim() || selectedAddress?.city || "";
                        const list = await searchDellinTerminals(city || undefined);
                        setDellinTerminals(list);
                      }}
                    >
                      Найти
                    </Button>
                  </div>
                  <datalist id="dellin-terminals-list">
                    {dellinTerminals.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.address ? ` — ${t.address}` : ""}
                      </option>
                    ))}
                  </datalist>
                  {dellinTerminals.length > 0 ? (
                    <ul className="max-h-28 space-y-1 overflow-y-auto text-caption">
                      {dellinTerminals.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="text-left text-primary hover:underline"
                            onClick={() => {
                              setDellinTerminalId(t.id);
                              setDellinQuote(null);
                            }}
                          >
                            [{t.id}] {t.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dellinLoading || cart.length === 0}
                  onClick={() => void runDellinQuote()}
                >
                  {dellinLoading ? "Считаем…" : "Пересчитать доставку"}
                </Button>
                {dellinError ? (
                  <p className="text-caption text-destructive">{dellinError}</p>
                ) : null}
                {dellinQuote?.available ? (
                  <p className="text-caption text-muted-foreground">
                    {dellinQuote.display_note}
                    {dellinQuote.eta ? ` · срок: ${dellinQuote.eta}` : ""}
                    {dellinQuote.warnings?.length
                      ? ` · ${dellinQuote.warnings.join("; ")}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            {apiMethod?.driver === "pickup" && apiMethod.config?.address ? (
              <div className="mt-4 rounded-md border border-border p-4">
                <p className="text-body-sm font-medium">Адрес самовывоза</p>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  {apiMethod.config.address}
                </p>
              </div>
            ) : null}
            {methodMeta?.requiresAddress && (
              <div className="mt-4 space-y-3">
                {isAuthenticated && addresses.length > 0 ? (
                  <>
                    <p className="text-body-sm font-medium">Адрес из книги</p>
                    <RadioGroup
                      value={selectedAddressId}
                      onValueChange={setSelectedAddressId}
                      className="gap-2"
                    >
                      {addresses.map((a) => (
                        <label
                          key={a.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                            selectedAddressId === a.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <RadioGroupItem value={a.id} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="block text-body-sm font-semibold">{a.label}</span>
                            <span className="block text-caption text-muted-foreground">
                              {[a.zip, a.city, a.street].filter(Boolean).join(", ")}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                    <Link href="/account/addresses" className="text-caption font-semibold text-primary hover:underline">
                      Управление адресами
                    </Link>
                    {selectedAddress && (
                      <input
                        type="hidden"
                        name="address"
                        value={[selectedAddress.city, selectedAddress.street]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    )}
                  </>
                ) : (
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="addr">Адрес</Label>
                      <Input id="addr" required placeholder="Город, улица, дом, квартира/офис" />
                    </div>
                    {isAuthenticated && (
                      <p className="text-caption text-muted-foreground sm:col-span-2">
                        Книга адресов пуста.{" "}
                        <Link href="/account/addresses" className="font-semibold text-primary hover:underline">
                          Добавить адрес
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="surface-card min-w-0 p-6">
            <legend className="mb-4 flex items-center gap-2 text-h5">
              <CreditCard className="size-5 text-primary" /> Оплата
            </legend>
            {paymentMethods.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">Способы оплаты не настроены.</p>
            ) : (
            <RadioGroup value={payment} onValueChange={setPayment} className="gap-3">
              {paymentMethods.map((m) => (
                <label
                  key={m.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors",
                    payment === m.code ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  <RadioGroupItem value={m.code} />
                  <span className="flex-1">
                    <span className="block text-body-sm font-semibold">{m.name}</span>
                    {m.config?.description ? (
                      <span className="block text-caption text-muted-foreground">{m.config.description}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </RadioGroup>
            )}
          </fieldset>

          {(paymentMethods.find((m) => m.code === payment)?.driver === "invoice" ||
            paymentMethods.find((m) => m.code === payment)?.config?.requires_legal) && (
            <fieldset className="surface-card min-w-0 p-6">
              <legend className="mb-4 flex items-center gap-2 text-h5">
                <Building2 className="size-5 text-primary" /> Реквизиты для счёта
              </legend>
              <p className="mb-3 text-caption text-muted-foreground">
                Прикрепите файл реквизитов — или заполните поля ниже как в личном кабинете.
              </p>
              <div className="mb-4">
                <RequisitesFilePicker id="rq-file" accept=".pdf,.doc,.docx,image/*" />
              </div>
              {isAuthenticated && legalEntities.length > 0 ? (
                <div className="mb-4">
                  <RadioGroup value={selectedLegalId} onValueChange={setSelectedLegalId} className="gap-3">
                    {legalEntities.map((e) => (
                      <label
                        key={e.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
                          selectedLegalId === e.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <RadioGroupItem value={e.id} className="mt-1" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-sm font-semibold">{e.name}</span>
                          <span className="mt-0.5 block text-caption text-muted-foreground">
                            ИНН {e.inn}
                            {e.kpp ? ` · КПП ${e.kpp}` : ""}
                          </span>
                          <span className="mt-0.5 block text-caption text-muted-foreground">{e.legalAddress}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  {selectedLegal && (
                    <p className="mt-3 text-caption text-muted-foreground">
                      Счёт будет выставлен на: <strong className="text-foreground">{selectedLegal.name}</strong>
                    </p>
                  )}
                </div>
              ) : isAuthenticated ? (
                <p className="mb-4 text-body-sm text-muted-foreground">
                  Нет сохранённых организаций.{" "}
                  <Link href="/account/legal" className="font-semibold text-primary hover:underline">
                    Добавить в ЛК
                  </Link>{" "}
                  — или заполните ниже.
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rq-company">Наименование</Label>
                  <Input id="rq-company" placeholder="ООО «Компания»" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-inn">ИНН</Label>
                  <Input id="rq-inn" placeholder="7701234567" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-kpp">КПП</Label>
                  <Input id="rq-kpp" placeholder="770101001" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-ogrn">ОГРН</Label>
                  <Input id="rq-ogrn" placeholder="1027700123456" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rq-legal-address">Юридический адрес</Label>
                  <Input id="rq-legal-address" placeholder="Индекс, город, улица…" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rq-bank">Банк</Label>
                  <Input id="rq-bank" placeholder="ПАО «Сбербанк»" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-bik">БИК</Label>
                  <Input id="rq-bik" placeholder="044525225" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rq-account">Расчётный счёт</Label>
                  <Input id="rq-account" placeholder="40702810…" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rq-corr">Корр. счёт</Label>
                  <Input id="rq-corr" placeholder="30101810…" />
                </div>
              </div>
            </fieldset>
          )}
        </div>

        <aside className="min-w-0">
          <div className="sticky-below-header surface-card p-6">
            <h3 className="flex items-center gap-2 text-h5">
              <Package className="size-5 text-primary" /> Ваш заказ
            </h3>
            <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto scrollbar-thin">
              {cart.map((l) => (
                <li key={l.lineKey ?? l.product.id} className="flex gap-3">
                  <img src={l.product.image} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-caption font-medium">{l.product.title}</p>
                    <CartConfigurationSummary line={l} />
                    <p className="text-caption text-muted-foreground">
                      {isLineOnRequest(l)
                        ? `x ${l.qty} · под заказ`
                        : `x ${l.qty} · ${formatPrice(l.product.price ?? 0)}`}
                    </p>
                    {l.warranty?.isPaid && (
                      <p className="text-caption text-muted-foreground">
                        {l.warranty.name} · +{formatPrice(l.warranty.price * l.qty)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {bonusesOn ? (
            <div className="mt-4">
              <BonusRedeemBlock
                cartSubtotal={cartTotal}
                redeemEnabled={redeemEnabled}
                onRedeemEnabledChange={setRedeemEnabled}
                redeemAmount={redeemAmount}
                onRedeemAmountChange={setRedeemAmount}
              />
            </div>
            ) : null}

            <div className="mt-4">
              <Label htmlFor="checkout-promo">Промокод</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="checkout-promo"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Введите код"
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={applyPromoCode}>
                  ОК
                </Button>
              </div>
              {promoError ? (
                <p className="mt-1.5 text-caption text-destructive">{promoError}</p>
              ) : promoDiscount > 0 ? (
                <p className="mt-1.5 text-caption text-success">
                  Скидка по промокоду: −{formatPrice(promoDiscount)}
                </p>
              ) : null}
            </div>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-body-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Товары</dt>
                <dd className="font-medium">{formatPrice(cartTotal)}</dd>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Промокод</dt>
                  <dd className="font-medium">−{formatPrice(promoDiscount)}</dd>
                </div>
              )}
              {redeemApplied > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Бонусы</dt>
                  <dd className="font-medium">−{formatPrice(redeemApplied)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  Доставка
                  {methodMeta && (
                    <span className="mt-0.5 block text-caption font-normal">{methodMeta.title}</span>
                  )}
                </dt>
                <dd className="text-right font-medium">
                  {shipping === 0
                    ? isDellin && !dellinQuote?.available
                      ? "—"
                      : methodMeta?.driver === "pickup"
                        ? "Бесплатно"
                        : formatPrice(0)
                    : formatPrice(shipping)}
                  {isDellin && dellinLoading && (
                    <span className="mt-0.5 block text-caption font-normal text-muted-foreground">
                      считаем…
                    </span>
                  )}
                </dd>
              </div>
              {bonusesOn && isAuthenticated && (
                <div className="flex justify-between gap-3 text-primary">
                  <dt>Начислим бонусов после выполнения</dt>
                  <dd className="text-right font-medium">
                    {serverBonusPending ? (
                      <span className="text-muted-foreground">считаем…</span>
                    ) : willEarn > 0 ? (
                      `+${formatBonus(willEarn)}`
                    ) : serverBonusEarnPercent === 0 ? (
                      <span className="text-muted-foreground">вашей группе не положено</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
              <span className="text-body text-muted-foreground">Итого</span>
              <span className="text-right">
                <span className="block text-h3 font-bold">
                  {allOnRequest ? "Под заказ" : formatPrice(grand)}
                </span>
                {allOnRequest ? null : <VatHint />}
              </span>
            </div>
            {submitError && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-caption text-destructive">
                {submitError}
              </p>
            )}
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="mt-5 hidden w-full text-white lg:inline-flex"
              disabled={cart.length === 0 || submitting}
              aria-busy={submitting}
            >
              {submitting ? "Отправка…" : "Подтвердить заказ"}
            </Button>
            <ConsentCheckbox
              id="checkout-consent"
              checked={consentChecked}
              onChange={(checked) => {
                setConsentChecked(checked);
                if (checked) setConsentError(false);
              }}
              error={consentError}
              className="mt-4"
            />
          </div>
        </aside>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-elevated backdrop-blur lg:hidden">
          <div className="container-page flex items-center gap-3 px-0">
            <div className="min-w-0 flex-1">
              <span className="block text-caption text-muted-foreground">Итого</span>
              <span className="block truncate text-body font-bold">{allOnRequest ? "Под заказ" : formatPrice(grand)}</span>
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="md"
              className="min-w-0 shrink-0 whitespace-normal text-center text-white"
              disabled={cart.length === 0 || submitting}
              aria-busy={submitting}
            >
              {submitting ? "Отправка…" : "Подтвердить заказ"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
