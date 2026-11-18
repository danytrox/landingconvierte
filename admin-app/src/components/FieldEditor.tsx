// Renders one schema field (and its children) as form controls.
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Field } from '@/lib/schema';
import { emptyItem, itemTitle } from '@/lib/schema';
import { moveItem, removeItem } from '@/lib/edit';

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  showAdvanced: boolean;
}

// Stable React keys for list items that are objects (survive reordering).
const ids = new WeakMap<object, number>();
let nextId = 0;
const keyOf = (item: unknown, index: number) => {
  if (item && typeof item === 'object') {
    if (!ids.has(item)) ids.set(item, ++nextId);
    return `o${ids.get(item)}`;
  }
  return `i${index}`;
};
// Replaces item i, carrying its key over to the edited copy so the row keeps its state.
const replaceAt = (items: unknown[], i: number, next: unknown) => {
  const old = items[i];
  if (old && typeof old === 'object' && next && typeof next === 'object' && ids.has(old)) ids.set(next, ids.get(old)!);
  return items.map((x, j) => (j === i ? next : x));
};

function Hint({ children }: { children?: string }) {
  return children ? <p className="text-sm leading-snug text-muted-foreground">{children}</p> : null;
}

export function FieldList({ fields, value, onChange, id, showAdvanced }: {
  fields: Field[]; value: unknown; onChange: (v: unknown) => void; id: string; showAdvanced: boolean;
}) {
  const rec = (value ?? {}) as Record<string, unknown>;
  return (
    <div className="grid gap-6">
      {fields.filter(f => showAdvanced || !f.advanced).map(f => (
        <FieldEditor
          key={f.name}
          field={f}
          id={`${id}.${f.name}`}
          value={rec[f.name]}
          showAdvanced={showAdvanced}
          onChange={v => onChange({ ...rec, [f.name]: v })}
        />
      ))}
    </div>
  );
}

export function FieldEditor(props: Props) {
  const { field } = props;
  if (field.widget === 'object') return <ObjectField {...props} />;
  if (field.widget === 'list') return field.fields ? <ObjectListField {...props} /> : <TextListField {...props} />;
  return <TextField {...props} />;
}

function AdvancedTag({ field }: { field: Field }) {
  return field.advanced ? <Badge variant="outline" className="ml-2 text-[0.7rem] text-muted-foreground">Avanzado</Badge> : null;
}

function TextField({ field, value, onChange, id }: Props) {
  const text = typeof value === 'string' ? value : '';
  const invalid = field.pattern && !new RegExp(field.pattern[0]).test(text);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-[0.95rem] font-semibold">
        {field.label}<AdvancedTag field={field} />
      </Label>
      {field.widget === 'text' ? (
        <Textarea id={id} value={text} onChange={e => onChange(e.target.value)} className="min-h-20 bg-background/60 text-base" />
      ) : field.widget === 'color' ? (
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label={`${field.label} (selector)`}
            value={/^#[0-9a-f]{6}$/i.test(text) ? text : '#000000'}
            onChange={e => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
          <Input id={id} value={text} onChange={e => onChange(e.target.value)} className="max-w-40 bg-background/60 font-mono" />
        </div>
      ) : (
        <Input id={id} value={text} aria-invalid={invalid || undefined} onChange={e => onChange(e.target.value)} className="bg-background/60 text-base" />
      )}
      {invalid && <p className="text-sm text-destructive">{field.pattern![1]}</p>}
      <Hint>{field.hint}</Hint>
    </div>
  );
}

function ObjectField({ field, value, onChange, id, showAdvanced }: Props) {
  const [open, setOpen] = useState(!field.collapsed);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-plano/40">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left font-semibold hover:bg-accent/50">
        <span>{field.label}<AdvancedTag field={field} /></span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-5">
        <Hint>{field.hint}</Hint>
        <FieldList fields={field.fields ?? []} value={value} onChange={onChange} id={id} showAdvanced={showAdvanced} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function IconButton({ label, onClick, disabled, children, destructive }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={e => { e.stopPropagation(); onClick(); }}
          className={cn(destructive && 'text-destructive hover:text-destructive')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ListHeader({ field, count }: { field: Field; count: number }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[0.95rem] font-semibold">{field.label}</span>
        <Badge variant="secondary">{count}</Badge>
        <AdvancedTag field={field} />
      </div>
      <Hint>{field.hint}</Hint>
    </div>
  );
}

function TextListField({ field, value, onChange, id }: Props) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const label = field.itemLabel ?? 'Elemento';
  return (
    <div className="grid gap-3">
      <ListHeader field={field} count={items.length} />
      <ol className="grid gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
            <Input
              id={`${id}.${i}`}
              aria-label={`${label} ${i + 1}`}
              value={item}
              onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="bg-background/60 text-base"
            />
            <IconButton label="Subir" disabled={i === 0} onClick={() => onChange(moveItem(items, i, i - 1))}><ArrowUp /></IconButton>
            <IconButton label="Bajar" disabled={i === items.length - 1} onClick={() => onChange(moveItem(items, i, i + 1))}><ArrowDown /></IconButton>
            <IconButton label="Eliminar" destructive disabled={(field.min ?? 0) >= items.length} onClick={() => onChange(removeItem(items, i))}><Trash2 /></IconButton>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...items, ''])}>
        <Plus /> Agregar {label.toLowerCase()}
      </Button>
    </div>
  );
}

