"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface OtpPinInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}

const PIN_LENGTH = 6;

export function OtpPinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  idPrefix = "otp-pin",
}: OtpPinInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const lastSubmittedRef = useRef<string>("");

  const digits = Array.from({ length: PIN_LENGTH }, (_, idx) => value[idx] ?? "");

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === PIN_LENGTH && /^\d{6}$/.test(value)) {
      if (lastSubmittedRef.current !== value) {
        lastSubmittedRef.current = value;
        onComplete?.(value);
      }
    } else if (value.length < PIN_LENGTH) {
      lastSubmittedRef.current = "";
    }
  }, [value, onComplete]);

  function commitDigits(nextRaw: string) {
    const clean = nextRaw.replace(/\D/g, "").slice(0, PIN_LENGTH);
    onChange(clean);
  }

  function handleChange(index: number, raw: string) {
    const onlyDigits = raw.replace(/\D/g, "");
    if (!onlyDigits) {
      const next = digits.slice();
      next[index] = "";
      commitDigits(next.join(""));
      return;
    }

    // Vollständiges Einfügen / Autofill (z. B. iOS/Android Mail-Code)
    if (onlyDigits.length > 1) {
      commitDigits(onlyDigits);
      const focusIdx = Math.min(onlyDigits.length, PIN_LENGTH - 1);
      inputsRef.current[focusIdx]?.focus();
      return;
    }

    const next = digits.slice();
    next[index] = onlyDigits[0];
    commitDigits(next.join(""));
    if (index < PIN_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = digits.slice();
        next[index] = "";
        commitDigits(next.join(""));
      } else if (index > 0) {
        const next = digits.slice();
        next[index - 1] = "";
        commitDigits(next.join(""));
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    commitDigits(pasted);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
  }

  return (
    <div
      className="mx-auto grid w-full max-w-[332px] grid-cols-6 gap-1.5 sm:gap-2.5"
      role="group"
      aria-label="6-stellige Login-PIN"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          id={`${idPrefix}-${index}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          aria-label={`Ziffer ${index + 1} von ${PIN_LENGTH}`}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-12 w-full min-w-0 sm:h-14 rounded-xl border-2 bg-background text-center font-mono text-xl sm:text-2xl font-extrabold text-foreground shadow-xs transition-all",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
            digit ? "border-primary/60" : "border-input",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}
