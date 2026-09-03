'use client';

import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/browser';

export function LoginForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setIsPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (signInError) throw signInError;
    } catch (caught) {
      console.error('Google sign-in failed', caught);
      setError('로그인 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.');
      setIsPending(false);
    }
  }

  return (
    <div className="relative mt-8">
      <Button
        type="button"
        onClick={signInWithGoogle}
        disabled={isPending}
        className="h-12 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100"
      >
        {isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <GoogleMark />}
        Google로 계속하기
      </Button>
      {error ? <p role="alert" className="mt-3 text-center text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 size-4">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" />
    </svg>
  );
}
