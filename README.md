# Bookshelf

A book review site where your reviews belong to you.

Sign in with a Bluesky account, find a book, and write a review. The review is saved as a record in your own [AT Protocol](https://atproto.com) repository, not in a database owned by this site. It stays with your account, other apps can read it, and this site could disappear without taking it with it.

Live at [bookshelf.kirbyjayes.com](https://bookshelf.kirbyjayes.com). This is a demo and work in progress, so expect test data and changes.

## How it works

- **Identity:** you sign in with your existing handle over atproto OAuth. The site never sees your password and asks only for permission to write reviews and create posts.
- **Your data:** each review is a record of a custom type (a lexicon) stored on your personal data server (PDS).
- **Books:** search and book details come from [Open Library](https://openlibrary.org). A review points at a book by its Open Library work ID.

## Feature status

| Feature | Status |
|---|---|
| Sign in with a Bluesky account | Live |
| Write, edit and delete reviews, stored in your own repo | Live, with a basic form |
| Search for a book and review it, with covers | In progress |
| Public profile pages listing anyone's reviews by handle | Planned |
| Book pages showing every review of a book, across users | Planned |
| Optionally cross-post a review to Bluesky | Planned |

Reviews currently use an experimental record type, `com.kirbyjayes.bookshelf.experimental.review`. It will be renamed before a public launch, and reviews written under the old name will not carry over.

## Run it locally

Requires Node 22 or later.

1. Create `.env.local`:
   ```
   SESSION_SECRET=<at least 32 random characters>
   OAUTH_MODE=dev
   DB_FILE=./data/app.db
   ```
2. Run `npm install`, then `npm run dev`.
3. Open `http://127.0.0.1:3000`. Use the IP address rather than `localhost`, or login will not work.

`npm test` runs the unit tests.

## Stack

Next.js, SQLite and Fly.io.

## Project notes

Progress and design decisions are in [NOTES.md](NOTES.md).
