'use server';

import { getLocale } from 'next-intl/server';

import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SignInState {
  error: string | null;
}

/**
 * Sign in with Supabase Auth.
 *
 * Returns a translation key rather than a message, so the form renders it in the
 * user's language. Supabase's own error text is deliberately not surfaced: it is
 * English-only and can distinguish "no such user" from "wrong password".
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'auth.invalidCredentials' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) return { error: 'auth.invalidCredentials' };

  // A user without a profile row has not been granted access yet.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: 'auth.noProfile' };
  }

  const locale = await getLocale();
  redirect({ href: '/dashboard', locale });

  // redirect() throws. This return exists only because next-intl does not type
  // it as `never`.
  return { error: null };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  redirect({ href: '/login', locale });
}
