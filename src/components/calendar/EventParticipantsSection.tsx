import { useMemo, useState } from "react";
import { Check, X, Search, Clock, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  useEventParticipants,
  useAddEventParticipants,
  useRemoveEventParticipant,
  useUpdateRsvp,
} from "@/lib/hooks/useEvents";
import type { EventRsvpStatus } from "@/lib/types/domain";
import { useAuth } from "@/lib/auth/AuthContext";

interface Props {
  eventId: string | null;
  /** The event's owner — always marked as accepted + cannot be removed. */
  ownerId: string | null;
}

const RSVP_META: Record<
  EventRsvpStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "טרם ענה",
    icon: <Clock className="w-3 h-3" />,
    color: "text-ink-500",
  },
  accepted: {
    label: "אישר",
    icon: <Check className="w-3 h-3" />,
    color: "text-success-600",
  },
  declined: {
    label: "דחה",
    icon: <X className="w-3 h-3" />,
    color: "text-danger-600",
  },
  tentative: {
    label: "אולי",
    icon: <HelpCircle className="w-3 h-3" />,
    color: "text-warning-600",
  },
};

/**
 * Participants section — autocompleted from org members (no external email by
 * SPEC §9). Each participant shows their RSVP state; the current user can
 * change their own RSVP inline. Owners can add/remove.
 */
export function EventParticipantsSection({ eventId, ownerId }: Props) {
  const { user } = useAuth();
  const { data: members = [] } = useOrgMembers();
  const { data: participants = [] } = useEventParticipants(eventId);
  const addParticipants = useAddEventParticipants();
  const removeParticipant = useRemoveEventParticipant();
  const updateRsvp = useUpdateRsvp();

  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.user_id)),
    [participants]
  );

  // Filter members not yet added, matching the query.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !participantIds.has(m.membership.user_id))
      .filter((m) => {
        if (!q) return true;
        const name = m.profile?.full_name?.toLowerCase() ?? "";
        const email = m.profile?.email?.toLowerCase() ?? "";
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 8);
  }, [members, participantIds, query]);

  if (!eventId) {
    return (
      <p className="text-xs text-ink-500">
        שמור את האירוע תחילה כדי להוסיף מוזמנים.
      </p>
    );
  }

  const add = (userId: string) => {
    addParticipants.mutate({ eventId, userIds: [userId] });
    setQuery("");
  };

  const remove = (userId: string) => {
    if (userId === ownerId) return;
    removeParticipant.mutate({ eventId, userId });
  };

  const setMyRsvp = (status: EventRsvpStatus) => {
    if (!user?.id) return;
    updateRsvp.mutate({ eventId, userId: user.id, status });
  };

  return (
    <div className="space-y-3">
      {/* Existing participants */}
      <div className="space-y-1.5">
        {participants.length === 0 ? (
          <p className="text-xs text-ink-400">
            טרם הוזמנו משתתפים. הוסף מהתיבה למטה.
          </p>
        ) : (
          participants.map((p) => {
            const member = members.find(
              (m) => m.membership.user_id === p.user_id
            );
            const label =
              member?.profile?.full_name ||
              member?.profile?.email ||
              p.user_id.slice(0, 8);
            const isOwner = p.user_id === ownerId;
            const isMe = p.user_id === user?.id;
            const meta = RSVP_META[p.rsvp_status];
            return (
              <div
                key={p.user_id}
                className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5"
              >
                <div className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center text-[11px] font-semibold text-ink-700 shrink-0">
                  {initials(label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-900 truncate">
                    {label}
                    {isOwner && (
                      <span className="ms-1 text-[10px] text-ink-400">(מארגן)</span>
                    )}
                    {isMe && !isOwner && (
                      <span className="ms-1 text-[10px] text-primary-600">(אני)</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px]",
                      meta.color
                    )}
                  >
                    {meta.icon}
                    {meta.label}
                  </div>
                </div>
                {isMe && !isOwner && (
                  <RsvpSwitcher value={p.rsvp_status} onChange={setMyRsvp} />
                )}
                {!isOwner && (
                  <button
                    onClick={() => remove(p.user_id)}
                    className="p-1 rounded text-ink-400 hover:text-danger-500"
                    title="הסר מוזמן"
                    type="button"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add picker */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
            className="field ps-9 text-sm"
            placeholder="חפש מוזמן מתוך הארגון..."
          />
        </div>
        {pickerOpen && candidates.length > 0 && (
          <ul className="absolute top-full mt-1 inset-x-0 bg-white border border-ink-200 rounded-md shadow-lift max-h-56 overflow-auto z-10">
            {candidates.map((c) => {
              const label =
                c.profile?.full_name || c.profile?.email || c.membership.user_id.slice(0, 8);
              return (
                <li key={c.membership.user_id}>
                  <button
                    onClick={() => add(c.membership.user_id)}
                    className="w-full text-start px-3 py-2 text-sm hover:bg-ink-50 flex items-center gap-2"
                    type="button"
                  >
                    <div className="w-6 h-6 rounded-full bg-ink-100 flex items-center justify-center text-[10px] font-semibold text-ink-700 shrink-0">
                      {initials(label)}
                    </div>
                    <span className="flex-1 truncate">{label}</span>
                    {c.profile?.email && (
                      <span className="text-[10px] text-ink-500 truncate">
                        {c.profile.email}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {pickerOpen && candidates.length === 0 && query && (
          <div className="absolute top-full mt-1 inset-x-0 bg-white border border-ink-200 rounded-md shadow-soft px-3 py-2 text-xs text-ink-500">
            אין חברי ארגון מתאימים.
          </div>
        )}
      </div>
    </div>
  );
}

function RsvpSwitcher({
  value,
  onChange,
}: {
  value: EventRsvpStatus;
  onChange: (v: EventRsvpStatus) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-200 overflow-hidden">
      {(["accepted", "tentative", "declined"] as EventRsvpStatus[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "px-1.5 py-0.5 text-[10px] border-e border-ink-200 last:border-e-0",
            value === s
              ? s === "accepted"
                ? "bg-success-500 text-white"
                : s === "declined"
                ? "bg-danger-500 text-white"
                : "bg-warning-500 text-white"
              : "bg-white text-ink-600 hover:bg-ink-50"
          )}
          type="button"
          title={RSVP_META[s].label}
        >
          {RSVP_META[s].label}
        </button>
      ))}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
