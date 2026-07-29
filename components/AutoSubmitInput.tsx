"use client";

import { useRef, type InputHTMLAttributes } from "react";

/**
 * The design commits these fields on change rather than behind a save button.
 * A bare <input> inside a server-action form only submits on Enter, and not at
 * all when the field has siblings — so commit explicitly on blur and on Enter.
 */
export function AutoSubmitInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const initial = useRef(String(props.defaultValue ?? ""));

  return (
    <input
      {...props}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      onBlur={(e) => {
        if (e.currentTarget.value !== initial.current) {
          initial.current = e.currentTarget.value;
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
