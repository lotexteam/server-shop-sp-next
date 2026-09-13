"use client";

import { useState } from "react";
import { Building2, Plus, Star, Trash2, Pencil } from "lucide-react";
import { useAuth, type LegalEntity } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const emptyForm = (): Omit<LegalEntity, "id"> => ({
  name: "",
  inn: "",
  kpp: "",
  ogrn: "",
  legalAddress: "",
  bankName: "",
  bik: "",
  checkingAccount: "",
  corrAccount: "",
  isDefault: false,
});

export function LegalEntitiesPanel() {
  const {
    legalEntities,
    addLegalEntity,
    updateLegalEntity,
    removeLegalEntity,
    setDefaultLegalEntity,
  } = useAuth();
  const { push } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm({ ...emptyForm(), isDefault: legalEntities.length === 0 });
  };

  const startEdit = (e: LegalEntity) => {
    setCreating(false);
    setEditingId(e.id);
    setForm({
      name: e.name,
      inn: e.inn,
      kpp: e.kpp ?? "",
      ogrn: e.ogrn ?? "",
      legalAddress: e.legalAddress,
      bankName: e.bankName ?? "",
      bik: e.bik ?? "",
      checkingAccount: e.checkingAccount ?? "",
      corrAccount: e.corrAccount ?? "",
      isDefault: e.isDefault,
    });
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.name.trim() || !form.inn.trim() || !form.legalAddress.trim()) {
      push({ variant: "warning", title: "Укажите название, ИНН и юр. адрес" });
      return;
    }
    try {
      if (editingId) {
        await updateLegalEntity(editingId, form);
        push({ variant: "success", title: "Реквизиты обновлены" });
      } else {
        await addLegalEntity(form);
        push({ variant: "success", title: "Юр. лицо добавлено" });
      }
      cancel();
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось сохранить организацию",
      });
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await setDefaultLegalEntity(id);
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось обновить организацию",
      });
    }
  };

  const remove = async (id: string) => {
    try {
      await removeLegalEntity(id);
      push({ variant: "info", title: "Организация удалена" });
    } catch (err) {
      push({
        variant: "warning",
        title: err instanceof Error ? err.message : "Не удалось удалить организацию",
      });
    }
  };

  const showForm = creating || editingId != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h4">Юридические лица</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Для оплаты по счёту и закрывающих документов (B2B)
          </p>
        </div>
        {!showForm && (
          <Button variant="gradient" size="sm" onClick={startCreate}>
            <Plus className="size-4" /> Добавить организацию
          </Button>
        )}
      </div>

      {showForm && (
        <div className="surface-card space-y-4 p-5">
          <h3 className="text-h6">{editingId ? "Редактирование" : "Новая организация"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Наименование</Label>
              <Input
                placeholder='ООО «Компания»'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ИНН</Label>
              <Input
                placeholder="7701234567"
                value={form.inn}
                onChange={(e) => setForm((f) => ({ ...f, inn: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>КПП</Label>
              <Input
                placeholder="770101001"
                value={form.kpp}
                onChange={(e) => setForm((f) => ({ ...f, kpp: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ОГРН</Label>
              <Input
                placeholder="1027700123456"
                value={form.ogrn}
                onChange={(e) => setForm((f) => ({ ...f, ogrn: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Юридический адрес</Label>
              <Input
                placeholder="Индекс, город, улица…"
                value={form.legalAddress}
                onChange={(e) => setForm((f) => ({ ...f, legalAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Банк</Label>
              <Input
                placeholder="ПАО «Сбербанк»"
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>БИК</Label>
              <Input
                value={form.bik}
                onChange={(e) => setForm((f) => ({ ...f, bik: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Расчётный счёт</Label>
              <Input
                value={form.checkingAccount}
                onChange={(e) => setForm((f) => ({ ...f, checkingAccount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Корр. счёт</Label>
              <Input
                value={form.corrAccount}
                onChange={(e) => setForm((f) => ({ ...f, corrAccount: e.target.value }))}
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
            Организация по умолчанию
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

      {!legalEntities.length && !showForm ? (
        <EmptyState
          icon={Building2}
          title="Нет юридических лиц"
          description="Добавьте организацию, чтобы выставлять счета с НДС при оформлении."
          action={
            <Button variant="gradient" onClick={startCreate}>
              <Plus className="size-4" /> Добавить
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {legalEntities.map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-card",
                e.isDefault ? "border-primary/40 ring-1 ring-primary/15" : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-gradient-soft text-primary">
                    <Building2 className="size-5" />
                  </span>
                  <div>
                    <p className="text-body font-semibold">{e.name}</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      ИНН {e.inn}
                      {e.kpp ? ` · КПП ${e.kpp}` : ""}
                      {e.ogrn ? ` · ОГРН ${e.ogrn}` : ""}
                    </p>
                    <p className="mt-1 text-body-sm text-muted-foreground">{e.legalAddress}</p>
                    {e.bankName && (
                      <p className="mt-1 text-caption text-muted-foreground">
                        {e.bankName}
                        {e.bik ? ` · БИК ${e.bik}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                {e.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-caption font-semibold text-primary">
                    <Star className="size-3 fill-primary" /> По умолчанию
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!e.isDefault && (
                  <Button size="sm" variant="secondary" onClick={() => void makeDefault(e.id)}>
                    Сделать основным
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                  <Pencil className="size-3.5" /> Изменить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove(e.id)}
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
