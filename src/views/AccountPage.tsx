"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  User,
  Package,
  Save,
  Heart,
  GitCompare,
  Settings,
  LogOut,
  ChevronRight,
  Trash2,
  Gift,
  LogIn,
  MapPin,
  Building2,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConsentCheckbox } from "@/components/consent/ConsentCheckbox";
import { logConsent } from "@/lib/consent/consent";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ProductCard } from "@/components/ProductCard";
import { CompareTable } from "@/components/compare/CompareTable";
import { BonusTab } from "@/components/account/BonusPanel";
import { AddressesPanel } from "@/components/account/AddressesPanel";
import { LegalEntitiesPanel } from "@/components/account/LegalEntitiesPanel";
import { SavedBuildsPanel } from "@/components/account/SavedBuildsPanel";
import { formatPrice, cn } from "@/lib/utils";
import { useShop, MAX_COMPARE } from "@/store/shop";
import { useAuth } from "@/store/auth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useToast } from "@/components/ui/toast";
import { formatBonus } from "@/lib/bonuses";
import { resolveProductsByIds } from "@/hooks/useCatalogProducts";
import {
  fetchAccountOrders,
  fetchNewsletterStatus,
  requestEmailChangeCode,
  requestPasswordChangeCode,
  changeAccountPassword,
  forgotPassword,
  resetPassword,
  subscribeNewsletter,
  unsubscribeNewsletter,
  type AccountOrder,
} from "@/lib/api";
import type { Product } from "@/data/types";
import { Skeleton } from "@/components/ui/skeleton";

const menu = [
  { key: "profile", label: "Профиль", icon: User },
  { key: "addresses", label: "Адреса", icon: MapPin },
  { key: "legal", label: "Юр. лица", icon: Building2 },
  { key: "bonuses", label: "Бонусы", icon: Gift },
  { key: "orders", label: "История заказов", icon: Package },
  { key: "configs", label: "Сохранённые сборки", icon: Save },
  { key: "favorites", label: "Избранное", icon: Heart },
  { key: "compare", label: "Сравнение", icon: GitCompare },
  { key: "settings", label: "Настройки", icon: Settings },
];

