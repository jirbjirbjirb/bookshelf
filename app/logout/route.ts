import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { APP_ORIGIN, COOKIE_NAME } from '@/lib/config'
import { getOAuthClient } from '@/lib/oauth'
import { verifySession } from '@/lib/session'

export async function POST() {
  const did = verifySession((await cookies()).get(COOKIE_NAME)?.value)
  if (did) {
    try {
      await getOAuthClient().revoke(did) // revokes at the PDS and deletes the stored session
    } catch (err) {
      console.error('revoke failed', err)
    }
  }
  const res = NextResponse.redirect(`${APP_ORIGIN}/`, 303)
  res.cookies.delete(COOKIE_NAME)
  return res
}
