import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const ModalBusy = createContext<((busy: boolean) => void) | null>(null);

export function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
export function ActionForm({
  children,
  submit,
  onSubmit,
  secondary,
}: {
  children: ReactNode;
  submit: string;
  onSubmit: (data: FormData) => Promise<void>;
  secondary?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setModalBusy = useContext(ModalBusy);
  return (
    <form
      className="action-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setModalBusy?.(true);
        setError("");
        try {
          await onSubmit(data);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not save your change. Please try again.",
          );
        } finally {
          setBusy(false);
          setModalBusy?.(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {secondary}
          <Button type="submit">{busy ? "Saving…" : submit}</Button>
        </div>
      </fieldset>
    </form>
  );
}
export function Modal({
  title,
  description,
  children,
  close,
}: {
  title: string;
  description: string;
  children: ReactNode;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [opener] = useState(() => document.activeElement);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        closeDisabled={busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target =
            opener instanceof HTMLElement && opener.isConnected
              ? opener
              : document.querySelector<HTMLElement>("main button");
          target?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ModalBusy value={setBusy}>{children}</ModalBusy>
      </DialogContent>
    </Dialog>
  );
}
