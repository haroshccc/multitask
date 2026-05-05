import { useMemo } from "react";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import { useMealPlanShares } from "@/lib/hooks/useFood";
import type { Profile } from "@/lib/types/domain";

/**
 * A "person" in the food module — either the current user, or someone
 * who has shared their plan with the current user. Represents who's
 * visible / editable in the meal-plan UI.
 */
export interface FoodPerson {
  userId: string;
  /** Shown in pills, headers, banner labels. Falls back gracefully when
   *  the profile hasn't loaded yet, or when fields are blank. */
  displayName: string;
  /** First letter for avatar circles. */
  initial: string;
  /** Stable color hashed from userId, used for chips and section borders. */
  color: PersonColor;
  /** True when this person is the current user. */
  isMe: boolean;
  /** True when this person is someone whose plan is visible to the
   *  current user via a meal_plan_shares grant (not me). */
  isShared: boolean;
}

export interface PersonColor {
  /** Tailwind class for a soft background tint, e.g. "bg-amber-50". */
  bg: string;
  /** Tailwind class for the matching border, e.g. "border-amber-300". */
  border: string;
  /** Tailwind class for a saturated fill (avatar circle), e.g. "bg-amber-500". */
  solid: string;
  /** Tailwind class for text on the soft tint, e.g. "text-amber-700". */
  text: string;
}

const PALETTE: PersonColor[] = [
  { bg: "bg-amber-50", border: "border-amber-300", solid: "bg-amber-500", text: "text-amber-800" },
  { bg: "bg-sky-50", border: "border-sky-300", solid: "bg-sky-500", text: "text-sky-800" },
  { bg: "bg-emerald-50", border: "border-emerald-300", solid: "bg-emerald-500", text: "text-emerald-800" },
  { bg: "bg-rose-50", border: "border-rose-300", solid: "bg-rose-500", text: "text-rose-800" },
  { bg: "bg-violet-50", border: "border-violet-300", solid: "bg-violet-500", text: "text-violet-800" },
  { bg: "bg-orange-50", border: "border-orange-300", solid: "bg-orange-500", text: "text-orange-800" },
];

/** Deterministic color from a userId. Uses a simple FNV-ish rolling hash
 *  so the same person gets the same color every render. */
function colorForUserId(userId: string): PersonColor {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) & 0x7fffffff;
  }
  return PALETTE[h % PALETTE.length];
}

function nameFromProfile(profile: Profile | null | undefined, fallback: string): string {
  if (!profile) return fallback;
  const fn = profile.full_name?.trim();
  if (fn) return fn;
  return fallback;
}

/**
 * Returns the list of people whose meal plans the current user can see —
 * always starts with the current user (`isMe`), followed by people who
 * shared their plan with them. Stable order (me first, then shared sorted
 * by display name) so React keys remain consistent across renders.
 */
export function useFoodPeople(): {
  people: FoodPerson[];
  me: FoodPerson | null;
  byId: Map<string, FoodPerson>;
  isLoading: boolean;
} {
  const scope = useOrgScope();
  const { data: members = [], isLoading: membersLoading } = useOrgMembers();
  const { data: shares = [], isLoading: sharesLoading } = useMealPlanShares();

  const result = useMemo(() => {
    if (!scope.userId) {
      return { people: [], me: null, byId: new Map<string, FoodPerson>() };
    }

    const profileByUserId = new Map<string, Profile>();
    for (const m of members) {
      if (m.profile) profileByUserId.set(m.profile.id, m.profile);
    }

    const me: FoodPerson = {
      userId: scope.userId,
      displayName: nameFromProfile(
        profileByUserId.get(scope.userId) ?? null,
        "אני"
      ),
      initial:
        nameFromProfile(profileByUserId.get(scope.userId) ?? null, "א").charAt(0) ||
        "א",
      color: colorForUserId(scope.userId),
      isMe: true,
      isShared: false,
    };

    // Anyone who has shared their plan WITH me becomes visible.
    const sharerIds = shares
      .filter((s) => s.shared_with_user_id === scope.userId)
      .map((s) => s.sharer_user_id);
    const sharedPeople: FoodPerson[] = [...new Set(sharerIds)]
      .map((uid) => ({
        userId: uid,
        displayName: nameFromProfile(profileByUserId.get(uid) ?? null, "?"),
        initial:
          nameFromProfile(profileByUserId.get(uid) ?? null, "?").charAt(0) ||
          "?",
        color: colorForUserId(uid),
        isMe: false,
        isShared: true,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));

    const people = [me, ...sharedPeople];
    const byId = new Map(people.map((p) => [p.userId, p]));
    return { people, me, byId };
  }, [scope.userId, members, shares]);

  return {
    ...result,
    isLoading: membersLoading || sharesLoading,
  };
}

/** Avatar circle — initial letter colored by hashed user_id. */
export function PersonAvatar({
  person,
  size = "sm",
}: {
  person: FoodPerson;
  size?: "xs" | "sm" | "md";
}) {
  const dim =
    size === "xs"
      ? "w-5 h-5 text-[10px]"
      : size === "md"
      ? "w-7 h-7 text-xs"
      : "w-6 h-6 text-[11px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold ${person.color.solid} ${dim}`}
      title={person.displayName}
    >
      {person.initial}
    </span>
  );
}
