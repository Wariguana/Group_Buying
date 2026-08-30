const TAIWAN_TIME_ZONE = "Asia/Taipei";

function getDateParts(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TAIWAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");

  return year && month && day ? { year, month, day } : null;
}

export function toTaiwanDateInputValue(value: Date | string) {
  const parts = getDateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

export function formatTaiwanDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TAIWAN_TIME_ZONE,
  }).format(new Date(value));
}

export function parseTaiwanDate(value: unknown, isEndOfDay = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(
    `${value}${isEndOfDay ? "T23:59:59.999" : "T00:00:00"}+08:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
