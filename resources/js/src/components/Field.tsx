import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

type FieldRender = {
  describedBy?: string;
  errorId: string;
  hintId: string;
};

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
}: BaseProps & { id: string; children: (render: FieldRender) => ReactNode }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field" data-field={error ? 'invalid' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ describedBy, errorId, hintId })}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode };

export function TextField({ label, error, hint, required, prefix, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      {(render: FieldRender) => (
        <div className="input-wrap">
          {prefix && <span className="input-prefix">{prefix}</span>}
          <input
            {...props}
            id={fieldId}
            required={required}
            data-error={error ? render.errorId : undefined}
            aria-describedby={render.describedBy}
            aria-invalid={error ? true : undefined}
            className={`input ${prefix ? 'input--prefixed' : ''} ${props.className ?? ''}`}
          />
        </div>
      )}
    </FieldShell>
  );
}

type SelectFieldProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

export function SelectField({ label, error, hint, required, id, children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      {(render: FieldRender) => (
        <select
          {...props}
          id={fieldId}
          required={required}
          data-error={error ? render.errorId : undefined}
          aria-describedby={render.describedBy}
          aria-invalid={error ? true : undefined}
          className={`input select ${props.className ?? ''}`}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, error, hint, required, id, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      {(render: FieldRender) => (
        <textarea
          {...props}
          id={fieldId}
          required={required}
          data-error={error ? render.errorId : undefined}
          aria-describedby={render.describedBy}
          aria-invalid={error ? true : undefined}
          className={`input textarea ${props.className ?? ''}`}
        />
      )}
    </FieldShell>
  );
}

interface CheckFieldProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckField({ label, hint, checked, onChange, disabled }: CheckFieldProps) {
  const id = useId();
  return (
    <div className="check-field">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
        <label htmlFor={id}>{label}</label>
        {hint && <p className="field__hint">{hint}</p>}
      </div>
    </div>
  );
}
