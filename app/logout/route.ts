import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APP_ORIGIN, COOKIE_NAME } from '@/lib/config'
import { getOAuthClient } from '@/lib/oauth'
import { verifySession } from '@/lib/session'

export async function POST() {
  const did = verifySession((await cookies()).get(COOKIE_NAME)?.value)
  let error: string | null = null
  if (did) {
    try {
      await getOAuthClient().revoke(did) // revokes at the PDS and deletes the stored session
    } catch (err) {
      // the library deletes the stored session even when the PDS call fails, so local logout still succeeded
      console.error('revoke failed', err)
      error = 'Logged out here, but the server could not revoke the token at your PDS'
    }
  }
  const res = NextResponse.redirect(`${APP_ORIGIN}/${error ? `?error=${encodeURIComponent(error)}` : ''}`, 303)
  res.cookies.delete(COOKIE_NAME)
  return res
}
