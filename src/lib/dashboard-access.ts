type SubscriptionState = { status?: string; current_period_end?: string } | null;

export function dashboardAccess(companyStatus: string | undefined, subscription: SubscriptionState, pathname: string, now = new Date()) {
  const expired = !!subscription && (subscription.status === "canceled" ||
    (["trialing", "past_due"].includes(subscription.status ?? "") &&
      !!subscription.current_period_end && new Date(subscription.current_period_end) < now));
  const suspended = companyStatus === "suspended";
  const billing = pathname === "/dashboard/billing" || pathname === "/dashboard/billing-callback";
  return { expired, suspended, blocked: suspended || (expired && !billing) };
}