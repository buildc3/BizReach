"use client";

import { CheckCircle2, Loader2, WifiOff, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopBar } from "@/components/layout/TopBar";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useWhatsAppStatus, useWhatsAppLogout } from "@/hooks/useWhatsApp";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

function WhatsAppCard() {
  const { data: status, isPending, isError } = useWhatsAppStatus();
  const logout = useWhatsAppLogout();

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp</CardTitle>
          <CardDescription>Checking sidecar status…</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-base">WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <WifiOff className="h-4 w-4" />
            <span>Cannot reach WhatsApp sidecar.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Start the sidecar first:{" "}
            <code className="bg-muted px-1 rounded text-xs">cd sidecar && npm start</code>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Connected
  if (status?.connected) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            WhatsApp Connected
          </CardTitle>
          <CardDescription>Messages will be sent via your linked number.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? "Disconnecting…" : "Disconnect WhatsApp"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // QR code waiting
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp — Scan to Connect</CardTitle>
        <CardDescription>
          Open WhatsApp on your phone → Linked Devices → Link a device → scan this QR code.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {status?.qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL from the sidecar, not a static asset
          <img
            src={status.qr}
            alt="WhatsApp QR code"
            className="w-52 h-52 rounded-xl border shadow"
          />
        ) : (
          <div className={cn(
            "w-52 h-52 rounded-xl border flex items-center justify-center",
            "bg-muted text-muted-foreground text-sm"
          )}>
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Generating QR…</span>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">
          QR refreshes automatically. This window polls every 3 seconds.
        </p>
      </CardContent>
    </Card>
  );
}

function SenderProfileCard() {
  const { data: profile, isPending } = useProfile();
  const update = useUpdateProfile();

  const [yourName, setYourName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate once profile loads
  useEffect(() => {
    if (profile) {
      setYourName(profile.yourName ?? "");
      setCompanyName(profile.companyName ?? "");
      setPhone(profile.phone ?? "");
      setWebsite(profile.website ?? "");
    }
  }, [profile]);

  const save = () => {
    update.mutate(
      {
        yourName:    yourName.trim()    || null,
        companyName: companyName.trim() || null,
        phone:       phone.trim()       || null,
        website:     website.trim()     || null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sender Profile</CardTitle>
        <CardDescription>
          These fill your signature placeholders in outreach messages —{" "}
          <code className="text-xs bg-muted px-1 rounded">{"{YOUR_NAME}"}</code>,{" "}
          <code className="text-xs bg-muted px-1 rounded">{"{YOUR_COMPANY_NAME}"}</code>,{" "}
          <code className="text-xs bg-muted px-1 rounded">{"{PHONE_NUMBER}"}</code>,{" "}
          <code className="text-xs bg-muted px-1 rounded">{"{WEBSITE_URL}"}</code>.
          AI-mode pitches also include this info in the signature automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Your name</Label>
                <Input
                  placeholder="e.g. Yash"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input
                  placeholder="e.g. WebPro Agency"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Your phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Your website</Label>
                <Input
                  placeholder="https://yourwebsite.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={save} disabled={update.isPending} size="sm">
              {update.isPending
                ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Saving…</>
                : saved
                ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />Saved</>
                : <><Save className="h-3.5 w-3.5 mr-1" />Save profile</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { followupDays, setFollowupDays } = useSettingsStore();
  const [localDays, setLocalDays] = useState(followupDays);

  const save = () => setFollowupDays(localDays);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6 max-w-lg">
        {/* Sender profile */}
        <SenderProfileCard />

        {/* WhatsApp connection */}
        <WhatsAppCard />

        {/* Follow-ups */}
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-up Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Flag messages older than (days)</Label>
              <Input
                type="number"
                min={1}
                value={localDays}
                onChange={(e) => setLocalDays(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={save}>Save Settings</Button>
      </div>
    </div>
  );
}
