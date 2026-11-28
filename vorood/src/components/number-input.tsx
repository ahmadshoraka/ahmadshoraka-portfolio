"use client";

import type { InputHTMLAttributes } from "react";

export type NumberValue = number | "";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: NumberValue;
  onChange: (value: NumberValue) => void;
};

/** Number field that can be fully cleared (no sticky 0). */
export function NumberInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="number"
      value={value === "" ? "" : value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange("");
          return;
        }
        const next = Number(raw);
        onChange(Number.isFinite(next) ? next : "");
      }}
    />
  );
}

export function numberOr(value: NumberValue, fallback: number): number {
  return value === "" || !Number.isFinite(value) ? fallback : value;
}
