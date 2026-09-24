import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useCompanyId, useCompanyTable } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { inviteTeamMember } from "@/lib/team.functions";
import { humanizeDbError } from "@/lib/errors";

export const Route = createFileRoute("/dashboard/team")({
  head: () => ({ meta: [{ title: "فريق العمل | صوتي" }, { name: "description", content: "إدارة أعضاء فريق شركتك وصلاحياتهم في صوتي." }, { property: "og:title", content: "فريق العمل | صوتي" }, { property: "og:description", content: "إدارة أعضاء فريق شركتك وصلاحياتهم في صوتي." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TeamPage,
});

type Member = {
  id: string;
  role: string;
  user_id: string;
  invited_email: string | null;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
};

function TeamPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: members } = useCompanyTable<Member>("company_members", companyId);
  const invite = useServerFn(inviteTeamMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [busy, setBusy] = useState(false);

  const { data: invitations } = useQuery({
    queryKey: ["company_invitations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invitations")
        .select("id, email, role, token, expires_at, accepted_at")
        .eq("company_id", companyId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  async function updateRole(id: string, value: string) {
    const { error } = await supabase
      .from("company_members")
      .update({ role: value as "owner" | "admin" | "agent" | "viewer" })
      .eq("id", id);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    qc.invalidateQueries({ queryKey: ["company_members"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("company_members").delete().eq("id", id);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    qc.invalidateQueries({ queryKey: ["company_members"] });
  }

  async function sendInvite() {
    if (!companyId || !email) return;
    setBusy(true);
    try {
      const created = await invite({ data: { companyId, email, role } });
      const link = `${window.location.origin}/invite/${created.token}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success(t("inviteSent"), { description: link });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["company_invitations"] });
    } catch (e) {
      toast.error(humanizeDbError((e as Error).message, t));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("company_invitations").delete().eq("id", id);
    if (error) { toast.error(humanizeDbError(error.message, t)); return; }
    qc.invalidateQueries({ queryKey: ["company_invitations"] });
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    toast.success(t("copied"));
  }

  const roleLabel: Record<string, string> = {
    owner: t("owner"),
    admin: t("admin"),
    agent: t("agentRole"),
    viewer: t("viewer"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("navTeam")}</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" />
          </div>
          <div className="space-y-2">
            <Label>{t("role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("admin")}</SelectItem>
                <SelectItem value="agent">{t("agentRole")}</SelectItem>
                <SelectItem value="viewer">{t("viewer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={sendInvite} disabled={!email || busy}>
            {t("inviteMember")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.invited_email ?? m.user_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(v) => updateRole(m.id, v)}>
                      <SelectTrigger className="w-36">
                        <SelectValue>{roleLabel[m.role]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{t("owner")}</SelectItem>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                        <SelectItem value="agent">{t("agentRole")}</SelectItem>
                        <SelectItem value="viewer">{t("viewer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>
                      {t("delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("pendingInvites")}</h2>
        <Card>
          <CardContent className="p-0">
            {(invitations ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">{t("noInvites")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                    <TableHead>{t("expires")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invitations ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell dir="ltr" className="font-mono text-xs">{i.email}</TableCell>
                      <TableCell>{roleLabel[i.role]}</TableCell>
                      <TableCell>{new Date(i.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyLink(i.token)}>
                          {t("copyLink")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                          {t("revoke")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
