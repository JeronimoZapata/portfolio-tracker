"use client";

import { useSyncExternalStore } from "react";

type LocalDateTimeProps = {
  readonly iso: string;
};

export function LocalDateTime({ iso }: LocalDateTimeProps) {
  const label = useSyncExternalStore(
    () => () => undefined,
    () => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    },
    () => iso,
  );

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}
