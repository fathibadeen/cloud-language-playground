import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { checkUsageAlerts } from "@/lib/notifications.functions";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

/** Header bell: unread operational alerts (usage limits, account events). */
export function NotificationBell({ companyId }: { companyId: string | null }) {
  const qc = useQueryClient();
  const check = useServerFn(checkUsageAlerts);

  const { data } = useQuery({
    queryKey: ["notifications", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (rows ?? []) as Notification[];
    },
  });

  useEffect(() => {
    if (!companyId) return;
    check({ data: { companyId } })
      .then((res) => {
        if (res.created > 0) qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      })
      .catch(() => undefined);
  }, [companyId, check, qc]);

  const unread = (data ?? []).filter((n) => !n.is_read).length;

  async function markAllRead() {
    if (!companyId || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("company_id", companyId).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications", companyId] });
  }

  return (
    <Popover onOpenChange={(o) => { if (!o) void markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="التنبيهات">
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-2 text-sm font-semibold">التنبيهات</div>
        <div className="max-h-80 overflow-y-auto">
          {(data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">لا توجد تنبيهات بعد.</p>
          ) : (
            data!.map((n) => (
              <div key={n.id} className={`border-b p-3 last:border-0 ${n.is_read ? "" : "bg-muted/40"}`}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
