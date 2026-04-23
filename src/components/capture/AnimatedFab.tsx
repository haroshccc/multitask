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

// Brand-gradient cycle only: yellow → amber → pink → orange. No greens /
// blues / purples, so the FAB always reads as part of the Multitask identity.
const GRADIENTS: string[] = [
  "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", // yellow → amber
  "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)", // amber → pink
  "linear-gradient(135deg, #ec4899 0%, #f97316 100%)", // pink → orange
  "linear-gradient(135deg, #f97316 0%, #facc15 100%)", // orange → yellow
  "linear-gradient(135deg, #facc15 0%, #ec4899 100%)", // yellow → pink
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
      // Mobile: sits inside the bottom nav, protruding upward slightly so it
      // reads as a primary action attached to the bar.
      // md+: free-floating bottom-right with a larger footprint.
      className="fixed z-40 rounded-full shadow-lift flex items-center justify-center text-white ring-1 ring-white/25 hover:scale-105 transition-transform
        bottom-8 end-4 w-16 h-16
        md:bottom-6 md:end-6 md:w-[72px] md:h-[72px]"
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
