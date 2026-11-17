import Link from "next/link";
import type { ReactNode } from "react";
import { Cover } from "@/app/cover";

// The one rendering of a book: cover, title, authors. `children` is whatever the page adds below.
export function BookCard({ coverId, title, authors, year, href, children }: {
  coverId?: number;
  title: string;
  authors: string[];
  year?: number;
  href?: string; // links the title when given
  children?: ReactNode;
}) {
  return (
    <article className="book">
      <Cover id={coverId} />
      <div className="book-body">
        <h2>{href ? <Link href={href}>{title}</Link> : title}</h2>
        {authors.length > 0 && <p>{authors.join(", ")}</p>}
        {year !== undefined && <p className="meta">{year}</p>}
        {children}
      </div>
    </article>
  );
}
