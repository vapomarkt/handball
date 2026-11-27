"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  DEFAULT_PHONE_COUNTRY,
  filterPhoneCountryOptions,
  getPhoneCountryOptions,
  normalizePhoneNumber,
  parsePhoneForInput,
  stripLeadingTrunkZero,
  type CountryCode,
  type PhoneCountryOption,
} from "@/domain/schemas/phone";
import { cn } from "@/lib/utils";

const COUNTRY_PLACEHOLDERS: Partial<Record<CountryCode, string>> = {
  DE: "170 1234567",
  AT: "664 1234567",
  CH: "79 123 45 67",
  US: "202 555 0199",
  CA: "416 555 0199",
  GB: "7700 900123",
  FR: "6 12 34 56 78",
  NL: "6 12345678",
  IT: "06 1234 5678",
  ES: "612 34 56 78",
  DK: "20 12 34 56",
  PL: "512 345 678",
  TR: "532 123 45 67",
};

export interface PhoneInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-describedby"?: string;
}

export function PhoneInput({
  id,
  name,
  value,
  onChange,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  disabled = false,
  required = false,
  className,
  "aria-describedby": ariaDescribedBy,
}: PhoneInputProps) {
  const allCountries = React.useMemo(() => getPhoneCountryOptions("de"), []);

  const initialParsed = React.useMemo(
    () => parsePhoneForInput(value, defaultCountry),
    // Nur für Initialisierung; externe Wertänderungen werden über `syncedValue` erkannt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [country, setCountry] = React.useState<CountryCode>(
    initialParsed.country
  );
  const [nationalInput, setNationalInput] = React.useState<string>(
    initialParsed.nationalDisplay
  );
  const [syncedValue, setSyncedValue] = React.useState<string>(value);
  const [touched, setTouched] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [openUpward, setOpenUpward] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Wenn sich `value` von außen ändert (z. B. Formular-Reset), lokalen Zustand sauber synchronisieren.
  if (value !== syncedValue) {
    setSyncedValue(value);
    const parsed = parsePhoneForInput(value, defaultCountry);
    setCountry(parsed.country);
    setNationalInput(parsed.nationalDisplay);
    if (!value) {
      setTouched(false);
    }
  }

  const selectedOption = React.useMemo<PhoneCountryOption>(
    () =>
      allCountries.find((c) => c.code === country) ??
      allCountries.find((c) => c.code === DEFAULT_PHONE_COUNTRY) ??
      allCountries[0],
    [allCountries, country]
  );

  const filteredCountries = React.useMemo(
    () => filterPhoneCountryOptions(allCountries, search),
    [allCountries, search]
  );

  const safeHighlightedIndex =
    filteredCountries.length === 0
      ? 0
      : Math.min(highlightedIndex, filteredCountries.length - 1);

  const validation = React.useMemo(
    () =>
      nationalInput.trim() === ""
        ? { ok: true as const, e164: null }
        : normalizePhoneNumber(nationalInput, country),
    [nationalInput, country]
  );

  const showInlineError =
    touched && nationalInput.trim() !== "" && !validation.ok;

  // Außerhalb-Klick schließt die Länderliste
  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Suchfeld fokussieren, sobald Dropdown geöffnet wird
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  function emitValue(next: string) {
    setSyncedValue(next);
    onChange(next);
  }

  function buildOutgoingValue(
    rawNational: string,
    activeCountry: CountryCode,
    dialCode: string
  ): string {
    const trimmed = rawNational.trim();
    if (!trimmed) return "";

    const normalized = normalizePhoneNumber(trimmed, activeCountry);
    if (normalized.ok && normalized.e164) {
      return normalized.e164;
    }

    // Falls noch unvollständig oder ungültig, gewählte Landesvorwahl mitgeben,
    // damit die Server-Validierung den korrekten Länderkontext hat.
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
      return trimmed;
    }
    return `${dialCode} ${trimmed}`;
  }

  function handleNationalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    if (raw.trim() === "") {
      setNationalInput("");
      emitValue("");
      return;
    }

    // Internationale Eingabe oder Copy & Paste erkennen (z. B. "+1 202 555 0199", "+49 (0) 170 ...", "0043 664 ...")
    const compact = raw.replace(/[\s\-/().]/g, "");
    const looksInternational =
      raw.trim().startsWith("+") || /^00[1-9]\d{4,}/.test(compact);

    if (looksInternational) {
      const parsed = parsePhoneForInput(raw, country);
      if (parsed.isValid && parsed.e164) {
        setCountry(parsed.country);
        setNationalInput(parsed.nationalDisplay);
        emitValue(parsed.e164);
        return;
      }
    }

    // Führende "0" bzw. "(0)" automatisch bereinigen (z. B. "0170 1234567" -> "170 1234567"),
    // ohne "00..." (internationale Vorwahl) oder Sonderländer wie Italien (+39) anzutasten.
    const cleaned = stripLeadingTrunkZero(raw, country);
    setNationalInput(cleaned);
    emitValue(buildOutgoingValue(cleaned, country, selectedOption.dialCode));
  }

  function handleBlur() {
    setTouched(true);
    const trimmed = nationalInput.trim();
    if (!trimmed) return;

    const parsed = parsePhoneForInput(trimmed, country);
    if (parsed.isValid && parsed.e164) {
      setCountry(parsed.country);
      setNationalInput(parsed.nationalDisplay);
      emitValue(parsed.e164);
    }
  }

  function toggleDropdown() {
    if (disabled) return;
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 290 && rect.top > 240);
      setSearch("");
      setHighlightedIndex(0);
    }
    setOpen((prev) => !prev);
  }

  function handleSelectCountry(option: PhoneCountryOption) {
    setCountry(option.code);
    setOpen(false);
    setSearch("");

    const trimmed = nationalInput.trim();
    if (trimmed) {
      const cleaned = stripLeadingTrunkZero(trimmed, option.code);
      const parsed = parsePhoneForInput(cleaned, option.code);
      if (parsed.isValid && parsed.e164) {
        setNationalInput(parsed.nationalDisplay);
        emitValue(parsed.e164);
      } else {
        setNationalInput(cleaned);
        emitValue(buildOutgoingValue(cleaned, option.code, option.dialCode));
      }
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleDropdownKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Verhindert, dass ein umschließender Radix-Dialog ebenfalls geschlossen wird.
      e.stopPropagation();
      setOpen(false);
      setSearch("");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCountries.length === 0
          ? 0
          : (prev + 1) % filteredCountries.length
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredCountries.length === 0
          ? 0
          : (prev - 1 + filteredCountries.length) % filteredCountries.length
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredCountries[safeHighlightedIndex];
      if (target) {
        handleSelectCountry(target);
      }
    }
  }

  const placeholder = COUNTRY_PLACEHOLDERS[country] ?? "Telefonnummer";
  const showPinnedDivider = search.trim() === "";
  const errorId = id ? `${id}-error` : undefined;
  const combinedDescribedBy = [
    ariaDescribedBy,
    showInlineError ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0", className)}>
      <div
        className={cn(
          "flex h-11 w-full min-w-0 items-stretch rounded-lg border bg-background shadow-2xs transition-colors focus-within:ring-2 focus-within:ring-ring",
          showInlineError
            ? "border-red-500 focus-within:ring-red-500/40"
            : "border-border",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          aria-label={`Landesvorwahl wählen (${selectedOption.name} ${selectedOption.dialCode})`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-l-lg border-r border-border bg-muted/40 px-2 sm:px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none cursor-pointer disabled:cursor-not-allowed"
          title={`${selectedOption.name} (${selectedOption.dialCode})`}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {selectedOption.flag}
          </span>
          <span className="font-mono text-xs sm:text-sm tabular-nums">
            {selectedOption.dialCode}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={nationalInput}
          onChange={handleNationalChange}
          onBlur={handleBlur}
          aria-invalid={showInlineError || undefined}
          aria-describedby={combinedDescribedBy || undefined}
          className="h-full min-w-0 flex-1 rounded-r-lg bg-transparent px-2.5 sm:px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {open && (
        <div
          onKeyDown={handleDropdownKeyDown}
          className={cn(
            "absolute left-0 right-0 z-50 w-full max-w-sm rounded-xl border border-border bg-card text-card-foreground shadow-lg",
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Land oder Vorwahl suchen (z. B. USA, +1)…"
              aria-label="Land oder Vorwahl suchen"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-label="Landesvorwahl"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Kein Land gefunden.
              </p>
            ) : (
              filteredCountries.map((option, index) => {
                const isSelected = option.code === country;
                const isHighlighted = index === safeHighlightedIndex;
                const prevOption = index > 0 ? filteredCountries[index - 1] : null;
                const renderDivider =
                  showPinnedDivider &&
                  !option.pinned &&
                  prevOption?.pinned === true;

                return (
                  <React.Fragment key={option.code}>
                    {renderDivider && (
                      <div
                        role="separator"
                        className="my-1 border-t border-border px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Alle Länder
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => handleSelectCountry(option)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                        isHighlighted && "bg-muted",
                        isSelected && "font-semibold text-primary"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-base leading-none"
                        >
                          {option.flag}
                        </span>
                        <span className="truncate">{option.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums">
                        {option.dialCode}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}

      {showInlineError && !validation.ok && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {validation.error}
        </p>
      )}
    </div>
  );
}
