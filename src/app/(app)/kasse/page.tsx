"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Coins,
  Loader2,
  Lock,
  Megaphone,
  Pin,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SelectNative } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ANNOUNCEMENT_AUDIENCE_LABELS,
  CASH_ENTRY_STATUS_LABELS,
  CASH_ENTRY_TYPE_LABELS,
  type AnnouncementAudience,
  type CashboxOverviewDTO,
  type CashEntryType,
  type FineCatalogItemDTO,
  type TeamAnnouncementDTO,
  type TeamPollDTO,
} from "@/domain/schemas/community";
import {
  isStaffMember,
  isTreasurerMember,
} from "@/domain/schemas/handball";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { formatCentsEur } from "@/domain/services/cashbox-service";

type HubTab = "news" | "cashbox";

export default function KasseUndNewsPage() {
  const { me, activeTeam } = useAppContext();

  const [tab, setTab] = useState<HubTab>("news");
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<TeamAnnouncementDTO[]>([]);
  const [polls, setPolls] = useState<TeamPollDTO[]>([]);
  const [cashbox, setCashbox] = useState<CashboxOverviewDTO | null>(null);
  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);

  // Dialogs: Announcement
  const [annOpen, setAnnOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annAudience, setAnnAudience] = useState<AnnouncementAudience>("ALL");
  const [annPinned, setAnnPinned] = useState(false);
  const [savingAnn, setSavingAnn] = useState(false);

  // Dialogs: Poll
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsText, setPollOptionsText] = useState("Option 1\nOption 2");
  const [pollMultiple, setPollMultiple] = useState(false);
  const [savingPoll, setSavingPoll] = useState(false);

  // Dialogs: Cash Entry
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<CashEntryType>("FINE");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryEuro, setEntryEuro] = useState("5.00");
  const [entryMemberId, setEntryMemberId] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  // Dialogs: Catalog Item
  const [catOpen, setCatOpen] = useState(false);
  const [catTitle, setCatTitle] = useState("");
  const [catEuro, setCatEuro] = useState("3.00");
  const [catCategory, setCatCategory] = useState("Disziplin");
  const [savingCat, setSavingCat] = useState(false);

  const isStaff = isStaffMember(activeTeam);
  const canManageCashbox = Boolean(
    cashbox ? cashbox.canManage : isTreasurerMember(activeTeam)
  );

  const reloadAll = useCallback(async () => {
    if (!activeTeam) return;
    const base = `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}`;
    try {
      const [aRes, pRes, cRes, mRes] = await Promise.all([
        fetch(`${base}/announcements`, { cache: "no-store" }),
        fetch(`${base}/polls`, { cache: "no-store" }),
        fetch(`${base}/cashbox`, { cache: "no-store" }),
        fetch(`${base}/members`, { cache: "no-store" }),
      ]);
      if (aRes.ok) setAnnouncements((await aRes.json()).announcements ?? []);
      if (pRes.ok) setPolls((await pRes.json()).polls ?? []);
      if (cRes.ok) setCashbox(await cRes.json());
      if (mRes.ok) setMembers((await mRes.json()).members ?? []);
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    const base = `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}`;
    Promise.all([
      fetch(`${base}/announcements`, { cache: "no-store" }),
      fetch(`${base}/polls`, { cache: "no-store" }),
      fetch(`${base}/cashbox`, { cache: "no-store" }),
      fetch(`${base}/members`, { cache: "no-store" }),
    ])
      .then(async ([aRes, pRes, cRes, mRes]) => {
        if (!active) return;
        if (aRes.ok) setAnnouncements((await aRes.json()).announcements ?? []);
        if (pRes.ok) setPolls((await pRes.json()).polls ?? []);
        if (cRes.ok) setCashbox(await cRes.json());
        if (mRes.ok) setMembers((await mRes.json()).members ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam]);

  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam) return;
    setSavingAnn(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/announcements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: annTitle,
            body: annBody,
            audience: annAudience,
            isPinned: annPinned,
          }),
        }
      );
      if (res.ok) {
        setAnnTitle("");
        setAnnBody("");
        setAnnAudience("ALL");
        setAnnPinned(false);
        setAnnOpen(false);
        await reloadAll();
      }
    } finally {
      setSavingAnn(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!activeTeam) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/announcements/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await reloadAll();
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam) return;
    const options = pollOptionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length < 2) return;
    setSavingPoll(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/polls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: pollQuestion,
            allowMultiple: pollMultiple,
            options,
          }),
        }
      );
      if (res.ok) {
        setPollQuestion("");
        setPollOptionsText("Option 1\nOption 2");
        setPollMultiple(false);
        setPollOpen(false);
        await reloadAll();
      }
    } finally {
      setSavingPoll(false);
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    if (!activeTeam) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/polls/${encodeURIComponent(pollId)}/vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      }
    );
    if (res.ok) {
      const { poll } = await res.json();
      setPolls((prev) => prev.map((p) => (p.id === poll.id ? poll : p)));
    }
  }

  function openFineFromCatalog(item: FineCatalogItemDTO) {
    setEntryType("FINE");
    setEntryTitle(item.title);
    setEntryEuro((item.amountCents / 100).toFixed(2));
    setEntryNotes("");
    setEntryOpen(true);
  }

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam) return;
    const amountCents = Math.round(
      Number(entryEuro.replace(",", ".")) * 100
    );
    if (!Number.isFinite(amountCents) || amountCents < 50) return;

    setSavingEntry(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/cashbox`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: entryType,
            title: entryTitle,
            amountCents,
            memberId: entryMemberId || null,
            notes: entryNotes || null,
          }),
        }
      );
      if (res.ok) {
        setEntryTitle("");
        setEntryNotes("");
        setEntryOpen(false);
        await reloadAll();
      }
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleTogglePaid(entryId: string, nextStatus: "PAID" | "OPEN") {
    if (!activeTeam) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/cashbox/entries/${encodeURIComponent(entryId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      }
    );
    if (res.ok) await reloadAll();
  }

  async function handleCreateCatalogItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTeam) return;
    const amountCents = Math.round(Number(catEuro.replace(",", ".")) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 50) return;

    setSavingCat(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/cashbox/catalog`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: catTitle,
            amountCents,
            category: catCategory,
          }),
        }
      );
      if (res.ok) {
        setCatTitle("");
        setCatEuro("3.00");
        setCatOpen(false);
        await reloadAll();
      }
    } finally {
      setSavingCat(false);
    }
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-5">
      {/* Kompakter Header (max. 2 Aktionen je aktivem Tab) */}
      <PageHeader
        title="Pinnwand & Kasse"
        subtitle={activeTeam.teamName}
        actions={
          tab === "news" && isStaff ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPollOpen(true)}
              >
                <BarChart3 className="h-4 w-4" />
                Umfrage
              </Button>
              <Button size="sm" onClick={() => setAnnOpen(true)}>
                <Plus className="h-4 w-4" />
                Ankündigung
              </Button>
            </>
          ) : tab === "cashbox" && canManageCashbox ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCatOpen(true)}
              >
                <Receipt className="h-4 w-4" />
                Katalog
              </Button>
              <Button size="sm" onClick={() => setEntryOpen(true)}>
                <Plus className="h-4 w-4" />
                Buchung
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Ruhige Segmented Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "news" | "cashbox")}
      >
        <TabsList>
          <TabsTrigger value="news" data-testid="tab-news">
            <Megaphone className="h-4 w-4 shrink-0" />
            Pinnwand &amp; Umfragen ({announcements.length})
          </TabsTrigger>
          <TabsTrigger value="cashbox" data-testid="tab-cashbox">
            <Wallet className="h-4 w-4 shrink-0" />
            Mannschaftskasse
            {cashbox ? ` (${formatCentsEur(cashbox.summary.balanceCents)})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Lade Team-Daten…
        </div>
      ) : tab === "news" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ankündigungen */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Schwarzes Brett
            </h2>
            {announcements.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Noch keine Ankündigungen vorhanden.
                </CardContent>
              </Card>
            ) : (
              announcements.map((ann) => (
                <Card
                  key={ann.id}
                  data-testid={`announcement-${ann.id}`}
                  className={
                    ann.isPinned ? "border-primary/50 bg-primary/5" : undefined
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ann.isPinned && (
                            <Badge variant="default" className="text-xs">
                              <Pin className="h-3 w-3 mr-1" />
                              Angepinnt
                            </Badge>
                          )}
                          {ann.audience === "STAFF_ONLY" && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              {ANNOUNCEMENT_AUDIENCE_LABELS.STAFF_ONLY}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{ann.title}</CardTitle>
                        <CardDescription className="text-xs">
                          Von {ann.authorName} ·{" "}
                          {new Date(ann.createdAt).toLocaleDateString("de-DE")}
                        </CardDescription>
                      </div>
                      {isStaff && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ankündigung ${ann.title} löschen`}
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line text-foreground">
                      {ann.body}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Umfragen */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Team-Umfragen
            </h2>
            {polls.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Aktuell keine offenen Umfragen.
                </CardContent>
              </Card>
            ) : (
              polls.map((poll) => (
                <Card key={poll.id} data-testid={`poll-${poll.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{poll.question}</CardTitle>
                    <CardDescription className="text-xs">
                      Erstellt von {poll.createdByName} · {poll.totalVotes}{" "}
                      {poll.totalVotes === 1 ? "Stimme" : "Stimmen"}
                      {poll.allowMultiple ? " · Mehrfachauswahl" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {poll.options.map((opt) => {
                      const pct =
                        poll.totalVotes > 0
                          ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                          : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-testid={`poll-option-${opt.id}`}
                          onClick={() => handleVote(poll.id, opt.id)}
                          className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                            opt.votedByMe
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm font-medium">
                            <span className="flex min-w-0 items-center gap-1.5 break-words">
                              {opt.votedByMe && (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              )}
                              <span className="min-w-0 break-words">{opt.label}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {opt.voteCount} ({pct}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Mannschaftskasse */
        <div className="space-y-6">
          {!canManageCashbox && isStaff && (
            <p className="text-xs text-muted-foreground">
              Hinweis: Änderungen an der Mannschaftskasse sind nur für Mitglieder mit der Rolle{" "}
              <span className="font-medium text-foreground">Kassenwart</span>{" "}
              freigeschaltet. Die Rolle kann im Kader zusätzlich zu jeder anderen Rolle vergeben werden.
            </p>
          )}
          {cashbox && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card data-testid="cashbox-balance-card">
                <CardHeader className="pb-2">
                  <CardDescription>Aktueller Kassenstand</CardDescription>
                  <CardTitle className="text-2xl text-primary">
                    {formatCentsEur(cashbox.summary.balanceCents)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Einzahlungen & bezahlte Strafen abzüglich Ausgaben
                </CardContent>
              </Card>

              <Card data-testid="cashbox-open-fines-card">
                <CardHeader className="pb-2">
                  <CardDescription>Offene Strafen (Team)</CardDescription>
                  <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
                    {formatCentsEur(cashbox.summary.openFinesTotalCents)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {cashbox.summary.openFinesCount} offene Position(en)
                </CardContent>
              </Card>

              <Card data-testid="cashbox-my-fines-card">
                <CardHeader className="pb-2">
                  <CardDescription>Meine offenen Strafen</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCentsEur(cashbox.summary.myOpenFinesCents)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {cashbox.summary.myOpenFinesCount === 0
                    ? "Alles beglichen – top!"
                    : `${cashbox.summary.myOpenFinesCount} offene Strafe(n)`}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Kassenbuch */}
            <div className="lg:col-span-7 min-w-0 space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Kassenbuch ({cashbox?.entries.length ?? 0})
              </h2>
              {cashbox?.entries.map((entry) => (
                <Card key={entry.id} data-testid={`cash-entry-${entry.id}`}>
                  <CardContent className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            entry.status === "OPEN" ? "injured" : "secondary"
                          }
                          className="text-xs"
                        >
                          {CASH_ENTRY_STATUS_LABELS[entry.status]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {CASH_ENTRY_TYPE_LABELS[entry.type]}
                        </Badge>
                        {entry.memberName && (
                          <span className="text-xs font-medium text-muted-foreground">
                            · {entry.memberName}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-sm break-words">{entry.title}</p>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground break-words">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end sm:self-center shrink-0">
                      <span
                        className={`font-bold text-sm tabular-nums ${
                          entry.type === "EXPENSE"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {entry.type === "EXPENSE" ? "-" : "+"}
                        {formatCentsEur(entry.amountCents)}
                      </span>
                      {canManageCashbox && entry.type === "FINE" && (
                        <Button
                          size="sm"
                          variant={entry.status === "OPEN" ? "outline" : "ghost"}
                          onClick={() =>
                            handleTogglePaid(
                              entry.id,
                              entry.status === "OPEN" ? "PAID" : "OPEN"
                            )
                          }
                        >
                          {entry.status === "OPEN"
                            ? "Als bezahlt markieren"
                            : "Wieder öffnen"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Strafenkatalog */}
            <div className="lg:col-span-5 min-w-0 space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Handball-Strafenkatalog
              </h2>
              <div className="space-y-2.5">
                {cashbox?.catalog.map((item) => (
                  <Card key={item.id} data-testid={`fine-catalog-${item.id}`}>
                    <CardContent className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm break-words">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="tabular-nums">
                          {formatCentsEur(item.amountCents)}
                        </Badge>
                        {canManageCashbox && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openFineFromCatalog(item)}
                          >
                            Buchen
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Neue Ankündigung */}
      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Ankündigung</DialogTitle>
            <DialogDescription>
              Veröffentliche eine Nachricht am Schwarzen Brett deiner Mannschaft.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">Titel</Label>
              <Input
                id="ann-title"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="z. B. Treffpunkt Pokalspiel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Nachricht</Label>
              <textarea
                id="ann-body"
                required
                rows={4}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Alle wichtigen Infos für das Team…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ann-audience">Sichtbarkeit</Label>
                <SelectNative
                  id="ann-audience"
                  value={annAudience}
                  onChange={(e) =>
                    setAnnAudience(e.target.value as AnnouncementAudience)
                  }
                >
                  <option value="ALL">Gesamtes Team & Eltern</option>
                  <option value="STAFF_ONLY">Nur Trainerteam</option>
                </SelectNative>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                  />
                  Oben anpinnen
                </label>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAnnOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingAnn}>
                {savingAnn ? "Speichere…" : "Veröffentlichen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Neue Umfrage */}
      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Team-Umfrage</DialogTitle>
            <DialogDescription>
              Gib mindestens 2 Antwortoptionen (eine pro Zeile) an.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePoll} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="poll-q">Frage</Label>
              <Input
                id="poll-q"
                required
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="z. B. Zusatztraining am Freitag?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="poll-opts">Antwortoptionen (eine pro Zeile)</Label>
              <textarea
                id="poll-opts"
                required
                rows={4}
                value={pollOptionsText}
                onChange={(e) => setPollOptionsText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={pollMultiple}
                onChange={(e) => setPollMultiple(e.target.checked)}
              />
              Mehrfachauswahl erlauben
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPollOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingPoll}>
                {savingPoll ? "Erstelle…" : "Umfrage starten"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Neue Kassenbuchung */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Buchung / Strafe</DialogTitle>
            <DialogDescription>
              Erfasse eine Strafe, Einzahlung oder Ausgabe im Kassenbuch.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEntry} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="entry-type">Buchungsart</Label>
                <SelectNative
                  id="entry-type"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as CashEntryType)}
                >
                  <option value="FINE">Strafe (offen)</option>
                  <option value="INCOME">Einzahlung</option>
                  <option value="EXPENSE">Ausgabe</option>
                </SelectNative>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-euro">Betrag (€)</Label>
                <Input
                  id="entry-euro"
                  required
                  value={entryEuro}
                  onChange={(e) => setEntryEuro(e.target.value)}
                  placeholder="5.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-title">Beschreibung</Label>
              <Input
                id="entry-title"
                required
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="z. B. Zu spät zum Training"
              />
            </div>
            {entryType === "FINE" && (
              <div className="space-y-1.5">
                <Label htmlFor="entry-member">Spieler</Label>
                <SelectNative
                  id="entry-member"
                  value={entryMemberId}
                  onChange={(e) => setEntryMemberId(e.target.value)}
                >
                  <option value="">– Allgemein / Team –</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </option>
                  ))}
                </SelectNative>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="entry-notes">Notiz (optional)</Label>
              <Input
                id="entry-notes"
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEntryOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingEntry}>
                {savingEntry ? "Speichere…" : "Buchung speichern"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Strafenkatalog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Strafenkatalog-Eintrag</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCatalogItem} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-title">Tatbestand</Label>
              <Input
                id="cat-title"
                required
                value={catTitle}
                onChange={(e) => setCatTitle(e.target.value)}
                placeholder="z. B. Handy in der Kabine"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-euro">Betrag (€)</Label>
                <Input
                  id="cat-euro"
                  required
                  value={catEuro}
                  onChange={(e) => setCatEuro(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-category">Kategorie</Label>
                <Input
                  id="cat-category"
                  required
                  value={catCategory}
                  onChange={(e) => setCatCategory(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCatOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingCat}>
                {savingCat ? "Speichere…" : "Hinzufügen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
