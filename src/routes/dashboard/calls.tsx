import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/StatCard";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { getNabrahCallDetail, syncNabrahCalls } from "@/lib/nabrah.functions";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard/calls")({
  head: () => ({ meta: [{ title: "سجل المكالمات | صوتي" }, { name: "description", content: "متابعة مكالمات شركتك وتفاصيلها في صوتي." }, { property: "og:title", content: "سجل المكالمات | صوتي" }, { property: "og:description", content: "متابعة مكالمات شركتك وتفاصيلها في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CallsPage,
});

type Call = {
  id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  duration_seconds: number;
  transferred: boolean;
  recording_url: string | null;
  ended_reason: string | null;
  started_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;

function CallsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: calls, isLoading } = useCompanyTable<Call>("voice_calls", companyId);
  const sync = useServerFn(syncNabrahCalls);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Call | null>(null);
  const [busy, setBusy] = useState(false);

  // تحديث فوري عند وصول مكالمة جديدة
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`voice_calls:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_calls", filter: `company_id=eq.${companyId}` },
        () => qc.invalidateQueries({ queryKey: ["voice_calls"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const all = calls ?? [];
  const filtered = useMemo(
    () =>
      all.filter((c) => {
        const matchQ =
          !q ||
          `${c.from_number ?? ""} ${c.to_number ?? ""}`.toLowerCase().includes(q.toLowerCase());
        const matchS = status === "all" || c.status === status;
        return matchQ && matchS;
      }),
    [all, q, status],
  );
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const totalMinutes = Math.round(all.reduce((s, c) => s + c.duration_seconds, 0) / 60);
  const transferRate = all.length
    ? Math.round((all.filter((c) => c.transferred).length / all.length) * 100)
    : 0;

  const detailFn = useServerFn(getNabrahCallDetail);
  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ["nabrah-call-detail", selected?.id],
    enabled: !!companyId && !!selected,
    queryFn: () => detailFn({ data: { companyId: companyId!, callId: selected!.id } }),
  });

  async function runSync() {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await sync({ data: { companyId } });
      if (res.reason === "no_linked_agent") toast.message("اربط وكيل نبرة من صفحة الوكيل الصوتي أولًا");
      else if (res.reason) toast.error(String(res.reason));
      else toast.success(`تمت المزامنة: ${res.imported} جديدة، ${res.updated} محدّثة`);
      await qc.invalidateQueries({ queryKey: ["voice_calls"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("navCalls")}</h1>
        <Button variant="outline" size="sm" onClick={runSync} disabled={busy}>
          <RefreshCw className={`me-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {t("syncCalls")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("totalCalls")} value={all.length} />
        <StatCard label={t("totalMinutes")} value={totalMinutes} />
        <StatCard label={t("transferRate")} value={`${transferRate}%`} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder={t("search")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {["completed", "in_progress", "ringing", "failed", "transferred"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("direction")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                  <TableHead>{t("humanTransfers")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell dir="ltr">
                      {(c.direction === "inbound" ? c.from_number : c.to_number) ?? "—"}
                    </TableCell>
                    <TableCell>{t(c.direction === "inbound" ? "inbound" : "outbound")}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "completed" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr">
                      {Math.floor(c.duration_seconds / 60)}:
                      {String(c.duration_seconds % 60).padStart(2, "0")}
                    </TableCell>
                    <TableCell>{c.transferred ? "✓" : "—"}</TableCell>
                    <TableCell>
                      {new Date(c.started_at ?? c.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ‹
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {Math.ceil(filtered.length / PAGE_SIZE)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * PAGE_SIZE >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("callDetails")}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Row label={t("customer")} value={selected.from_number ?? "—"} ltr />
              <Row
                label={t("direction")}
                value={t(selected.direction === "inbound" ? "inbound" : "outbound")}
              />
              <Row label={t("status")} value={selected.status} />
              <Row label={t("duration")} value={`${selected.duration_seconds}s`} />
              <Row label={t("humanTransfers")} value={selected.transferred ? "✓" : "—"} />
              <Row label={t("endedReason")} value={selected.ended_reason ?? "—"} />
              <Row
                label={t("date")}
                value={new Date(selected.started_at ?? selected.created_at).toLocaleString()}
              />
              <div>
                <p className="mb-2 font-medium">{t("recording")}</p>
                {detail?.recordingUrl || selected.recording_url ? (
                  <audio controls className="w-full" src={detail?.recordingUrl ?? selected.recording_url!} />
                ) : (
                  <p className="text-muted-foreground">{t("noRecording")}</p>
                )}
              </div>
              <div>
                <p className="mb-2 font-medium">نص المكالمة</p>
                {detailLoading ? (
                  <p className="text-muted-foreground">{t("loading")}</p>
                ) : (
                  <TranscriptView transcript={detail?.transcript} />
                )}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span {...(ltr ? { dir: "ltr" } : {})}>{value}</span>
    </div>
  );
}
