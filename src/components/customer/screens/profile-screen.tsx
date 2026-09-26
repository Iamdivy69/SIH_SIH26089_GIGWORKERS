"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  Globe,
  House,
  Landmark,
  Pencil,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, PersonAvatar, SectionCard, StatInline } from "@/components/shared";
import { useCustomerOverview } from "@/hooks/use-api";
import { money, dateFull } from "@/lib/format";
import { DEMO_ADDRESSES, MEMBER_SINCE_ISO } from "../constants";

interface EditableAddress {
  id: string;
  label: string;
  line: string;
  locality: string;
  pincode: string;
}

export function ProfileScreen() {
  const { data: overview } = useCustomerOverview();
  const [addresses, setAddresses] = useState<EditableAddress[]>(
    DEMO_ADDRESSES.map(({ id, label, line, locality, pincode }) => ({ id, label, line, locality, pincode })),
  );
  const [editing, setEditing] = useState<EditableAddress | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({ booking: true, payments: true, offers: false });

  const saveAddress = () => {
    if (!editing) return;
    setAddresses((list) => list.map((a) => (a.id === editing.id ? editing : a)));
    toast.success("Address updated", { description: "Saved locally in this prototype — new bookings will use it." });
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile & preferences"
        description="Your household account, addresses, payment methods and notification preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <SectionCard title="Saved addresses" description="Where members can be sent — pick one at booking.">
            <ul className="divide-y divide-border/70">
              {addresses.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                      <House className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{a.label}</p>
                      <p className="text-[13px] leading-snug text-muted-foreground">
                        {a.line}, {a.locality} {a.pincode}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setEditing(a)}>
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.9} /> Edit
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => toast("Address management", { description: "Adding a new address is simulated in this prototype." })}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.9} /> Add address
            </Button>
          </SectionCard>

          <SectionCard title="Payment methods" description="Simulated UPI — no real instruments in the prototype.">
            <ul className="divide-y divide-border/70">
              <li className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                    <Smartphone className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">ananya@upi</p>
                    <p className="text-xs text-muted-foreground">Saved UPI ID · used by default at checkout</p>
                  </div>
                </div>
                <span className="rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Primary
                </span>
              </li>
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => toast("Payment methods", { description: "Adding instruments is simulated in this prototype." })}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.9} /> Add payment method
            </Button>
          </SectionCard>

          <SectionCard title="Notification preferences">
            <ul className="divide-y divide-border/70">
              <li className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} /> Booking updates
                  </p>
                  <p className="text-xs text-muted-foreground">Acceptance, on-the-way, completion and confirmation reminders</p>
                </div>
                <Switch
                  checked={notifPrefs.booking}
                  onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, booking: v }))}
                  aria-label="Booking updates"
                />
              </li>
              <li className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} /> Payment receipts
                  </p>
                  <p className="text-xs text-muted-foreground">Invoice ready, settlement and refund notifications</p>
                </div>
                <Switch
                  checked={notifPrefs.payments}
                  onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, payments: v }))}
                  aria-label="Payment receipts"
                />
              </li>
              <li className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <Landmark className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} /> Cooperative announcements
                  </p>
                  <p className="text-xs text-muted-foreground">General body meetings, policy changes, new services</p>
                </div>
                <Switch
                  checked={notifPrefs.offers}
                  onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, offers: v }))}
                  aria-label="Cooperative announcements"
                />
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Preferences apply to this demo session only.</p>
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-start gap-4">
              <PersonAvatar name="Ananya Deshpande" size="xl" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight tracking-tight">Ananya Deshpande</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Kothrud, Pune</p>
                <p className="text-xs text-muted-foreground">Customer since {dateFull(MEMBER_SINCE_ISO)}</p>
              </div>
            </div>
            <Separator className="my-4" />
            <dl className="grid grid-cols-2 gap-4">
              <StatInline label="Completed services" value={String(overview?.completedCount ?? 0)} />
              <StatInline label="Spent this month" value={money(overview?.spentThisMonth)} />
            </dl>
          </SectionCard>

          <SectionCard title="Language" description="The cooperative serves neighbourhoods in their own languages.">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-success-muted px-2.5 py-1 text-[13px] font-medium text-success-deep">
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> English
              </span>
              <span className="rounded-sm border px-2.5 py-1 text-[13px] text-muted-foreground">मराठी</span>
              <span className="rounded-sm border px-2.5 py-1 text-[13px] text-muted-foreground">हिंदी</span>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
              Marathi and Hindi interfaces are on the prototype roadmap — field members already work in all three languages.
            </p>
          </SectionCard>

          <SectionCard title="About this account">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              This household account is part of the Sahyog cooperative prototype (SIH26089). All bookings, payments,
              invoices and verification records here are simulated for demonstration.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Edit address dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit address</DialogTitle>
            <DialogDescription>Changes are stored locally in this prototype session.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="addr-label" className="text-[13px]">Label</Label>
                <Input
                  id="addr-label"
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="addr-line" className="text-[13px]">Address line</Label>
                <Input
                  id="addr-line"
                  value={editing.line}
                  onChange={(e) => setEditing({ ...editing, line: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="addr-locality" className="text-[13px]">Locality</Label>
                  <Input
                    id="addr-locality"
                    value={editing.locality}
                    onChange={(e) => setEditing({ ...editing, locality: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="addr-pin" className="text-[13px]">Pincode</Label>
                  <Input
                    id="addr-pin"
                    value={editing.pincode}
                    onChange={(e) => setEditing({ ...editing, pincode: e.target.value })}
                    className="mt-1.5"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveAddress}>Save address</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
