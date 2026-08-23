process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ums_test?schema=public";
process.env.JWT_SECRET = "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET = "abcdefghijklmnopqrstuvwxzy123456";
process.env.GOOGLE_CLIENT_ID = "1234567890-test.apps.googleusercontent.com";
process.env.GOOGLE_HOSTED_DOMAIN = "mitwpu.edu.in";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.CLOUDINARY_CLOUD_NAME = "test";
process.env.CLOUDINARY_API_KEY = "test";
process.env.CLOUDINARY_API_SECRET = "test";
process.env.FRONTEND_URL = "http://localhost:5173";

import {
  addLocalDays,
  buildSlotBlueprints,
  localToday,
  resolveDayPolicy,
  zonedLocalMinuteToUtc,
  type DateException,
  type WeeklySchedule,
} from "../../src/modules/labs/lab-time.js";

const everyDay: WeeklySchedule[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  opensAtMinute: 8 * 60 + 30,
  closesAtMinute: 18 * 60 + 30,
}));

describe("Phase 3 lab time policy", () => {
  it("uses the MakerSpace time zone at UTC date boundaries", () => {
    expect(localToday("Asia/Kolkata", new Date("2026-08-22T19:00:00.000Z"))).toBe("2026-08-23");
    expect(localToday("Asia/Kolkata", new Date("2026-08-22T18:00:00.000Z"))).toBe("2026-08-22");
  });

  it("resolves all seven configured operating days", () => {
    for (const date of [
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]) {
      expect(resolveDayPolicy(date, everyDay, [])).toMatchObject({
        isOpen: true,
        opensAtMinute: 510,
        closesAtMinute: 1110,
        source: "WEEKLY_SCHEDULE",
      });
    }
  });

  it("lets a closure override the regular weekly schedule", () => {
    const exceptions: DateException[] = [
      {
        localDate: new Date("2026-08-24T00:00:00.000Z"),
        isClosed: true,
        opensAtMinute: null,
        closesAtMinute: null,
        reason: "University holiday",
      },
    ];
    expect(resolveDayPolicy("2026-08-24", everyDay, exceptions)).toEqual({
      isOpen: false,
      opensAtMinute: null,
      closesAtMinute: null,
      source: "DATE_EXCEPTION",
      reason: "University holiday",
    });
  });

  it("lets special hours replace regular hours for one date", () => {
    const exceptions: DateException[] = [
      {
        localDate: new Date("2026-08-25T00:00:00.000Z"),
        isClosed: false,
        opensAtMinute: 10 * 60,
        closesAtMinute: 14 * 60,
        reason: "Faculty development programme",
      },
    ];
    expect(resolveDayPolicy("2026-08-25", everyDay, exceptions)).toMatchObject({
      isOpen: true,
      opensAtMinute: 600,
      closesAtMinute: 840,
      source: "DATE_EXCEPTION",
    });
  });

  it("generates ten deterministic one-hour slots from 08:30 to 18:30", () => {
    const policy = resolveDayPolicy("2026-08-23", everyDay, []);
    const first = buildSlotBlueprints("2026-08-23", policy, 60, "Asia/Kolkata");
    const replay = buildSlotBlueprints("2026-08-23", policy, 60, "Asia/Kolkata");

    expect(first).toHaveLength(10);
    expect(first[0]).toMatchObject({ startTime: "08:30", endTime: "09:30" });
    expect(first[0]!.startsAt.toISOString()).toBe("2026-08-23T03:00:00.000Z");
    expect(first.at(-1)).toMatchObject({ startTime: "17:30", endTime: "18:30" });
    expect(replay).toEqual(first);
  });

  it("never creates a partial slot after closing time", () => {
    const policy = {
      isOpen: true,
      opensAtMinute: 8 * 60 + 30,
      closesAtMinute: 10 * 60,
      source: "WEEKLY_SCHEDULE" as const,
      reason: null,
    };
    expect(buildSlotBlueprints("2026-08-23", policy, 60, "Asia/Kolkata")).toHaveLength(1);
  });

  it("converts configurable IANA time zones without a frontend offset assumption", () => {
    expect(zonedLocalMinuteToUtc("2026-08-24", 8 * 60 + 30, "Asia/Kolkata").toISOString()).toBe(
      "2026-08-24T03:00:00.000Z",
    );
    expect(zonedLocalMinuteToUtc("2026-08-24", 8 * 60 + 30, "UTC").toISOString()).toBe(
      "2026-08-24T08:30:00.000Z",
    );
  });

  it("calculates horizon dates without depending on the server locale", () => {
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
