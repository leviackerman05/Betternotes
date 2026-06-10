import { useEffect, useRef, useState } from "react";
import styles from "./Dialog.module.css";

interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  open,
  title,
  label,
  defaultValue = "",
  confirmLabel = "Save",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        {label && <label className={styles.label}>{label}</label>}
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  warning?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PasswordDialogProps {
  open: boolean;
  title: string;
  message?: string;
  error?: string;
  confirmLabel?: string;
  requireConfirm?: boolean;
  onConfirm: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

export function PasswordDialog({
  open,
  title,
  message,
  error,
  confirmLabel = "Confirm",
  requireConfirm = false,
  onConfirm,
  onCancel,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const valid =
    password.length >= 4 &&
    (!requireConfirm || (confirm.length >= 4 && password === confirm));

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        {message && <p className={styles.message}>{message}</p>}
        {error && <p className={styles.messageWarning}>{error}</p>}
        <label className={styles.label}>Password</label>
        <input
          ref={inputRef}
          type="password"
          className={styles.input}
          value={password}
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") onCancel();
          }}
        />
        {requireConfirm && (
          <>
            <label className={styles.label}>Confirm password</label>
            <input
              type="password"
              className={styles.input}
              value={confirm}
              disabled={submitting}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
                if (e.key === "Escape") onCancel();
              }}
            />
          </>
        )}
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={() => void submit()}
            disabled={!valid || submitting}
          >
            {submitting ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface UnsavedChangesDialogProps {
  open: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesDialog({
  open,
  saving,
  onSave,
  onDiscard,
}: UnsavedChangesDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h3 className={styles.title}>Unsaved changes</h3>
        <p className={styles.message}>
          You have unsaved settings. Do you want to save them before leaving?
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.discardBtn}
            onClick={onDiscard}
            disabled={saving}
          >
            Don&apos;t Save
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  warning,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        <p className={warning ? styles.messageWarning : styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