export function AccountPage() {
  const routeParams = useParams();
    const tab = typeof routeParams.tab === "string" ? routeParams.tab : "profile";
  const router = useRouter();
  const {
    favorites,
    compare,
    removeFromCompare,
    clearCompare,
    addToCart,
  } = useShop();
  const { site } = useSiteSettings();
  const bonusesOn = site?.bonusesEnabled !== false;
  const {
    isAuthenticated,
    user,
    bonusBalance,
    addresses,
    legalEntities,
    login,
    register,
    pendingEmail: pendingVerification,
    verifyEmailCode,
    resendEmailCode,
    clearPendingEmail,
    logout,
    updateProfile,
    changeEmail,
  } = useAuth();
  const { push } = useToast();
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  });
  const [favProducts, setFavProducts] = useState<Product[]>([]);
  const [cmpProducts, setCmpProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">(
    "login",
  );
  const [forgotForm, setForgotForm] = useState({
    email: "",
    code: "",
    password: "",
    password2: "",
  });
  const [forgotStage, setForgotStage] = useState<"email" | "reset">("email");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  // ── Смена пароля с кодом подтверждения на почту ──
  const [pwStage, setPwStage] = useState<"idle" | "code">("idle");
  const [pwCode, setPwCode] = useState("");
  const [pwPass, setPwPass] = useState("");
  const [pwPass2, setPwPass2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [emailStage, setEmailStage] = useState<"idle" | "code">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // ── Подписка «Новости и акции»: реальный бэкенд (GET /newsletter/status,
  // POST /newsletter/subscribe|unsubscribe), а не декоративный Switch ──
  const [newsletter, setNewsletter] = useState<{ subscribed: boolean | null; busy: boolean }>({
    subscribed: null,
    busy: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void fetchNewsletterStatus().then((s) => {
      if (!cancelled) setNewsletter({ subscribed: s.subscribed, busy: false });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const toggleNewsletter = async (next: boolean) => {
    const email = user?.email || "";
    if (!email) {
      push({
        variant: "warning",
        title: "Не удалось изменить подписку",
        description: "Укажите email в профиле и сохраните его.",
      });
      return;
    }
    setNewsletter((s) => ({ ...s, busy: true }));
    try {
      const message = next
        ? await subscribeNewsletter(email)
        : await unsubscribeNewsletter(email);
      setNewsletter({ subscribed: next, busy: false });
      push({ variant: "success", title: message });
    } catch (e) {
      setNewsletter((s) => ({ ...s, busy: false }));
      push({
        variant: "error",
        title: "Не удалось изменить подписку",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const sendPwCode = async () => {
    setPwBusy(true);
    try {
      const message = await requestPasswordChangeCode();
      setPwStage("code");
      push({ variant: "success", title: message });
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось отправить код",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPwBusy(false);
    }
  };

  const submitPassword = async () => {
    if (pwPass.length < 8) {
      push({ variant: "error", title: "Пароль: минимум 8 символов" });
      return;
    }
    if (pwPass !== pwPass2) {
      push({ variant: "error", title: "Пароли не совпадают" });
      return;
    }
    setPwBusy(true);
    try {
      const message = await changeAccountPassword(pwCode, pwPass);
      setPwStage("idle");
      setPwCode("");
      setPwPass("");
      setPwPass2("");
      push({ variant: "success", title: message });
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось изменить пароль",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPwBusy(false);
    }
  };

  const saveProfile = async () => {
    const nextEmail = profileForm.email.trim();
    setEmailBusy(true);
    try {
      await updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phone: profileForm.phone.trim(),
      });
      if (nextEmail.toLowerCase() !== (user?.email || "").toLowerCase()) {
        const message = await requestEmailChangeCode(nextEmail);
        setEmailStage("code");
        push({ variant: "success", title: message });
      } else {
        push({ variant: "success", title: "Профиль сохранён" });
      }
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось сохранить",
        description: e instanceof Error ? e.message : "Ошибка сервера",
      });
    } finally {
      setEmailBusy(false);
    }
  };

  const submitEmailChange = async () => {
    if (!emailCode.trim()) return;
    setEmailBusy(true);
    try {
      await changeEmail(profileForm.email, emailCode);
      setEmailStage("idle");
      setEmailCode("");
      push({ variant: "success", title: "Email изменён" });
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось изменить email",
        description: e instanceof Error ? e.message : "Проверьте код из письма",
      });
    } finally {
      setEmailBusy(false);
    }
  };
  const [authBusy, setAuthBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirmation: "",
  });
  // Согласие 152-ФЗ при регистрации (блок Б ТЗ).
  const [registerConsent, setRegisterConsent] = useState(false);
  const [registerConsentError, setRegisterConsentError] = useState(false);
  // Шаг подтверждения email кодом из письма.
  const [verifyCode, setVerifyCode] = useState("");

  const onVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setAuthBusy(true);
    try {
      await verifyEmailCode(verifyCode.trim());
      setVerifyCode("");
      push({
        variant: "success",
        title: "Email подтверждён",
        description: "Аккаунт активирован, вы вошли в систему",
      });
    } catch (err) {
      push({
        variant: "error",
        title: "Неверный код",
        description: err instanceof Error ? err.message : "Проверьте код из письма",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const onResendCode = async () => {
    try {
      await resendEmailCode();
      push({ variant: "success", title: "Код отправлен повторно" });
    } catch (err) {
      push({
        variant: "error",
        title: "Не удалось отправить код",
        description: err instanceof Error ? err.message : "Попробуйте позже",
      });
    }
  };

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
    });
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || tab !== "orders") return;
    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError(null);
    void fetchAccountOrders({ per_page: 50 })
      .then((res) => {
        if (!cancelled) setOrders(res.items);
      })
      .catch((e) => {
        if (!cancelled) {
          setOrders([]);
          setOrdersError(e instanceof Error ? e.message : "Не удалось загрузить заказы");
        }
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, tab]);

  useEffect(() => {
    let cancelled = false;
    void resolveProductsByIds(favorites).then((list) => {
      if (!cancelled) setFavProducts(list);
    });
    return () => {
      cancelled = true;
    };
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;
    void resolveProductsByIds(compare).then((list) => {
      if (!cancelled) setCmpProducts(list);
    });
    return () => {
      cancelled = true;
    };
  }, [compare]);

  if (!isAuthenticated) {
    const onLogin = async (e: FormEvent) => {
      e.preventDefault();
      setAuthBusy(true);
      try {
        await login(loginForm.email.trim(), loginForm.password);
        push({
          variant: "success",
          title: "Вы вошли",
          description: loginForm.email.trim(),
        });
      } catch (err) {
        push({
          variant: "error",
          title: "Ошибка входа",
          description:
            err instanceof Error
              ? err.message
              : "Проверьте email/пароль или доступность API",
        });
      } finally {
        setAuthBusy(false);
      }
    };

    const onRegister = async (e: FormEvent) => {
      e.preventDefault();
      if (!registerConsent) {
        // Согласие 152-ФЗ обязательно: блокируем отправку и подсвечиваем чекбокс.
        setRegisterConsentError(true);
        document.getElementById("reg-consent")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (registerForm.password !== registerForm.passwordConfirmation) {
        push({
          variant: "error",
          title: "Пароли не совпадают",
          description: "Повторите ввод пароля",
        });
        return;
      }
      if (registerForm.password.length < 8) {
        push({
          variant: "error",
          title: "Слишком короткий пароль",
          description: "Минимум 8 символов",
        });
        return;
      }
      setAuthBusy(true);
      try {
        await register({
          name: registerForm.name.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password,
          passwordConfirmation: registerForm.passwordConfirmation,
          phone: registerForm.phone.trim() || undefined,
        });
        // Фиксируем согласие из формы регистрации (блок Г ТЗ).
        void logConsent("register_consent");
        push({
          variant: "success",
          title: "Аккаунт создан",
          description: "Код подтверждения отправлен на email — введите его ниже",
        });
      } catch (err) {
        push({
          variant: "error",
          title: "Не удалось зарегистрироваться",
          description:
            err instanceof Error ? err.message : "Проверьте данные и API",
        });
      } finally {
        setAuthBusy(false);
      }
    };

    const sendForgotCode = async (e: FormEvent) => {
      e.preventDefault();
      setForgotBusy(true);
      try {
        const message = await forgotPassword(forgotForm.email.trim());
        setForgotStage("reset");
        setForgotMessage(message);
      } catch (err) {
        push({
          variant: "error",
          title: "Не удалось отправить код",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setForgotBusy(false);
      }
    };

    const submitForgot = async (e: FormEvent) => {
      e.preventDefault();
      if (forgotForm.password !== forgotForm.password2) {
        push({ variant: "error", title: "Пароли не совпадают" });
        return;
      }
      setForgotBusy(true);
      try {
        const message = await resetPassword(
          forgotForm.email.trim(),
          forgotForm.code.trim(),
          forgotForm.password,
        );
        push({ variant: "success", title: message });
        setForgotForm({
          email: forgotForm.email,
          code: "",
          password: "",
          password2: "",
        });
        setForgotStage("email");
        setAuthMode("login");
      } catch (err) {
        push({
          variant: "error",
          title: "Не удалось сменить пароль",
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setForgotBusy(false);
      }
    };

    return (
      <div className="container-page py-10">
        <Breadcrumbs items={[{ label: "Личный кабинет" }]} className="mb-6" />
        <div className="mx-auto max-w-md">
          <div className="surface-card p-6 sm:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-brand-gradient text-white">
                <LogIn className="size-5" />
              </div>
              <h1 className="text-h3">
                {authMode === "forgot"
                  ? "Восстановление пароля"
                  : authMode === "login"
                    ? "Вход в аккаунт"
                    : "Регистрация"}
              </h1>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {authMode === "forgot"
                  ? "Введите email — пришлём код для смены пароля"
                  : authMode === "login"
                    ? "Заказы, сохранённые сборки, адреса и бонусы"
                    : "Создайте аккаунт покупателя на витрине"}
              </p>
            </div>

            {authMode !== "forgot" ? (
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                  authMode === "login"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAuthMode("login")}
              >
                Вход
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                  authMode === "register"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAuthMode("register")}
              >
                Регистрация
              </button>
            </div>
            ) : null}

            {pendingVerification ? (
              <form className="space-y-4" onSubmit={(e) => void onVerifyEmail(e)}>
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-body-sm leading-relaxed text-muted-foreground">
                  Код подтверждения отправлен на{" "}
                  <span className="font-medium text-foreground">{pendingVerification}</span>.
                  Введите его, чтобы активировать аккаунт.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="verify-code">Код из письма</Label>
                  <Input
                    id="verify-code"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D+/g, ""))}
                    placeholder="000000"
                    className="text-center text-h4 tracking-[0.4em]"
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full" disabled={authBusy}>
                  {authBusy ? "Проверяем…" : "Подтвердить email"}
                </Button>
                <div className="flex items-center justify-between text-caption text-muted-foreground">
                  <button
                    type="button"
                    className="underline underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    onClick={() => void onResendCode()}
                  >
                    Отправить код снова
                  </button>
                  <button
                    type="button"
                    className="underline underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    onClick={() => {
                      clearPendingEmail();
                      setVerifyCode("");
                      setAuthMode("login");
                    }}
                  >
                    Отменить
                  </button>
                </div>
              </form>
            ) : authMode === "login" ? (
              <form className="space-y-4" onSubmit={(e) => void onLogin(e)}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email или телефон</Label>
                  <Input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    required
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Пароль</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={authBusy}
                >
                  <LogIn className="size-4" />
                  {authBusy ? "Вход…" : "Войти"}
                </Button>
                <button
                  type="button"
                  className="text-caption text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  onClick={() => setAuthMode("forgot")}
                >
                  Забыли пароль?
                </button>
              </form>
            ) : authMode === "forgot" ? (
              forgotStage === "email" ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => void sendForgotCode(e)}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email аккаунта</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotForm.email}
                      onChange={(e) =>
                        setForgotForm((f) => ({
                          ...f,
                          email: e.target.value,
                        }))
                      }
                      placeholder="you@example.com"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full"
                    disabled={forgotBusy}
                  >
                    {forgotBusy ? "Отправляем…" : "Отправить код"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-caption text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    onClick={() => setAuthMode("login")}
                  >
                    Вспомнили пароль? Войти
                  </button>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => void submitForgot(e)}
                >
                  {forgotMessage ? (
                    <p className="rounded-md bg-secondary px-3 py-2 text-caption text-foreground">
                      {forgotMessage}
                    </p>
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-code">Код из письма</Label>
                    <Input
                      id="forgot-code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={forgotForm.code}
                      onChange={(e) =>
                        setForgotForm((f) => ({ ...f, code: e.target.value }))
                      }
                      placeholder="000000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-password">Новый пароль</Label>
                    <Input
                      id="forgot-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={forgotForm.password}
                      onChange={(e) =>
                        setForgotForm((f) => ({
                          ...f,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Минимум 8 символов"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-password2">Повторите пароль</Label>
                    <Input
                      id="forgot-password2"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={forgotForm.password2}
                      onChange={(e) =>
                        setForgotForm((f) => ({
                          ...f,
                          password2: e.target.value,
                        }))
                      }
                      placeholder="••••••••"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full"
                    disabled={forgotBusy}
                  >
                    {forgotBusy ? "Сохраняем…" : "Сменить пароль"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-caption text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    onClick={() => setAuthMode("login")}
                  >
                    Вспомнили пароль? Войти
                  </button>
                </form>
              )
            ) : (
              <form className="space-y-4" onSubmit={(e) => void onRegister(e)}>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Имя</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Иван Иванов"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">Телефон (необязательно)</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    autoComplete="tel"
                    value={registerForm.phone}
                    onChange={(e) =>
                      setRegisterForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+7 900 000-00-00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Пароль</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    placeholder="Минимум 8 символов"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password2">Повтор пароля</Label>
                  <Input
                    id="reg-password2"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={registerForm.passwordConfirmation}
                    onChange={(e) =>
                      setRegisterForm((f) => ({
                        ...f,
                        passwordConfirmation: e.target.value,
                      }))
                    }
                    placeholder="Повторите пароль"
                  />
                </div>
                <ConsentCheckbox
                  id="reg-consent"
                  checked={registerConsent}
                  onChange={(checked) => {
                    setRegisterConsent(checked);
                    if (checked) setRegisterConsentError(false);
                  }}
                  error={registerConsentError}
                />
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={authBusy}
                >
                  {authBusy ? "Создание…" : "Зарегистрироваться"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[
          { label: "Личный кабинет", href: tab !== "profile" ? "/account" : undefined },
          ...(tab !== "profile"
            ? [{ label: menu.find((m) => m.key === tab)?.label ?? tab }]
            : [{ label: "Профиль" }]),
        ]}
        className="mb-4"
      />
      <h1 className="mb-6 text-h2">Личный кабинет</h1>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <div className="surface-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border p-5">
              <div className="flex size-12 items-center justify-center rounded-full bg-brand-gradient text-h6 font-bold text-white">
                {user?.firstName?.[0] ?? "И"}
              </div>
              <div>
                <p className="text-body font-semibold">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-caption text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <nav className="p-2">
              {menu.filter((m) => bonusesOn || m.key !== "bonuses").map((m) => (
                <button
                  key={m.key}
                  onClick={() => router.push(m.key === "profile" ? "/account" : `/account/${m.key}`)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium transition-colors",
                    tab === m.key ? "bg-primary text-white" : "hover:bg-secondary"
                  )}
                >
                  <m.icon className="size-4" /> {m.label}
                  {m.key === "favorites" && favorites.length > 0 && (
                    <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                      {favorites.length}
                    </span>
                  )}
                  {m.key === "compare" && compare.length > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                      {compare.length}
                    </span>
                  )}
                  {m.key === "bonuses" && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 text-[10px] font-bold",
                        tab === m.key ? "bg-white/20 text-white" : "bg-brand-gradient text-white"
                      )}
                    >
                      {formatBonus(bonusBalance)}
                    </span>
                  )}
                  {m.key === "addresses" && addresses.length > 0 && (
                    <span className="ml-auto text-caption text-muted-foreground">{addresses.length}</span>
                  )}
                  {m.key === "legal" && legalEntities.length > 0 && (
                    <span className="ml-auto text-caption text-muted-foreground">{legalEntities.length}</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  logout();
                  push({ variant: "info", title: "Вы вышли из аккаунта" });
                  router.push("/");
                }}
                className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-body-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="size-4" /> Выйти
              </button>
            </nav>
          </div>
        </aside>

        <div>
          {tab === "profile" && (
            <div className="surface-card p-6">
              <h2 className="text-h4">Данные профиля</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Имя</Label>
                  <Input
                    id="fn"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Фамилия</Label>
                  <Input
                    id="ln"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em">Email</Label>
                  <Input
                    id="em"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph">Телефон</Label>
                  <Input
                    id="ph"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
               {emailStage === "code" ? (
                 <div className="mt-5 max-w-md space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
                   <p className="text-body-sm text-muted-foreground">
                     Введите код из письма, отправленного на {profileForm.email}.
                   </p>
                   <div className="flex gap-2">
                     <Input
                       aria-label="Код подтверждения нового email"
                       inputMode="numeric"
                       value={emailCode}
                       onChange={(e) => setEmailCode(e.target.value)}
                       placeholder="Код"
                     />
                     <Button type="button" variant="gradient" disabled={emailBusy} onClick={() => void submitEmailChange()}>
                       {emailBusy ? "Проверка…" : "Подтвердить"}
                     </Button>
                   </div>
                 </div>
               ) : null}
               <Button
                 type="button"
                 variant="gradient"
                 className="mt-5"
                 disabled={emailBusy}
                 onClick={() => void saveProfile()}
               >
                 {emailBusy ? "Сохранение…" : "Сохранить изменения"}
               </Button>
            </div>
          )}

          {tab === "addresses" && <AddressesPanel />}
          {tab === "legal" && <LegalEntitiesPanel />}
          {tab === "bonuses" && bonusesOn && <BonusTab />}

          {tab === "orders" && (
            <div className="space-y-4">
              {ordersError && (
                <p className="text-body-sm text-destructive">{ordersError}</p>
              )}
              {ordersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Заказов пока нет"
                  description="Оформите заказ на витрине — история появится здесь (нужна авторизация API)."
                  action={
                    <Button asChild variant="gradient">
                      <Link href="/catalog">В каталог</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="surface-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Заказ</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Статус</TableHead>
                        {bonusesOn ? <TableHead>Бонусы</TableHead> : null}
                        <TableHead>Сумма</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((o) => (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/account/orders/${o.id}`)}
                        >
                          <TableCell className="font-semibold">
                            {o.number}
                            <div className="text-caption font-normal text-muted-foreground">
                              {o.itemsCount} поз.
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{o.date}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                o.tone === "success" || o.tone === "warning"
                                  ? o.tone
                                  : "default"
                              }
                            >
                              {o.status}
                            </Badge>
                          </TableCell>
                          {bonusesOn ? (
                          <TableCell className="text-caption">
                            {o.bonusesSpent > 0 && (
                              <div className="text-muted-foreground">
                                −{formatBonus(o.bonusesSpent)}
                              </div>
                            )}
                            {o.bonusesEarned > 0 && (
                              <div className="font-semibold text-success">
                                +{formatBonus(o.bonusesEarned)}
                              </div>
                            )}
                            {o.bonusesSpent === 0 && o.bonusesEarned === 0 && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          ) : null}
                          <TableCell className="font-bold">{formatPrice(o.total)}</TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon-sm" aria-label="Детали">
                              <Link href={`/account/orders/${o.id}`}>
                                <ChevronRight className="size-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {tab === "configs" && <SavedBuildsPanel />}

          {tab === "favorites" &&
            (favProducts.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {favProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Heart}
                title="В избранном пусто"
                description="Добавляйте товары в избранное, чтобы вернуться к ним позже."
                action={
                  <Button asChild variant="gradient">
                    <Link href="/catalog">В каталог</Link>
                  </Button>
                }
              />
            ))}

          {tab === "compare" &&
            (cmpProducts.length ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-h4">Сравнение товаров</h2>
                    <p className="mt-1 text-body-sm text-muted-foreground">
                      {cmpProducts.length} из {MAX_COMPARE}
                      {cmpProducts.length < 2 && " · добавьте ещё товар для полноценного сравнения"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-body-sm font-medium">
                      <Switch checked={onlyDiffs} onCheckedChange={setOnlyDiffs} />
                      Только различия
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearCompare();
                        push({ variant: "info", title: "Список сравнения очищен" });
                      }}
                    >
                      <Trash2 className="size-4" /> Очистить
                    </Button>
                    {cmpProducts.length < MAX_COMPARE && (
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/catalog">Добавить товар</Link>
                      </Button>
                    )}
                  </div>
                </div>

                {cmpProducts.length === 1 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-body-sm text-foreground">
                    Выберите ещё хотя бы один товар в каталоге — иконка{" "}
                    <GitCompare className="inline size-3.5 align-text-bottom text-primary" /> на карточке.
                  </div>
                )}

                <CompareTable
                  products={cmpProducts}
                  onlyDiffs={onlyDiffs}
                  onRemove={(id) => {
                    removeFromCompare(id);
                    push({ variant: "info", title: "Убрано из сравнения" });
                  }}
                  onAddToCart={(p) => {
                    addToCart(p);
                    push({ variant: "success", title: "Добавлено в корзину", description: p.title, action: { label: "Перейти к оформлению", onClick: () => router.push("/checkout") } });
                  }}
                />
              </div>
            ) : (
              <EmptyState
                icon={GitCompare}
                title="Список сравнения пуст"
                description="Добавляйте до 4 товаров из каталога или карточки товара — появится панель сравнения внизу экрана."
                action={
                  <Button asChild variant="gradient">
                    <Link href="/catalog">В каталог</Link>
                  </Button>
                }
              />
            ))}

          {tab === "settings" && (
            <div className="surface-card divide-y divide-border p-6">
              <h2 className="pb-4 text-h4">Настройки</h2>

              {/* Смена пароля с кодом на почту */}
              <div className="flex flex-col gap-3 py-4">
                <div>
                  <span className="text-body-sm font-medium">Смена пароля</span>
                  <p className="text-caption text-muted-foreground">
                    Код подтверждения придёт на почту аккаунта.
                  </p>
                </div>
                {pwStage === "idle" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    disabled={pwBusy}
                    onClick={() => void sendPwCode()}
                  >
                    Отправить код на почту
                  </Button>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Код из письма"
                      value={pwCode}
                      onChange={(e) => setPwCode(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Новый пароль"
                      autoComplete="new-password"
                      value={pwPass}
                      onChange={(e) => setPwPass(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="Повторите пароль"
                      autoComplete="new-password"
                      value={pwPass2}
                      onChange={(e) => setPwPass2(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="gradient"
                      className="sm:col-span-3"
                      loading={pwBusy}
                      onClick={() => void submitPassword()}
                    >
                      Изменить пароль
                    </Button>
                  </div>
                )}
              </div>

              {(
                [
                  ["Email-уведомления о заказах", true],
                  ["Уведомления о начислении бонусов", true],
                ] as const
              ).map(([label, on]) => (
                <div key={label} className="flex items-center justify-between py-4">
                  <span className="text-body-sm font-medium">{label}</span>
                  <Switch defaultChecked={on} />
                </div>
              ))}

              {/*
                «Двухфакторная аутентификация» убрана: у покупателя в бэкенде нет
                ни endpoints, ни полей под неё — переключатель был декоративным
                (2FA TOTP есть только у staff в /api/v1/admin). «Новости и акции»
                привязана к реальной подписке бэкенда.
              */}
              <div className="flex items-center justify-between gap-6 py-4">
                <div className="min-w-0">
                  <span className="text-body-sm font-medium">Новости и акции</span>
                  <p className="text-caption text-muted-foreground">
                    {newsletter.subscribed
                      ? `Подписка активна${user?.email ? `: ${user.email}` : ""}.`
                      : "Подпишитесь, чтобы получать письма о новинках и акциях."}
                  </p>
                </div>
                <Switch
                  checked={newsletter.subscribed === true}
                  disabled={newsletter.busy}
                  onCheckedChange={(next) => void toggleNewsletter(next)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
