import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHONE_COUNTRY,
  filterPhoneCountryOptions,
  formatPhoneNumber,
  getPhoneCountryOptions,
  normalizePhoneNumber,
  optionalPhoneSchema,
  parsePhoneForInput,
  stripLeadingTrunkZero,
  toTelHref,
} from "@/domain/schemas/phone";

describe("Telefonnummern-Normalisierung (E.164) & Länderliste", () => {
  it("normalisiert deutsche Nummern mit oder ohne führende 0 einheitlich nach E.164", () => {
    const variants = [
      "0170 1234567",
      "170 1234567",
      "0170/123-4567",
      "(0170) 1234567",
      "+49 170 1234567",
      "+49 (0) 170 1234567",
      "+49 0170 1234567",
      "0049 170 1234567",
      "+491701234567",
    ];

    for (const raw of variants) {
      const res = normalizePhoneNumber(raw);
      expect(res, `Variante "${raw}"`).toEqual({
        ok: true,
        e164: "+491701234567",
        country: "DE",
      });
    }
  });

  it("normalisiert internationale Nummern inkl. USA, DACH und Italien (mit führender 0)", () => {
    expect(normalizePhoneNumber("+1 (202) 555-0199")).toEqual({
      ok: true,
      e164: "+12025550199",
      country: "US",
    });
    expect(normalizePhoneNumber("(202) 555-0199", "US")).toEqual({
      ok: true,
      e164: "+12025550199",
      country: "US",
    });
    expect(normalizePhoneNumber("0043 664 1234567")).toEqual({
      ok: true,
      e164: "+436641234567",
      country: "AT",
    });
    expect(normalizePhoneNumber("0664 1234567", "AT")).toEqual({
      ok: true,
      e164: "+436641234567",
      country: "AT",
    });
    expect(normalizePhoneNumber("079 123 45 67", "CH")).toEqual({
      ok: true,
      e164: "+41791234567",
      country: "CH",
    });
    // Italien behält die führende 0 bei Festnetznummern
    expect(normalizePhoneNumber("06 1234 5678", "IT")).toEqual({
      ok: true,
      e164: "+390612345678",
      country: "IT",
    });
  });

  it("entfernt beim Tippen eine einzelne führende 0 für DE/AT/CH, schützt aber 00 und Italien", () => {
    expect(stripLeadingTrunkZero("0170 1234567", "DE")).toBe("170 1234567");
    expect(stripLeadingTrunkZero("(0) 170 1234567", "DE")).toBe("170 1234567");
    expect(stripLeadingTrunkZero("0664 1234567", "AT")).toBe("664 1234567");
    // Einzelne "0" bleibt kurz stehen, damit "0043..." getippt werden kann
    expect(stripLeadingTrunkZero("0", "DE")).toBe("0");
    expect(stripLeadingTrunkZero("0043 664 1234567", "DE")).toBe(
      "0043 664 1234567"
    );
    // Italienische Festnetznummern behalten ihre führende 0
    expect(stripLeadingTrunkZero("06 1234 5678", "IT")).toBe("06 1234 5678");
  });

  it("zerlegt bestehende und eingefügte Nummern korrekt für die PhoneInput-Komponente", () => {
    expect(parsePhoneForInput("")).toEqual({
      country: DEFAULT_PHONE_COUNTRY,
      nationalDisplay: "",
      e164: null,
      isValid: true,
    });
    expect(parsePhoneForInput("+491705550199")).toEqual({
      country: "DE",
      nationalDisplay: "170 5550199",
      e164: "+491705550199",
      isValid: true,
    });
    expect(parsePhoneForInput("+1 (202) 555-0199")).toEqual({
      country: "US",
      nationalDisplay: "202 555 0199",
      e164: "+12025550199",
      isValid: true,
    });
    expect(parsePhoneForInput("0043 664 1234567")).toEqual({
      country: "AT",
      nationalDisplay: "664 1234567",
      e164: "+436641234567",
      isValid: true,
    });
  });

  it("formatiert Nummern einheitlich für die Anzeige und erzeugt tel:-Links", () => {
    expect(formatPhoneNumber("+491705550199")).toBe("+49 170 5550199");
    expect(formatPhoneNumber("0170 5550199")).toBe("+49 170 5550199");
    expect(formatPhoneNumber("+12025550199")).toBe("+1 202 555 0199");
    expect(toTelHref("0170 5550199")).toBe("tel:+491705550199");
    expect(toTelHref("ungültig")).toBeNull();
  });

  it("stellt die vollständige Länderliste bereit mit DACH (DE zuerst) oben und durchsuchbaren Aliasen", () => {
    const countries = getPhoneCountryOptions("de");
    expect(countries.length).toBeGreaterThanOrEqual(240);
    expect(countries[0].code).toBe("DE");
    expect(countries[0].dialCode).toBe("+49");
    expect(countries[1].code).toBe("AT");
    expect(countries[2].code).toBe("CH");

    const usByAlias = filterPhoneCountryOptions(countries, "USA");
    expect(usByAlias.some((c) => c.code === "US" && c.dialCode === "+1")).toBe(
      true
    );

    const atByUnaccented = filterPhoneCountryOptions(countries, "Osterreich");
    expect(atByUnaccented.some((c) => c.code === "AT")).toBe(true);

    const byDialCode = filterPhoneCountryOptions(countries, "+49");
    expect(byDialCode[0].code).toBe("DE");
  });

  it("validiert über optionalPhoneSchema sauber und lehnt ungültige Eingaben ab", () => {
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
    expect(optionalPhoneSchema.parse(null)).toBeNull();
    expect(optionalPhoneSchema.parse("")).toBeNull();
    expect(optionalPhoneSchema.parse("   ")).toBeNull();
    expect(optionalPhoneSchema.parse("0170 5550199")).toBe("+491705550199");
    expect(optionalPhoneSchema.parse("+1 202 555 0199")).toBe("+12025550199");

    const invalidShort = optionalPhoneSchema.safeParse("1234");
    expect(invalidShort.success).toBe(false);

    const invalidShortMobile = optionalPhoneSchema.safeParse("0170 123");
    expect(invalidShortMobile.success).toBe(false);

    const invalidText = optionalPhoneSchema.safeParse("keine nummer");
    expect(invalidText.success).toBe(false);
  });
});
