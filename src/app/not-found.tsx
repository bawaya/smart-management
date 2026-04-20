import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-[8rem] leading-none font-bold text-[#f59e0b]">
          404
        </h1>
        <h2 className="mt-2 text-2xl font-bold text-white">הדף לא נמצא</h2>
        <p className="mt-3 text-sm text-gray-400">
          הדף שחיפשת אינו קיים או שהועבר.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors"
        >
          חזרה לדף הראשי
        </Link>
      </div>
    </div>
  );
}
