/**
 * Turns database guard errors (plan limits, suspension, owner protection)
 * into bilingual, user-facing messages.
 */
export function humanizeDbError(
  message: string,
  t: (key: string) => string,
): string {
  if (message.includes("plan_limit_reached")) return t("planLimitReached");
  if (message.includes("company_inactive")) return t("companyInactive");
  if (message.includes("cannot_change_own_role")) return t("cannotChangeOwnRole");
  if (message.includes("last_owner_required")) return t("lastOwnerRequired");
  if (message.includes("invitation_email_mismatch")) return t("signInToAccept");
  if (
    message.includes("invitation_not_found") ||
    message.includes("invitation_expired") ||
    message.includes("invitation_already_used")
  ) {
    return t("invitationInvalid");
  }
  return message;
}
