import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { checkUsageAlerts } from "@/lib/notifications.functions";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  link: string | null;
  severity?: string | null;
};

const DOT: Record<string, string> = {
  error: "bg-destructive",
  warning: "bg-gold",
  success: "bg-primary",
  info: "bg-muted-foreground",
};

/** Shared bell UI for customer and platform-admin notifications. */
function BellView({
  table,
  filter,
  queryKey,
  emptyText,
}: {
  table: "notifications" | "admin_notifications";
  filter?: { column: string; value: string };
  queryKey: unknown[];
  emptyText: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(30);
      if (filter) q = q.eq(filter.column, filter.value);
      const { data: rows, error } = await q;
      if (error) throw error;
      return (rows ?? []) as unknown as Notification[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`bell-${table}-${filter?.value ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}) },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter?.value]);

  const unread = (data ?? []).filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (unread === 0) return;
    let q = supabase.from(table).update({ is_read: true }).eq("is_read", false);
    if (filter) q = q.eq(filter.column, filter.value);
    await q;
    qc.invalidateQueries({ queryKey });
  }

  return (
    <Popover onOpenChange={(o) => { if (!o) void markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="التنبيهات">
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="border-b px-4 py-2 text-sm font-semibold">التنبيهات</div>
        <div className="max-h-96 overflow-y-auto">
          {(data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            data!.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => n.link && navigate({ to: n.link })}
                className={`flex w-full gap-2 border-b p-3 text-start last:border-0 hover:bg-muted/60 ${n.is_read ? "" : "bg-muted/40"}`}
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[n.severity ?? "info"] ?? DOT["info"]}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body ? <span className="block text-xs text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-1 block text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-SA")}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Header bell for the customer dashboard. */
export function NotificationBell({ companyId }: { companyId: string | null }) {
  const qc = useQueryClient();
  const check = useServerFn(checkUsageAlerts);

  useEffect(() => {
    if (!companyId) return;
    check({ data: { companyId } })
      .then((res) => {
        if (res.created > 0) qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      })
      .catch(() => undefined);
  }, [companyId, check, qc]);

  if (!companyId) return null;
  return (
    <BellView
      table="notifications"
      filter={{ column: "company_id", value: companyId }}
      queryKey={["notifications", companyId]}
      emptyText="لا توجد تنبيهات بعد."
    />
  );
}

/** Header bell for the platform admin: signups, payments, channel failures. */
export function AdminNotificationBell() {
  return <BellView table="admin_notifications" queryKey={["admin-notifications"]} emptyText="لا توجد تنبيهات للمنصة بعد." />;
}
