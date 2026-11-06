/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util'

export const schemaDict = {
  ComKirbyjayesBookshelfExperimentalReview: {
    lexicon: 1,
    id: 'com.kirbyjayes.bookshelf.experimental.review',
    defs: {
      main: {
        type: 'record',
        description: "A review of a book, stored in the reviewer's own repo.",
        key: 'tid',
        record: {
          type: 'object',
          required: ['bookId', 'title', 'authors', 'text', 'createdAt'],
          properties: {
            bookId: {
              type: 'string',
              description:
                'Open Library work key without the /works/ prefix, for example OL45804W.',
              minLength: 3,
              maxLength: 32,
            },
            title: {
              type: 'string',
              description: 'Book title at the time of review.',
              minLength: 1,
              maxLength: 3000,
              maxGraphemes: 300,
            },
            authors: {
              type: 'array',
              description:
                'Author names at the time of review. Empty when Open Library lists none.',
              maxLength: 20,
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 1280,
                maxGraphemes: 128,
              },
            },
            coverId: {
              type: 'integer',
              description:
                'Open Library cover id, used with covers.openlibrary.org.',
              minimum: 1,
            },
            text: {
              type: 'string',
              description: 'The review body, as plain text.',
              minLength: 1,
              maxLength: 50000,
              maxGraphemes: 5000,
            },
            rating: {
              type: 'integer',
              description: 'Whole-star rating.',
              minimum: 1,
              maximum: 5,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared creation time. Not changed by edits.',
            },
            crosspost: {
              type: 'string',
              format: 'at-uri',
              description:
                'AT-URI of the app.bsky.feed.post that announced this review, if any.',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  ComKirbyjayesBookshelfExperimentalReview:
    'com.kirbyjayes.bookshelf.experimental.review',
} as const
