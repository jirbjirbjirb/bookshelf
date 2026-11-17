"use client";

import { useEffect, useState } from "react";

// The server does not know the reader's time zone, so it renders the UTC day and the browser corrects it
// after hydration. en-CA is used only because it formats as YYYY-MM-DD, matching the server's text.
export function LocalDate({ iso }: { iso: string }) {
  const [day, setDay] = useState(iso.slice(0, 10));
  useEffect(() => setDay(new Date(iso).toLocaleDateString("en-CA")), [iso]);
  return <time dateTime={iso}>{day}</time>;
}
