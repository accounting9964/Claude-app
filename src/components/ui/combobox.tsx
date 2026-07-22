import * as React from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type ComboboxItem = { value: string; label: string };

export function Combobox({
  items,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  emptyText = "No results.",
  createLabel = "Add",
  disabled,
  className,
}: {
  items: ComboboxItem[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onCreate?: (input: string) => void | Promise<void>;
  placeholder?: string;
  emptyText?: string;
  createLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const canCreate = onCreate && query.trim() && !items.some((i) => i.label.toLowerCase() === query.trim().toLowerCase());

  const options = React.useMemo(() => {
    const opts = [...filtered];
    if (canCreate) {
      opts.push({ value: `__create__${query.trim()}`, label: `${createLabel} "${query.trim()}"` });
    }
    return opts;
  }, [filtered, canCreate, query, createLabel]);

  React.useEffect(() => {
    setHighlighted(0);
  }, [options.length]);

  React.useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [open, selected?.label]);

  async function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.value.startsWith("__create__")) {
      await onCreate!(query.trim());
      setOpen(false);
    } else {
      onChange(option.value);
      setOpen(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      setOpen(true);
      if (options.length > 0) {
        selectOption(highlighted);
      }
    } else if (e.key === "Tab") {
      if (open && query.trim() && options.length > 0) {
        selectOption(highlighted);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  React.useEffect(() => {
    if (listRef.current && open) {
      const el = listRef.current.querySelector(`[data-index="${highlighted}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted, open]);

  return (
    <div className={cn("relative", className)}>
      <Input
        value={open ? query : (selected?.label ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.label ?? "");
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            <ul>
              {options.map((item, index) => (
                <li
                  key={item.value}
                  data-index={index}
                  className={cn(
                    "px-3 py-2 text-sm cursor-pointer flex items-center gap-2",
                    index === highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(index);
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                >
                  {item.value.startsWith("__create__") ? (
                    <Plus className="h-4 w-4 shrink-0" />
                  ) : (
                    <Check className={cn("h-4 w-4 shrink-0", value === item.value ? "opacity-100" : "opacity-0")} />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
