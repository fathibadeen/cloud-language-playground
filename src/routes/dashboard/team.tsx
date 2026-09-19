import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

type Member = {
  id: string;
  role: string;
  user_id: string;
  invited_email: string | null;
  created_at: string;
};

function TeamPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const companyId = useCompanyId();
  const { data: members } = useCompanyTable<Member>("company_members", companyId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");

  async function updateRole(id: string, value: string) {
    const { error } = await supabase
      .from("company_members")
      .update({ role: value as "owner" | "admin" | "agent" | "viewer" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["company_members"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("company_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["company_members"] });
  }

  function invite() {
    if (!companyId || !email) return;
    toast.message(t("inviteMember"), {
      description:
        t("email") + ": " + email + " — " + t("role") + ": " + role,
    });
    setEmail("");
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
            <Select value={role} onValueChange={setRole}>
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
          <Button onClick={invite} disabled={!email}>
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
    </div>
  );
}
