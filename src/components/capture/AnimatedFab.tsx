import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Plus,
  CheckSquare,
  Calendar as CalendarIcon,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";

interface AnimatedFabProps {
  onClick: () => void;
  /** Override the default 2.6s icon cycle (e.g. to pause while the modal is open). */
  paused?: boolean;
}

/**
 * Floating action button that cycles through the five quick-capture icons
 * (mic / plus / task / event / project) with a matching gradient colour.
 * Visible on every screen and across breakpoints; positioned above the bottom
 * tab bar on mobile and near the corner on desktop.
 */
const ICONS: LucideIcon[] = [Mic, Plus, CheckSquare, CalendarIcon, FolderKanban];

const GRADIENTS: string[] = [
  "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)", // amber → orange
  "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", // pink
  "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)", // purple
  "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", // blue
  "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)", // green → teal
];

export function AnimatedFab({ onClick, paused = false }: AnimatedFabProps) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setI((x) => (x + 1) % ICONS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [paused]);

  const Icon = ICONS[i];
  const gradient = GRADIENTS[i];

  return (
    <motion.button
      onClick={onClick}
      aria-label="יצירה מהירה"
      title="יצירה מהירה"
      className="fixed bottom-20 md:bottom-6 end-4 md:end-6 z-30 w-16 h-16 md:w-[72px] md:h-[72px] rounded-full shadow-lift flex items-center justify-center text-white ring-1 ring-white/20 hover:scale-105 transition-transform"
      animate={{ background: gradient }}
      transition={{ duration: 1.4, ease: "easeInOut" }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ scale: 0.55, rotate: -35, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.55, rotate: 35, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <Icon className="w-7 h-7 md:w-8 md:h-8" strokeWidth={2} />
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
