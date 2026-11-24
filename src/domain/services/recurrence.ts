import { DomainError } from "../errors";

export interface RecurrenceExpansionInput {
  daysOfWeek: number[]; // 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  excludedDates: string[]; // YYYY-MM-DD
  rsvpDeadlineHours?: number | null;
}

export interface ExpandedOccurrence {
  dateIso: string;
  startAt: Date;
  endAt: Date;
  rsvpDeadlineAt: Date | null;
}

function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m };
}

function formatDateIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Erzeugt konkrete Einzeltermine für eine Trainings- oder Terminserie
 * (z. B. Di & Do 19:30–21:00) unter Berücksichtigung von Ferien-Ausnahmen.
 * Begrenzt auf max. 120 Einzeltermine pro Serie als Schutz gegen Fehlkonfiguration.
 */
export function expandRecurrenceDates(
  input: RecurrenceExpansionInput
): ExpandedOccurrence[] {
  const startDay = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDay = new Date(`${input.endDate}T00:00:00.000Z`);

  if (Number.isNaN(startDay.getTime()) || Number.isNaN(endDay.getTime())) {
    throw DomainError.validation("Ungültiger Datumsbereich für Serientermin.");
  }
  if (endDay.getTime() < startDay.getTime()) {
    throw DomainError.validation(
      "Das Enddatum muss nach dem Startdatum liegen."
    );
  }

  const startClock = parseTime(input.startTime);
  const endClock = parseTime(input.endTime);
  const startMins = startClock.hours * 60 + startClock.minutes;
  const endMins = endClock.hours * 60 + endClock.minutes;
  if (endMins <= startMins) {
    throw DomainError.validation(
      "Die Endzeit muss nach der Startzeit liegen."
    );
  }

  const allowedDays = new Set(input.daysOfWeek);
  const excluded = new Set(input.excludedDates);
  const results: ExpandedOccurrence[] = [];

  const cursor = new Date(startDay.getTime());
  while (cursor.getTime() <= endDay.getTime()) {
    const dow = cursor.getUTCDay();
    const dateIso = formatDateIsoUtc(cursor);

    if (allowedDays.has(dow) && !excluded.has(dateIso)) {
      const startAt = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          startClock.hours,
          startClock.minutes,
          0,
          0
        )
      );
      const endAt = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          endClock.hours,
          endClock.minutes,
          0,
          0
        )
      );
      const rsvpDeadlineAt =
        input.rsvpDeadlineHours != null
          ? new Date(
              startAt.getTime() - input.rsvpDeadlineHours * 60 * 60 * 1000
            )
          : null;

      results.push({ dateIso, startAt, endAt, rsvpDeadlineAt });
      if (results.length >= 120) {
        break;
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (results.length === 0) {
    throw DomainError.validation(
      "Für den gewählten Zeitraum und die Wochentage ergibt sich kein Termin."
    );
  }

  return results;
}