function ObjectListField({ field, value, onChange, id, showAdvanced }: Props) {
  const items = Array.isArray(value) ? (value as unknown[]) : [];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<number | null>(null);
  const toggle = (key: string, isOpen: boolean) => setOpen(prev => {
    const next = new Set(prev);
    if (isOpen) next.add(key); else next.delete(key);
    return next;
  });
  const add = () => {
    const item = emptyItem(field);
    toggle(keyOf(item, items.length), true);
    onChange([...items, item]);
  };
  const canRemove = items.length > (field.min ?? 0);

  return (
    <div className="grid gap-3">
      <ListHeader field={field} count={items.length} />
      <ul className="grid gap-2">
        {items.map((item, i) => {
          const key = keyOf(item, i);
          const isOpen = open.has(key);
          return (
            <li key={key}>
              <Collapsible open={isOpen} onOpenChange={o => toggle(key, o)} className={cn('rounded-lg border bg-plano/40 transition-colors', isOpen ? 'border-primary/40' : 'border-border')}>
                <div className="flex items-center gap-1 pr-2">
                  <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-accent/40">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/60 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="truncate font-medium">{itemTitle(field, item, i)}</span>
                    <ChevronDown className={cn('ml-auto size-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                  </CollapsibleTrigger>
                  <IconButton label="Subir" disabled={i === 0} onClick={() => onChange(moveItem(items, i, i - 1))}><ArrowUp /></IconButton>
                  <IconButton label="Bajar" disabled={i === items.length - 1} onClick={() => onChange(moveItem(items, i, i + 1))}><ArrowDown /></IconButton>
                  <IconButton label="Eliminar" destructive disabled={!canRemove} onClick={() => setConfirm(i)}><Trash2 /></IconButton>
                </div>
                <CollapsibleContent className="border-t border-border px-4 py-5">
                  <FieldList
                    fields={field.fields ?? []}
                    value={item}
                    id={`${id}.${i}`}
                    showAdvanced={showAdvanced}
                    onChange={v => onChange(replaceAt(items, i, v))}
                  />
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={add}>
        <Plus /> Agregar a {field.label.toLowerCase()}
      </Button>

      <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{confirm !== null ? itemTitle(field, items[confirm], confirm) : ''}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita de {field.label.toLowerCase()}. No se publica hasta que presiones «Publicar cambios», y puedes deshacerlo con «Descartar cambios».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
              onClick={() => { if (confirm !== null) onChange(removeItem(items, confirm)); setConfirm(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
