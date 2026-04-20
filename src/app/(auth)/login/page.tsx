'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { loginAction } from './action';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.set('username', username);
    formData.set('password', password);

    try {
      const result = await loginAction(formData);

      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const needsSetup = result.mustChangePassword || !result.isSetupComplete;
      router.push(needsSetup ? '/setup' : '/');
      router.refresh();
    } catch {
      setError('שגיאת שרת, נסה שוב');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">ניהול חכם</h1>
          <p className="mt-2 text-sm text-gray-500">הניהול החכם לעסק שלך</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <input
            type="text"
            name="username"
            placeholder="שם משתמש"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent disabled:opacity-60"
          />

          <input
            type="password"
            name="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#f59e0b] text-black font-bold hover:bg-[#d97706] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"
                />
                <span>מתחבר...</span>
              </>
            ) : (
              'כניסה'
            )}
          </button>

          {error && (
            <p role="alert" className="text-sm text-red-600 text-center">
              {error}
            </p>
          )}
        </form>
      </div>

      <p className="text-center mt-6 text-xs text-gray-500">
        ניהול חכם © 2026
      </p>
    </div>
  );
}
