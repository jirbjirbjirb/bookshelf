/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.kirbyjayes.bookshelf.experimental.review'

export interface Main {
  $type: 'com.kirbyjayes.bookshelf.experimental.review'
  /** Open Library work key without the /works/ prefix, for example OL45804W. */
  bookId: string
  /** Book title at the time of review. */
  title: string
  /** Author names at the time of review. Empty when Open Library lists none. */
  authors: string[]
  /** Open Library cover id, used with covers.openlibrary.org. */
  coverId?: number
  /** The review body, as plain text. */
  text: string
  /** Whole-star rating. */
  rating?: number
  /** Client-declared creation time. Not changed by edits. */
  createdAt: string
  /** AT-URI of the app.bsky.feed.post that announced this review, if any. */
  crosspost?: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}
