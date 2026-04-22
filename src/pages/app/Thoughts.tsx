import { ScreenScaffold, ComingSoon } from "@/components/layout/ScreenScaffold";

export function Thoughts() {
  return (
    <ScreenScaffold
      title="מחשבות"
      subtitle="זרוק רעיון, תעבד אחר כך, הפוך למשימות/אירועים/פרויקטים"
    >
      <ComingSoon description="קליטה מהירה מ-WhatsApp ומהאפליקציה, ארגון ברשימות (M:N), באנר AI עם הצעות קבועות ודינמיות, ארכיון 60 יום עם שחזור." />
    </ScreenScaffold>
  );
}
