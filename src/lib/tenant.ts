import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CompanyRole = "owner" | "admin" | "agent" | "viewer";

const ACTIVE_KEY = "sawti.active-company";

function readActiveCompany(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

/** All companies the signed-in user belongs to. */
export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, role, company_id, companies(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The membership for the currently selected company. */
export function useMembership() {
  const { data, ...rest } = useMemberships();
  const active = readActiveCompany();
  const match = data?.find((m) => m.company_id === active) ?? data?.[0] ?? null;
  return { ...rest, data: match };
}

/** Switches the active company and refreshes every company-scoped query. */
export function useSwitchCompany() {
  const qc = useQueryClient();
  return (companyId: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_KEY, companyId);
    qc.clear();
  };
}

export function useCompanyId() {
  const { data } = useMembership();
  return data?.company_id ?? null;
}


export function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["super-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useSubscription(companyId: string | null) {
  return useQuery({
    queryKey: ["subscription", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useCompanyTable<T = unknown>(
  table:
    | "ai_agents"
    | "connection_requests"
    | "conversations"
    | "voice_calls"
    | "knowledge_documents"
    | "knowledge_bases"
    | "phone_numbers"
    | "whatsapp_accounts"
    | "company_members"
    | "usage_records"
    | "customers"
    | "billing_records"
    | "audit_logs",
  companyId: string | null,
  select = "*",
) {
  return useQuery({
    queryKey: [table, companyId, select],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}
