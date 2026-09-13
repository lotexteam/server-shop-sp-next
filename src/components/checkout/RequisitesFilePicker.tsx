"use client";

import { useRef, useState } from "react";
import { FileUp, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** id сохраняется (например "rq-file"): сабмит формы читает files по нему. */
  id: string;
  accept?: string;
};

/**
 * Стилизованный выбор файла: невидимый input растянут на всю зону,
 * поэтому клик и клавиатура работают как у обычного input type="file",
 * а снаружи — оформленная карточка вместо голого HTML-контрола.
 */
export function RequisitesFilePicker({ id, accept }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "relative rounded-md border border-dashed p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        fileName
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-secondary/40 hover:border-primary/40"
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      {fileName ? (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
            <Paperclip className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm font-semibold">Файл прикреплён</span>
            <span className="block truncate text-caption text-muted-foreground">{fileName}</span>
          </span>
          <button
            type="button"
            className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Убрать файл"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setFileName(null);
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient-soft text-primary">
            <FileUp className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-body-sm font-semibold">Прикрепить файл реквизитов</span>
            <span className="block text-caption text-muted-foreground">
              PDF, DOC, DOCX или картинка — вместо заполнения полей
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
