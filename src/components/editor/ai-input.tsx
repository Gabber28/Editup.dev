import { useState, type JSX } from "react";

export interface AIInputProps {
  onChange?(value: string): void;
  onSubmit?(value: string): void;
  placeholder?: string;
}

export function AIInput(props: AIInputProps): JSX.Element {
  const [value, setValue] = useState("");
  return (
    <form
      className="ai-input"
      onSubmit={(ev): void => {
        ev.preventDefault();
        if (!value.trim()) return;
        props.onSubmit?.(value);
        setValue("");
      }}
    >
      <input
        className="ai-input__field"
        type="text"
        value={value}
        placeholder={
          props.placeholder ??
          "Optional: describe extra changes (e.g. 'add hover glow')"
        }
        onChange={(ev): void => {
          const next = ev.currentTarget.value;
          setValue(next);
          props.onChange?.(next);
        }}
      />
    </form>
  );
}
