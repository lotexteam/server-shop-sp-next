"use client";

import { useState } from "react";
import { MapPin, Plus, Star, Trash2, Pencil } from "lucide-react";
import { useAuth, type UserAddress } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const emptyForm = (): Omit<UserAddress, "id"> => ({
  label: "",
  city: "",
  street: "",
  zip: "",
  recipient: "",
  phone: "",
  isDefault: false,
});

export function AddressesPanel() {
  const { addresses, addAddress, updateAddress, removeAddress, setDefaultAddress } = useAuth();
  const { push } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ ...emptyForm(), isDefault: addresses.length === 0 });
  };

  const startEdit = (a: UserAddress) => {
    setCreating(false);
    setEditingId(a.id);
    setForm({
      label: a.label,
      city: a.city,
      street: a.street,
      zip: a.zip ?? "",
      recipient: a.recipient ?? "",
      phone: a.phone ?? "",
      isDefault: a.isDefault,
    });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.label.trim() || !form.city.trim() || !form.street.trim()) {
      push({ variant: "warning", title: "Заполните метку, город и улицу" });
      return;
    }
    try {
      if (editingId) {
        await updateAddress(editingId, form);
        push({ variant: "success", title: "Адрес обновлён" });
      } else {
        await addAddress(form);
        push({ variant: "success", title: "Адрес добавлен" });
      }
      cancel();
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось сохранить адрес",
      });
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await setDefaultAddress(id);
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось обновить адрес",
      });
    }
  };

  const remove = async (id: string) => {
    try {
      await removeAddress(id);
      push({ variant: "info", title: "Адрес удалён" });
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось удалить адрес",
      });
    }
  };

  const showForm = creating || editingId != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h4">Адреса доставки</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Сохранённые адреса подставляются при оформлении заказа
          </p>
        </div>
        {!showForm && (
          <Button variant="gradient" size="sm" onClick={startCreate}>
            <Plus className="size-4" /> Добавить адрес
          </Button>
        )}
      </div>

      {showForm && (
        <div className="surface-card space-y-4 p-5">
          <h3 className="text-h6">{editingId ? "Редактирование" : "Новый адрес"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Метка</Label>
              <Input
                placeholder="Офис, дом, склад…"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Индекс</Label>
              <Input
                placeholder="115432"
                value={form.zip}
                onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Город</Label>
              <Input
                placeholder="Москва"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Улица, дом, квартира/офис</Label>
              <Input
                placeholder="ул. Серверная, 42, оф. 301"
                value={form.street}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Получатель</Label>
              <Input
                placeholder="ФИО"
                value={form.recipient}
                onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input
                placeholder="+7 …"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Адрес по умолчанию
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="gradient" onClick={save}>
              Сохранить
            </Button>
            <Button variant="outline" onClick={cancel}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {!addresses.length && !showForm ? (
        <EmptyState
          icon={MapPin}
          title="Адресов пока нет"
          description="Добавьте адрес доставки — он появится при оформлении заказа."
          action={
            <Button variant="gradient" onClick={startCreate}>
              <Plus className="size-4" /> Добавить
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={cn(
                "relative rounded-xl border bg-card p-4 shadow-card",
                a.isDefault ? "border-primary/40 ring-1 ring-primary/15" : "border-border"
              )}
            >
              {a.isDefault && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-semibold text-primary">
                  <Star className="size-3 fill-primary" /> По умолчанию
                </span>
              )}
              <p className="pr-24 text-body font-semibold">{a.label}</p>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {[a.zip, a.city, a.street].filter(Boolean).join(", ")}
              </p>
              {(a.recipient || a.phone) && (
                <p className="mt-1 text-caption text-muted-foreground">
                  {[a.recipient, a.phone].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!a.isDefault && (
                  <Button size="sm" variant="secondary" onClick={() => void makeDefault(a.id)}>
                    Сделать основным
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(a)}>
                  <Pencil className="size-3.5" /> Изменить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove(a.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
