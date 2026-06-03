"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";

export function ExpiryBanner({ monthLabel, count }: { monthLabel: string; count: number }) {
  const day = new Date().getDate();
  const [dismissed, setDismissed] = useState(false);
  // Always show if there are policies; emphasize during first week of month.
  const emphasize = day <= 7;
  if (dismissed) return null;

  async function download(kind: "xlsx" | "pdf") {
    const res = await fetch(`/api/export?format=${kind}`);
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expiry-register-${monthLabel.replace(/\s+/g, "-").toLowerCase()}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className={emphasize ? "border-primary/60 bg-primary/5" : ""}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Expiry register — {monthLabel}
          </CardTitle>
          <CardDescription>
            {count} {count === 1 ? "policy expires" : "policies expire"} this month. Download the register to follow up.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={() => download("xlsx")}><FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel</Button>
        <Button variant="outline" onClick={() => download("pdf")}><FileText className="h-4 w-4 mr-2" />Download PDF</Button>
      </CardContent>
    </Card>
  );
}
