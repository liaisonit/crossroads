
import { DateTime } from "luxon";

export function humanDateInTZ(date: Date, timezone: string): string {
    return DateTime.fromJSDate(date).setZone(timezone).toFormat("LLL dd, yyyy");
}

type QuietHours = {
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
};

export function inQuietHours(quietHours?: QuietHours, timezone: string = 'America/New_York'): boolean {
    if (!quietHours || !quietHours.start || !quietHours.end) {
        return false;
    }

    const now = DateTime.local().setZone(timezone);
    const start = DateTime.fromFormat(quietHours.start, "HH:mm", { zone: timezone });
    let end = DateTime.fromFormat(quietHours.end, "HH:mm", { zone: timezone });

    // Handle overnight quiet hours (e.g., 21:00 to 07:00)
    if (end < start) {
        // If current time is after start, it's quiet time.
        if (now >= start) return true;
        // If current time is before end (on the next day), it's also quiet time.
        // We add a day to end to handle the overnight case correctly.
        end = end.plus({ days: 1 });
        // We must check against `now` without adding a day.
        return now < end.minus({days: 1});
    }

    // Standard non-overnight quiet hours (e.g., 13:00 to 17:00)
    return now >= start && now < end;
}
