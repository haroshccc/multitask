export function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-ink-100 p-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-white shadow-soft px-4 py-2 text-sm text-ink-600">
          בבנייה — גרסה מוקדמת
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-ink-900">
          Multitask
        </h1>
        <p className="text-2xl text-ink-700 font-light">
          חלל לחשוב. חלל לעשות.
        </p>
        <p className="text-ink-500 max-w-md mx-auto leading-relaxed">
          האפליקציה שמאחדת משימות, יומן, הקלטות, מחשבות ופרויקטים למקום אחד.
          התחילי ברישום ארגון או הצטרפי לקיים.
        </p>
      </div>
    </div>
  );
}
