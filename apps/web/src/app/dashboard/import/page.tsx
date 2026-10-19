"use client";

import { CheckCircle2, Download, FileSpreadsheet, FileWarning, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/status";
import { PageHeader } from "@/components/common/states";
import { ManagerGate } from "@/components/dashboard/manager-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { IMPORT_ERROR_LABELS, medicineLabel } from "@/lib/labels";
import type { ImportPreview, ImportPreviewRow, ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_MB = 2;
const ACTION_LABELS = { CREATE: "E re", UPDATE: "Përditësim", UNCHANGED: "Pa ndryshim" } as const;

interface Batch {
  id: string;
  fileName: string;
  status: "PREVIEWED" | "COMMITTED" | "EXPIRED";
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdAt: string;
  committedAt: string | null;
  expiresAt: string;
  user: { fullName: string } | null;
}

export default function ImportPage() {
  return <ManagerGate>{(id) => <ImportView pharmacyId={id} />}</ManagerGate>;
}

function rowErrorText(row: ImportPreviewRow) {
  return row.errors.map((e) => IMPORT_ERROR_LABELS[e.code]?.(e.params) ?? e.message).join("; ");
}

function downloadErrorReport(preview: ImportPreview) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["rreshti,bari,sasia,statusi,gabimet"];
  for (const r of preview.rows.filter((x) => x.errors.length > 0)) {
    lines.push([String(r.rowNumber), r.input.medicine, r.input.quantity, r.input.availabilityStatus, rowErrorText(r)].map(escape).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gabimet-${preview.fileName.replace(/\.[^.]+$/, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportView({ pharmacyId }: { pharmacyId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const batches = useApi<Batch[]>("/pharmacy/inventory/import/batches", { pharmacyId });

  function pick(f: File | undefined | null) {
    setUploadError(null);
    setPreview(null);
    setResult(null);
    if (!f) return;
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "xlsx") {
      setUploadError("Lejohen vetëm skedarë .csv ose .xlsx.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setUploadError(`Skedari është më i madh se ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const p = await api<ImportPreview>("/pharmacy/inventory/import/preview", { method: "POST", body, query: { pharmacyId } });
      setPreview(p);
      setOnlyErrors(p.summary.errorRows > 0 && p.summary.errorRows < p.summary.totalRows);
      batches.reload();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setConfirming(true);
    try {
      const r = await api<ImportResult>("/pharmacy/inventory/import/confirm", { method: "POST", body: { batchId: preview.batchId }, query: { pharmacyId } });
      setResult(r);
      toast.success("Importi u ruajt.");
      batches.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const rows = preview ? (onlyErrors ? preview.rows.filter((r) => r.errors.length > 0) : preview.rows) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importo inventarin"
        description="Ngarkoni CSV ose Excel. Çdo rresht kontrollohet dhe ju shihni parapamjen para se të ruhet diçka."
        actions={
          <Button variant="outline" className="h-9" asChild>
            <a href="/templates/inventari-shembull.csv" download>
              <Download aria-hidden /> Shkarko shabllonin CSV
            </a>
          </Button>
        }
      />

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Hapat e importit">
        {["Ngarko skedarin", "Kontrollo parapamjen", "Konfirmo", "Raporti"].map((s, i) => {
          const step = result ? 3 : preview ? 1 : 0;
          return (
            <li key={s} className={cn("rounded-full border px-3 py-1", i <= step ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground")}>
              {i + 1}. {s}
            </li>
          );
        })}
      </ol>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle2 className="text-success" aria-hidden /> Importi përfundoi</CardTitle>
            <CardDescription>{result.fileName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Të reja" value={result.created} />
              <Metric label="Të përditësuara" value={result.updated} />
              <Metric label="Pa ndryshim (konfirmuar)" value={result.unchanged} />
              <Metric label="Rreshta me gabime (të pa ruajtur)" value={result.errorRows + result.skippedRows.length} tone={result.errorRows + result.skippedRows.length > 0 ? "danger" : undefined} />
            </div>
            {result.skippedRows.length > 0 ? (
              <Alert variant="destructive">
                <FileWarning aria-hidden />
                <AlertDescription>
                  Rreshtat {result.skippedRows.join(", ")} u anashkaluan sepse bari u çaktivizua nga katalogu pas parapamjes.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {preview && preview.summary.errorRows > 0 ? (
                <Button variant="outline" onClick={() => downloadErrorReport(preview)}>
                  <Download aria-hidden /> Shkarko rreshtat me gabime
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/dashboard/inventory">Shko te inventari</Link>
              </Button>
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden /> Importo një skedar tjetër
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !preview ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
              className={cn("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors", dragging ? "border-primary bg-accent" : "border-border")}
            >
              <FileSpreadsheet className="size-10 text-primary" aria-hidden />
              <div>
                <p className="font-medium">{file ? file.name : "Tërhiqni skedarin këtu"}</p>
                <p className="text-sm text-muted-foreground">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : `.csv ose .xlsx, deri në ${MAX_MB} MB`}
                </p>
              </div>
              <input ref={inputRef} id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>Zgjidh skedarin</Button>
                <Button onClick={upload} disabled={!file || uploading}>
                  {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                  Kontrollo skedarin
                </Button>
              </div>
            </div>
            {uploadError ? (
              <Alert variant="destructive" role="alert">
                <XCircle aria-hidden />
                <AlertTitle>Skedari nuk u pranua</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="mb-1 font-medium">Kolonat që pranohen</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                <li><code>medicine_code</code> (ose <code>kodi</code>) — rekomandohet; ose <code>medicine_name</code> + <code>strength</code> + <code>dosage_form</code></li>
                <li><code>quantity</code> (<code>sasia</code>) dhe/ose <code>availability_status</code> (IN_STOCK, LOW_STOCK, OUT_OF_STOCK, UNKNOWN ose “në stok”, “pak”, “nuk ka”)</li>
                <li><code>show_quantity_publicly</code> — po/jo (opsionale)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parapamja: {preview.fileName}</CardTitle>
            <CardDescription>Asgjë nuk është ruajtur ende. Parapamja vlen deri më {dateTime(preview.expiresAt)}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Rreshta gjithsej" value={preview.summary.totalRows} />
              <Metric label="Të vlefshëm" value={preview.summary.validRows} tone="success" />
              <Metric label="Me gabime" value={preview.summary.errorRows} tone={preview.summary.errorRows ? "danger" : undefined} />
              <Metric label="Të reja" value={preview.summary.creates} />
              <Metric label="Përditësime" value={preview.summary.updates} />
              <Metric label="Dublikata" value={preview.summary.duplicates} tone={preview.summary.duplicates ? "danger" : undefined} />
            </div>
            {preview.columns.unknownColumns.length > 0 ? (
              <p className="text-sm text-muted-foreground">Kolona të panjohura që u injoruan: {preview.columns.unknownColumns.join(", ")}</p>
            ) : null}
            {preview.summary.errorRows > 0 ? (
              <Alert variant="destructive">
                <FileWarning aria-hidden />
                <AlertTitle>{preview.summary.errorRows} rreshta kanë gabime dhe NUK do të ruhen</AlertTitle>
                <AlertDescription>Korrigjoni skedarin dhe ngarkojeni sërish, ose konfirmoni vetëm rreshtat e vlefshëm.</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="only-errors" checked={onlyErrors} onCheckedChange={setOnlyErrors} disabled={preview.summary.errorRows === 0} />
                <Label htmlFor="only-errors">Shfaq vetëm rreshtat me gabime</Label>
              </div>
              {preview.summary.errorRows > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => downloadErrorReport(preview)}>
                  <Download aria-hidden /> Shkarko gabimet (CSV)
                </Button>
              ) : null}
            </div>
            <div className="max-h-[480px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-16">Rreshti</TableHead>
                    <TableHead>Bari</TableHead>
                    <TableHead>Sasia</TableHead>
                    <TableHead>Statusi</TableHead>
                    <TableHead>Rezultati</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowNumber} className={r.errors.length ? "bg-danger-soft/60" : undefined}>
                      <TableCell className="tabular-nums">{r.rowNumber}</TableCell>
                      <TableCell>
                        {r.medicine ? <span className="font-medium">{medicineLabel(r.medicine)}</span> : <span className="text-muted-foreground">{r.input.medicine || "—"}</span>}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.quantity ?? (r.input.quantity || "—")}</TableCell>
                      <TableCell>{r.availabilityStatus ? <StatusBadge status={r.availabilityStatus} /> : r.input.availabilityStatus || "—"}</TableCell>
                      <TableCell className="max-w-md">
                        {r.errors.length ? (
                          <span className="text-sm text-destructive">{rowErrorText(r)}</span>
                        ) : r.action ? (
                          <Badge variant={r.action === "UNCHANGED" ? "outline" : "secondary"}>{ACTION_LABELS[r.action]}</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={confirming || preview.summary.validRows === 0}>
                {confirming ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                Konfirmo dhe ruaj {preview.summary.validRows} rreshta
              </Button>
              <Button variant="outline" onClick={reset} disabled={confirming}>Anulo</Button>
            </div>
            {preview.summary.validRows === 0 ? <p className="text-sm text-muted-foreground">Nuk ka rreshta të vlefshëm për t’u ruajtur.</p> : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importet e fundit</CardTitle>
        </CardHeader>
        <CardContent>
          {!batches.data || batches.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{batches.loading ? "Duke u ngarkuar…" : "Ende asnjë import."}</p>
          ) : (
            <ul className="divide-y text-sm">
              {batches.data.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-medium">{b.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(b.createdAt)} · {b.user?.fullName ?? "—"} · {b.validRows}/{b.totalRows} të vlefshëm
                    </p>
                  </div>
                  <Badge variant={b.status === "COMMITTED" ? "secondary" : "outline"}>
                    {b.status === "COMMITTED" ? "I ruajtur" : b.status === "EXPIRED" ? "Skaduar" : "Parapamje"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <div className={cn("rounded-xl border p-3", tone === "danger" && "border-destructive/30 bg-danger-soft", tone === "success" && "border-success/30 bg-success-soft")}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
