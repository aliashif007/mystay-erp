import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

/* ─── GOOGLE FONT ────────────────────────────────────────── */
if (!document.getElementById("pjs-font")) {
  const l = document.createElement("link");
  l.id = "pjs-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
}

/* ─── DESIGN TOKENS ─────────────────────────────────────── */
const C = {
  primary:   "#222222",
  accent:    "#FF385C",
  blue:      "#0066FF",
  bg:        "#F7F7F7",
  white:     "#FFFFFF",
  success:   "#008A05",
  warning:   "#B8860B",
  warningBg: "#FFF3CC",
  error:     "#D32F2F",
  dark:      "#222222",
  mid:       "#717171",
  light:     "#A0A0A0",
  border:    "#DDDDDD",
};
const FONT = "'Plus Jakarta Sans', sans-serif";
const TEST_EMAIL = "testmystay@gmail.com";

/* ─── TYPES ──────────────────────────────────────────────── */
type Status = "Arriving" | "Staying" | "Checked Out";
type Screen = "dashboard" | "checkin" | "confirmation" | "checkout" | "checkoutSummary" | "guests" | "insights" | "menu" | "costProfile" | "dailyExpenses" | "onboarding";

type Guest = {
  id: string; name: string; room: string; status: Status; source: string;
  formComplete?: boolean; phone?: string; checkin?: string; checkout?: string;
  nights?: number; totalCharged?: number; guestCount?: number;
};
type ExtraCharge = {
  id: number; name: string;
  category: "Food & Beverage" | "Laundry & Services" | "Other"; amount: number;
};
type CheckoutPayload = {
  total: number; roomBase: number; roomGSTRate: number;
  roomCGST: number; roomSGST: number; nights: number; extraCharges: ExtraCharge[];
};
type ConfirmData = {
  name: string; room: string; checkin: string; checkout: string; guests: number; idType: string;
};
type CheckInPrefill = {
  guestId: string; name: string; phone: string; room: string;
  checkin: string; checkout: string; guests: number; source: string;
} | null;
type CostItem = { id: string; name: string; amount: number };
type DailyExpense = { id: string; name: string; amount: number; date: string };

/* ─── HELPERS ────────────────────────────────────────────── */
const today    = new Date().toISOString().split("T")[0];
const in2days  = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];

const ALL_ROOMS = ["305", "201", "101", "102", "103"];
const DAILY_REV = [
  { date: "27 Mar", amount: 12400 }, { date: "26 Mar", amount: 9800 },
  { date: "25 Mar", amount: 14200 }, { date: "24 Mar", amount: 11600 },
  { date: "23 Mar", amount: 8900  }, { date: "22 Mar", amount: 15100 },
  { date: "21 Mar", amount: 10200 },
];
const MAX_DAY = Math.max(...DAILY_REV.map(d => d.amount));
const MONTHLY_REV = [
  { month: "Mar", amount: 124500 }, { month: "Feb", amount: 98400 },
  { month: "Jan", amount: 112000 }, { month: "Dec", amount: 145000 },
  { month: "Nov", amount: 89000  }, { month: "Oct", amount: 103000 },
];

function getRoomState(r: string, guests: Guest[]): "vacant" | "arriving" | "occupied" {
  const g = guests.find(g => g.room === r && g.status !== "Checked Out");
  if (!g) return "vacant";
  return g.status === "Arriving" ? "arriving" : "occupied";
}
function roomGSTRate(rate: number) { return rate <= 1000 ? 0 : rate <= 7500 ? 5 : 18; }
function itemGSTRate(cat: ExtraCharge["category"]) { return cat === "Food & Beverage" ? 5 : 18; }
function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 !== 0 ? 2 : 0 }); }
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } }
function initials(name: string) { return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(); }

/* ─── STYLE HELPERS ──────────────────────────────────────── */
const pill = (bg: string, color = "#fff"): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", padding: "4px 10px",
  borderRadius: 20, background: bg, color, fontSize: 11, fontWeight: 600,
  fontFamily: FONT, whiteSpace: "nowrap" as const,
});
const btn = (bg: string, color = "#fff", outline = false): React.CSSProperties => ({
  display: "block", width: "100%", padding: "15px", borderRadius: 12,
  background: outline ? "transparent" : bg, color: outline ? bg : color,
  fontSize: 15, fontWeight: 700, border: outline ? `1.5px solid ${bg}` : "none",
  cursor: "pointer", textAlign: "center" as const, fontFamily: FONT,
  boxShadow: !outline && bg === C.accent ? "0 4px 14px rgba(255,56,92,0.25)" : "none",
});
const smallBtn = (variant: "primary" | "outline" = "outline"): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 8,
  background: variant === "primary" ? C.accent : "transparent",
  color: variant === "primary" ? "#fff" : C.dark,
  fontSize: 12, fontWeight: 600,
  border: `1.5px solid ${variant === "primary" ? C.accent : C.border}`,
  cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" as const,
});
const inp: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: 10,
  border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: FONT,
  boxSizing: "border-box" as const, outline: "none", color: C.dark, background: C.white,
};
const lbl: React.CSSProperties = {
  fontSize: 11, color: C.mid, fontWeight: 600, display: "block", marginBottom: 6,
  fontFamily: FONT, textTransform: "uppercase" as const, letterSpacing: "0.5px",
};
const fgrp: React.CSSProperties = { marginBottom: 18 };
const card: React.CSSProperties = {
  background: C.white, borderRadius: 16, padding: 18,
  boxShadow: "0 2px 12px rgba(0,0,0,0.07)", marginBottom: 12,
};
const secTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.light, marginBottom: 12,
  textTransform: "uppercase" as const, letterSpacing: "0.7px", fontFamily: FONT,
};
const hdr: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 20px", background: C.white, borderBottom: `1px solid #F0F0F0`, fontFamily: FONT,
};
const hdrIcon: React.CSSProperties = {
  fontSize: 20, cursor: "pointer", background: "none",
  border: "none", color: C.dark, padding: 6, fontFamily: FONT, lineHeight: 1,
};

/* ─── TOAST ──────────────────────────────────────────────── */
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: C.dark, color: "#fff", padding: "12px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: FONT, zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
      {msg}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, [string, string]> = { "Arriving": [C.warningBg, C.warning], "Staying": ["#E6F4EA", C.success], "Checked Out": ["#F0F0F0", C.mid] };
  const [bg, color] = map[status];
  return <span style={pill(bg, color)}>{status}</span>;
}

function OTATag({ source }: { source: string }) {
  const map: Record<string, [string, string]> = { "Booking.com": ["#003580", "#fff"], "Airbnb": [C.accent, "#fff"], "Walk-in": ["#EFEFEF", C.mid] };
  const [bg, color] = map[source] ?? ["#EFEFEF", C.mid];
  return <span style={{ ...pill(bg, color), fontSize: 10 }}>{source}</span>;
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const colors = ["#FFE4E8", "#E8F0FF", "#E6F4EA", "#FFF3CC", "#F0EDFF"];
  const textColors = [C.accent, C.blue, C.success, C.warning, "#6B52E8"];
  const idx = name.charCodeAt(0) % 5;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[idx], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.35, fontWeight: 700, color: textColors[idx], fontFamily: FONT }}>
      {initials(name)}
    </div>
  );
}

function RoomTile({ roomNum, state }: { roomNum: string; state: "vacant" | "arriving" | "occupied" }) {
  const styles: Record<string, [string, string]> = { vacant: ["#E8F5E9", C.success], arriving: ["#FFF8E1", "#E65100"], occupied: ["#EEF4FF", C.blue] };
  const label = { vacant: "Free", arriving: "Arr.", occupied: "Occ." }[state];
  const [bg, text] = styles[state];
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "12px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: text, fontFamily: FONT }}>{roomNum}</div>
      <div style={{ fontSize: 10, color: text, marginTop: 3, fontFamily: FONT, opacity: 0.8 }}>{label}</div>
    </div>
  );
}

/* ─── BOTTOM NAV ─────────────────────────────────────────── */
const NAV_TABS = [
  { id: "dashboard", label: "MyStay", icon: "⊞", screen: "dashboard" as Screen },
  { id: "guests",    label: "Guests",  icon: "👤", screen: "guests"    as Screen },
  { id: "insights",  label: "Insights",icon: "📊", screen: "insights"  as Screen },
  { id: "menu",      label: "Menu",    icon: "☰",  screen: "menu"      as Screen },
];

function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const activeTab = NAV_TABS.find(t => t.screen === screen)?.id ?? "dashboard";
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "100%", background: C.white, borderTop: `1px solid #F0F0F0`, display: "flex", zIndex: 100 }}>
      {NAV_TABS.map(t => {
        const active = activeTab === t.id;
        return (
          <div key={t.id} onClick={() => setScreen(t.screen)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 8px", cursor: "pointer" }}>
            <span style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontFamily: FONT, fontWeight: active ? 700 : 400, color: active ? C.accent : C.light }}>{t.label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.accent, marginTop: 3 }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── LOGIN SCREEN ───────────────────────────────────────── */
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: FONT }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#FFE4E8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>🏨</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.dark, fontFamily: FONT }}>MyStay</div>
          <div style={{ fontSize: 14, color: C.mid, marginTop: 6, fontFamily: FONT }}>Hotel management for small hotels</div>
        </div>

        {/* Login card */}
        <div style={{ background: C.white, borderRadius: 20, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 8, fontFamily: FONT }}>Welcome back</div>
          <div style={{ fontSize: 14, color: C.mid, marginBottom: 32, fontFamily: FONT }}>Sign in to manage your property</div>

          {error && (
            <div style={{ background: "#FFE4E8", border: `1px solid ${C.accent}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: C.error, fontFamily: FONT }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px", borderRadius: 12, background: C.white, border: `1.5px solid ${C.border}`, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 600, color: C.dark, fontFamily: FONT, opacity: loading ? 0.7 : 1 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </button>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.light, fontFamily: FONT, lineHeight: 1.6 }}>
            By signing in you agree to our terms of service. Your data is securely stored and only visible to you.
          </div>
        </div>

        {/* Test account notice */}
        <div style={{ marginTop: 20, background: "#FFF8E1", border: `1px solid #FFD54F`, borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#7B5800", fontFamily: FONT, fontWeight: 600, marginBottom: 4 }}>🧪 Testing?</div>
          <div style={{ fontSize: 11, color: "#9E6B00", fontFamily: FONT }}>Use testmystay@gmail.com to explore with dummy data</div>
        </div>
      </div>
    </div>
  );
}

/* ─── ONBOARDING SCREEN ──────────────────────────────────── */
function OnboardingScreen({ user, isTest, onComplete }: { user: User; isTest: boolean; onComplete: (costs: CostItem[]) => void }) {
  const [hotelName, setHotelName] = useState(isTest ? "Heritage Grand" : "");
  const [location,  setLocation]  = useState(isTest ? "Jaipur, Rajasthan" : "");
  const [costs, setCosts] = useState<{ name: string; amount: string }[]>([
    { name: "Monthly Rent",     amount: isTest ? "45000" : "" },
    { name: "Electricity",      amount: isTest ? "12000" : "" },
    { name: "Water Bill",       amount: isTest ? "3000"  : "" },
    { name: "Staff Salaries",   amount: isTest ? "60000" : "" },
    { name: "Internet & Cable", amount: isTest ? "2000"  : "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState("");

  const addCost = () => setCosts(c => [...c, { name: "", amount: "" }]);
  const updateCost = (i: number, field: "name" | "amount", val: string) =>
    setCosts(c => c.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  const removeCost = (i: number) => setCosts(c => c.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!hotelName) { setToast("Please enter your hotel name"); setTimeout(() => setToast(""), 3000); return; }
    setSaving(true);

    // Save property
    const { data: prop, error: propErr } = await supabase.from("properties").insert({
      user_id: user.id,
      name: hotelName,
      location,
      is_test: isTest,
    }).select().single();

    if (propErr) { setToast("Error saving property"); setSaving(false); return; }

    // Save costs
    const validCosts = costs.filter(c => c.name && c.amount);
    if (validCosts.length > 0) {
      await supabase.from("monthly_costs").insert(
        validCosts.map(c => ({
          property_id: prop.id,
          user_id: user.id,
          name: c.name,
          amount: parseFloat(c.amount),
          is_test: isTest,
        }))
      );
    }

    const costItems: CostItem[] = validCosts.map((c, i) => ({ id: String(i), name: c.name, amount: parseFloat(c.amount) }));
    setSaving(false);
    onComplete(costItems);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT, paddingBottom: 40 }}>
      {toast && <Toast msg={toast} />}
      <div style={{ background: C.white, padding: "32px 20px 20px", borderBottom: `1px solid #F0F0F0`, textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Welcome to MyStay 👋</div>
        <div style={{ fontSize: 14, color: C.mid }}>Let's set up your property in 2 minutes</div>
        {isTest && <div style={{ marginTop: 10, background: "#FFF8E1", border: `1px solid #FFD54F`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7B5800", fontWeight: 600 }}>🧪 Test Mode — data tagged as demo</div>}
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {/* Property details */}
        <div style={card}>
          <div style={secTitle}>Property Details</div>
          <div style={fgrp}>
            <label style={lbl}>Hotel / Property Name</label>
            <input style={inp} value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="e.g. Heritage Grand" />
          </div>
          <div style={fgrp}>
            <label style={lbl}>Location</label>
            <input style={inp} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Jaipur, Rajasthan" />
          </div>
        </div>

        {/* Monthly costs */}
        <div style={card}>
          <div style={secTitle}>Monthly Fixed Costs</div>
          <div style={{ fontSize: 12, color: C.mid, marginBottom: 14, fontFamily: FONT }}>These are used to calculate your profit in Insights. You can edit them anytime.</div>
          {costs.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input style={{ ...inp, flex: 2, fontSize: 13, padding: "11px 12px" }} value={c.name} onChange={e => updateCost(i, "name", e.target.value)} placeholder="Cost item" />
              <div style={{ position: "relative", flex: 1 }}>
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.mid }}>₹</div>
                <input type="number" style={{ ...inp, paddingLeft: 24, fontSize: 13, padding: "11px 12px 11px 24px" }} value={c.amount} onChange={e => updateCost(i, "amount", e.target.value)} placeholder="0" />
              </div>
              <button onClick={() => removeCost(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 20, flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button onClick={addCost} style={{ background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 10, width: "100%", padding: "12px", cursor: "pointer", color: C.mid, fontSize: 13, fontWeight: 600, fontFamily: FONT, marginTop: 8 }}>+ Add Cost Item</button>
        </div>

        <button style={btn(C.accent)} onClick={handleSave} disabled={saving}>
          {saving ? "Setting up..." : "Start Managing My Hotel →"}
        </button>
      </div>
    </div>
  );
}

/* ─── GUEST CARD ─────────────────────────────────────────── */
function GuestCard({ guest, onCheckin, onCheckout }: { guest: Guest; onCheckin?: () => void; onCheckout?: () => void }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <Avatar name={guest.name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.dark, fontFamily: FONT }}>{guest.name}</div>
            <StatusPill status={guest.status} />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...pill("#EEF4FF", C.blue), fontSize: 11 }}>Room {guest.room}</span>
            <OTATag source={guest.source} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.light, marginBottom: 10, paddingLeft: 52, fontFamily: FONT }}>Check-in: 2:00 PM</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 52 }}>
        <div>{guest.formComplete && <span style={{ fontSize: 12, color: C.success, fontWeight: 600, fontFamily: FONT }}>✓ Form Complete</span>}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {guest.status === "Arriving"  && onCheckin  && <button style={smallBtn("primary")} onClick={onCheckin}>Check-in →</button>}
          {guest.status === "Staying"   && onCheckout && <button style={smallBtn("outline")} onClick={onCheckout}>Check-out →</button>}
        </div>
      </div>
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────── */
function Dashboard({ guests, setScreen, setActiveGuest, setPrefill, hotelName, isTest }: {
  guests: Guest[]; setScreen: (s: Screen) => void;
  setActiveGuest: (g: Guest | null) => void; setPrefill: (p: CheckInPrefill) => void;
  hotelName: string; isTest: boolean;
}) {
  const [revExpanded, setRevExpanded] = useState(false);
  const roomStates    = ALL_ROOMS.map(r => ({ num: r, state: getRoomState(r, guests) }));
  const vacantCount   = roomStates.filter(r => r.state === "vacant").length;
  const arrivingCount = roomStates.filter(r => r.state === "arriving").length;
  const occupiedCount = roomStates.filter(r => r.state === "occupied").length;

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}>
        <button style={hdrIcon}>☰</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>{hotelName}</div>
          {isTest && <div style={{ fontSize: 10, color: C.warning, fontWeight: 600 }}>🧪 Test Mode</div>}
        </div>
        <button style={hdrIcon}>⊞</button>
      </div>
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ background: C.white, borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", cursor: "pointer" }} onClick={() => setRevExpanded(e => !e)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ color: C.light, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Revenue This Week</div>
              <div style={{ color: C.dark, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>₹1,24,500</div>
              <div style={{ color: C.success, fontSize: 12, marginTop: 6, fontWeight: 600 }}>↑ 12% from last week</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F7F7F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.mid, transition: "transform 0.2s", transform: revExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
          </div>
          {revExpanded && (
            <div style={{ marginTop: 16, borderTop: `1px solid #F0F0F0`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {DAILY_REV.map(d => (
                <div key={d.date}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ color: C.mid, fontSize: 12, fontWeight: 500 }}>{d.date}</span>
                    <span style={{ color: C.dark, fontSize: 12, fontWeight: 700 }}>{fmt(d.amount)}</span>
                  </div>
                  <div style={{ height: 4, background: "#F0F0F0", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.amount / MAX_DAY) * 100}%`, background: C.accent, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Rooms</div>
            <div style={{ display: "flex", gap: 6 }}>
              {vacantCount   > 0 && <span style={pill("#E6F4EA", C.success)}>{vacantCount} Free</span>}
              {arrivingCount > 0 && <span style={pill(C.warningBg, C.warning)}>{arrivingCount} Arriving</span>}
              {occupiedCount > 0 && <span style={pill("#EEF4FF", C.blue)}>{occupiedCount} Occupied</span>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            {roomStates.map(r => <RoomTile key={r.num} roomNum={r.num} state={r.state} />)}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Today's Guests</div>
            <div style={{ fontSize: 12, color: C.light, fontFamily: FONT }}>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
          </div>
          {guests.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.light, fontSize: 14, fontFamily: FONT }}>No guests yet. Add your first check-in.</div>
          )}
          {guests.map(g => (
            <GuestCard key={g.id} guest={g}
              onCheckin={g.status === "Arriving" ? () => { setActiveGuest(g); setPrefill({ guestId: g.id, name: g.name, phone: g.phone ?? "", room: g.room, checkin: g.checkin ?? today, checkout: g.checkout ?? in2days, guests: g.guestCount ?? 2, source: g.source }); setScreen("checkin"); } : undefined}
              onCheckout={g.status === "Staying" ? () => { setActiveGuest(g); setScreen("checkout"); } : undefined}
            />
          ))}
        </div>
      </div>
      <div style={{ padding: "4px 12px 16px" }}>
        <button style={btn(C.accent)} onClick={() => { setPrefill(null); setActiveGuest(null); setScreen("checkin"); }}>＋ New Check-in</button>
      </div>
      <BottomNav screen="dashboard" setScreen={setScreen} />
    </div>
  );
}

/* ─── GUESTS SCREEN ──────────────────────────────────────── */
function GuestsScreen({ guests, setScreen, setActiveGuest }: { guests: Guest[]; setScreen: (s: Screen) => void; setActiveGuest: (g: Guest | null) => void }) {
  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}><span style={{ width: 36 }} /><span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Guests</span><span style={{ width: 36 }} /></div>
      <div style={{ padding: "12px 12px 0" }}>
        {guests.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: C.light, fontSize: 14 }}>No guests yet</div>}
        {guests.map(g => (
          <div key={g.id} style={card}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
              <Avatar name={g.name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.dark, fontFamily: FONT }}>{g.name}</div>
                  <StatusPill status={g.status} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ ...pill("#EEF4FF", C.blue), fontSize: 11 }}>Room {g.room}</span>
                  <OTATag source={g.source} />
                  {g.guestCount && <span style={{ ...pill("#F5F5F5", C.mid), fontSize: 10 }}>{g.guestCount} Guest{g.guestCount > 1 ? "s" : ""}</span>}
                </div>
              </div>
            </div>
            {(g.checkin || g.checkout) && <div style={{ fontSize: 12, color: C.light, marginBottom: 10, paddingLeft: 52 }}>{g.checkin && fmtDate(g.checkin)} → {g.checkout && fmtDate(g.checkout)}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {g.status === "Staying"     && <button style={smallBtn("primary")} onClick={() => { setActiveGuest(g); setScreen("checkout"); }}>Check-out →</button>}
              {g.status === "Checked Out" && <button style={smallBtn("outline")}>View Details</button>}
            </div>
          </div>
        ))}
      </div>
      <BottomNav screen="guests" setScreen={setScreen} />
    </div>
  );
}

/* ─── INSIGHTS SCREEN ────────────────────────────────────── */
function InsightsScreen({ costs, dailyExpenses, setScreen }: { costs: CostItem[]; dailyExpenses: DailyExpense[]; setScreen: (s: Screen) => void }) {
  const [view, setView] = useState<"week" | "month" | "custom">("week");
  const [customStart, setCustomStart] = useState("2026-03-01");
  const [customEnd,   setCustomEnd]   = useState(today);

  const totalMonthlyCost  = costs.reduce((s, c) => s + c.amount, 0);
  const totalDailyVarCost = dailyExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const dailyCost         = totalMonthlyCost / 30;

  const weeklyRevenue = DAILY_REV.reduce((s, d) => s + d.amount, 0);
  const weeklyCost    = Math.round(dailyCost * 7);
  const weeklyProfit  = weeklyRevenue - weeklyCost;
  const weeklyMargin  = weeklyRevenue > 0 ? Math.round((weeklyProfit / weeklyRevenue) * 100) : 0;

  const monthlyRevenue = MONTHLY_REV[0].amount;
  const monthlyProfit  = monthlyRevenue - totalMonthlyCost;
  const monthlyMargin  = Math.round((monthlyProfit / monthlyRevenue) * 100);

  const days          = Math.max(1, Math.round((new Date(customEnd).getTime() - new Date(customStart).getTime()) / 86400000));
  const customRevenue = Math.round(dailyCost * days * 1.8);
  const customCost    = Math.round(dailyCost * days);
  const customProfit  = customRevenue - customCost;
  const customMargin  = Math.round((customProfit / customRevenue) * 100);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "9px 0", textAlign: "center" as const, fontSize: 13,
    fontWeight: active ? 700 : 500, color: active ? C.white : C.mid,
    background: active ? C.dark : "transparent", border: "none",
    cursor: "pointer", fontFamily: FONT, borderRadius: 10,
  });

  const MetricCard = ({ label, value, sub, color = C.dark }: { label: string; value: string; sub?: string; color?: string }) => (
    <div style={{ background: C.white, borderRadius: 14, padding: "14px 16px", flex: 1, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 11, color: C.light, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 6, fontFamily: FONT }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: FONT }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.light, marginTop: 4, fontFamily: FONT }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}><span style={{ width: 36 }} /><span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Insights</span><span style={{ width: 36 }} /></div>
      <div style={{ padding: "12px 12px 0" }}>
        {totalDailyVarCost > 0 && (
          <div style={{ background: "#EEF4FF", border: `1px solid #C5D9FF`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: FONT }}>Today's variable expenses</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.blue, fontFamily: FONT }}>{fmt(totalDailyVarCost)}</span>
          </div>
        )}

        <div style={{ background: "#EFEFEF", borderRadius: 12, padding: 4, display: "flex", gap: 2, marginBottom: 20 }}>
          <button style={tabStyle(view === "week")}   onClick={() => setView("week")}>This Week</button>
          <button style={tabStyle(view === "month")}  onClick={() => setView("month")}>This Month</button>
          <button style={tabStyle(view === "custom")} onClick={() => setView("custom")}>Custom</button>
        </div>

        {view === "custom" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><label style={lbl}>From</label><input type="date" style={{ ...inp, fontSize: 13 }} value={customStart} onChange={e => setCustomStart(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>To</label><input type="date" style={{ ...inp, fontSize: 13 }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>
          </div>
        )}

        {view === "week" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <MetricCard label="Revenue"   value={fmt(weeklyRevenue)} sub="Last 7 days" />
              <MetricCard label="Est. Cost" value={fmt(weeklyCost)}    sub="÷30 × 7 days" color={C.error} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <MetricCard label="Est. Profit" value={fmt(weeklyProfit)} sub={`${weeklyMargin}% margin`} color={weeklyProfit >= 0 ? C.success : C.error} />
              <MetricCard label="Avg / Day"   value={fmt(Math.round(weeklyRevenue / 7))} sub="Per day" />
            </div>
            <div style={card}>
              <div style={secTitle}>Daily Revenue — Last 7 Days</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginBottom: 8 }}>
                {DAILY_REV.map((d, i) => {
                  const barH  = Math.round((d.amount / MAX_DAY) * 100);
                  const costH = Math.round((dailyCost / MAX_DAY) * 100);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ width: "100%", height: `${barH}%`, background: i === 0 ? C.accent : "#EEF4FF", borderRadius: "6px 6px 0 0", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${Math.min(100, Math.round((costH / barH) * 100))}%`, background: "rgba(0,0,0,0.08)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {DAILY_REV.map((d, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.light, fontFamily: FONT }}>{d.date.split(" ")[0]}</div>)}
              </div>
            </div>
          </>
        )}

        {view === "month" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <MetricCard label="Revenue"    value={fmt(monthlyRevenue)} sub="March 2026" />
              <MetricCard label="Total Cost" value={fmt(totalMonthlyCost)} sub="Fixed monthly" color={C.error} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <MetricCard label="Net Profit" value={fmt(monthlyProfit)} sub={`${monthlyMargin}% margin`} color={monthlyProfit >= 0 ? C.success : C.error} />
              <MetricCard label="Avg / Day"  value={fmt(Math.round(monthlyRevenue / 30))} sub="Per day" />
            </div>
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={secTitle}>Monthly Revenue Trend</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, marginBottom: 8 }}>
                {MONTHLY_REV.map((m, i) => {
                  const maxM = Math.max(...MONTHLY_REV.map(x => x.amount));
                  const h = Math.round((m.amount / maxM) * 90);
                  return <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}><div style={{ width: "100%", height: `${h}%`, background: i === 0 ? C.accent : "#EEF4FF", borderRadius: "6px 6px 0 0" }} /></div>;
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {MONTHLY_REV.map((m, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: C.light, fontFamily: FONT }}>{m.month}</div>)}
              </div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={secTitle}>Cost Breakdown</div>
                <button onClick={() => setScreen("costProfile")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: FONT }}>Edit →</button>
              </div>
              {costs.map((c, i) => {
                const pct = Math.round((c.amount / totalMonthlyCost) * 100);
                return (
                  <div key={c.id} style={{ marginBottom: i === costs.length - 1 ? 0 : 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.dark, fontFamily: FONT }}>{c.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, fontFamily: FONT }}>{fmt(c.amount)}</span>
                    </div>
                    <div style={{ height: 4, background: "#F0F0F0", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: C.accent, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.light, marginTop: 2, fontFamily: FONT }}>{pct}% of costs</div>
                  </div>
                );
              })}
              <div style={{ borderTop: `1px solid #F0F0F0`, marginTop: 14, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.error, fontFamily: FONT }}>{fmt(totalMonthlyCost)}</span>
              </div>
            </div>
          </>
        )}

        {view === "custom" && (
          <>
            <div style={{ fontSize: 12, color: C.mid, fontFamily: FONT, marginBottom: 16 }}>{days} day{days !== 1 ? "s" : ""} selected · Daily cost est. {fmt(Math.round(dailyCost))}</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <MetricCard label="Revenue"   value={fmt(customRevenue)} sub={`${days} days`} />
              <MetricCard label="Est. Cost" value={fmt(customCost)} sub={`÷30 × ${days}d`} color={C.error} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <MetricCard label="Est. Profit" value={fmt(customProfit)} sub={`${customMargin}% margin`} color={customProfit >= 0 ? C.success : C.error} />
              <MetricCard label="Daily Avg" value={fmt(Math.round(customRevenue / days))} sub="Per day" />
            </div>
          </>
        )}
      </div>
      <BottomNav screen="insights" setScreen={setScreen} />
    </div>
  );
}

/* ─── COST PROFILE ───────────────────────────────────────── */
function CostProfilePage({ costs, setCosts, user, propertyId, isTest, setScreen }: {
  costs: CostItem[]; setCosts: (c: CostItem[]) => void;
  user: User; propertyId: string; isTest: boolean; setScreen: (s: Screen) => void;
}) {
  const [local, setLocal] = useState<CostItem[]>(costs);
  const [saved, setSaved] = useState(false);
  const nextId = useRef(100);

  const update = (id: string, field: keyof CostItem, val: string | number) => setLocal(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  const remove = async (id: string) => {
    setLocal(prev => prev.filter(c => c.id !== id));
    if (id.length > 10) await supabase.from("monthly_costs").delete().eq("id", id);
  };
  const add = () => setLocal(prev => [...prev, { id: String(nextId.current++), name: "", amount: 0 }]);

  const save = async () => {
    for (const c of local) {
      if (c.id.length > 10) {
        await supabase.from("monthly_costs").update({ name: c.name, amount: c.amount }).eq("id", c.id);
      } else {
        const { data } = await supabase.from("monthly_costs").insert({ property_id: propertyId, user_id: user.id, name: c.name, amount: c.amount, is_test: isTest }).select().single();
        if (data) setLocal(prev => prev.map(x => x.id === c.id ? { ...x, id: data.id } : x));
      }
    }
    setCosts(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const total = local.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      {saved && <Toast msg="✓ Costs saved" />}
      <div style={hdr}>
        <button style={hdrIcon} onClick={() => setScreen("menu")}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Monthly Costs</span>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ background: "#EEF4FF", border: `1px solid #C5D9FF`, borderRadius: 12, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <span style={{ fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: FONT }}>Fill once — used every month for P&L in Insights. Edit anytime.</span>
        </div>
        <div style={card}>
          <div style={secTitle}>Operating Costs</div>
          {local.map((c) => (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...inp, flex: 2, fontSize: 13, padding: "11px 12px" }} value={c.name} onChange={e => update(c.id, "name", e.target.value)} placeholder="Cost item" />
                <div style={{ position: "relative", flex: 1 }}>
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.mid }}>₹</div>
                  <input type="number" style={{ ...inp, paddingLeft: 24, fontSize: 13, padding: "11px 12px 11px 24px" }} value={c.amount} onChange={e => update(c.id, "amount", +e.target.value || 0)} placeholder="0" />
                </div>
                <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 20, padding: "0 4px", flexShrink: 0 }}>×</button>
              </div>
            </div>
          ))}
          <button onClick={add} style={{ background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 10, width: "100%", padding: "12px", cursor: "pointer", color: C.mid, fontSize: 13, fontWeight: 600, fontFamily: FONT, marginTop: 6 }}>+ Add Cost Item</button>
          <div style={{ borderTop: `1px solid #F0F0F0`, marginTop: 16, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Total Monthly Cost</div>
              <div style={{ fontSize: 11, color: C.light, marginTop: 2, fontFamily: FONT }}>≈ {fmt(Math.round(total / 30))}/day</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.error, fontFamily: FONT }}>{fmt(total)}</div>
          </div>
        </div>
        <button style={btn(C.accent)} onClick={save}>Save Costs</button>
        <div style={{ height: 12 }} />
        <button style={btn(C.dark, "#fff", true)} onClick={() => setScreen("menu")}>← Back to Menu</button>
      </div>
    </div>
  );
}

/* ─── DAILY EXPENSES PAGE ────────────────────────────────── */
function DailyExpensesPage({ dailyExpenses, setDailyExpenses, user, propertyId, isTest, setScreen }: {
  dailyExpenses: DailyExpense[]; setDailyExpenses: (e: DailyExpense[]) => void;
  user: User; propertyId: string; isTest: boolean; setScreen: (s: Screen) => void;
}) {
  const [name,   setName]   = useState("");
  const [amount, setAmount] = useState("");
  const [date,   setDate]   = useState(today);
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState("");

  const todayExpenses = dailyExpenses.filter(e => e.date === date);
  const totalToday    = todayExpenses.reduce((s, e) => s + e.amount, 0);

  const addExpense = async () => {
    if (!name || !amount) { setToast("Enter item name and amount"); setTimeout(() => setToast(""), 3000); return; }
    setSaving(true);
    const { data, error } = await supabase.from("daily_expenses").insert({
      property_id: propertyId, user_id: user.id,
      name, amount: parseFloat(amount), date, is_test: isTest,
    }).select().single();
    if (!error && data) {
      setDailyExpenses([...dailyExpenses, { id: data.id, name: data.name, amount: data.amount, date: data.date }]);
      setName(""); setAmount("");
      setToast("✓ Expense added");
      setTimeout(() => setToast(""), 2000);
    }
    setSaving(false);
  };

  const removeExpense = async (id: string) => {
    await supabase.from("daily_expenses").delete().eq("id", id);
    setDailyExpenses(dailyExpenses.filter(e => e.id !== id));
  };

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      {toast && <Toast msg={toast} />}
      <div style={hdr}>
        <button style={hdrIcon} onClick={() => setScreen("menu")}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Daily Expenses</span>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ background: "#EEF4FF", border: `1px solid #C5D9FF`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: FONT }}>Log daily variable costs — supplies, repairs, ad hoc spending. These feed into your Insights P&L.</span>
        </div>

        <div style={{ ...fgrp }}>
          <label style={lbl}>Date</label>
          <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div style={card}>
          <div style={secTitle}>Add Expense</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={{ ...inp, flex: 2, fontSize: 13, padding: "11px 12px" }} value={name} onChange={e => setName(e.target.value)} placeholder="Item (e.g. Cleaning supplies)" />
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.mid }}>₹</div>
              <input type="number" style={{ ...inp, paddingLeft: 24, fontSize: 13, padding: "11px 12px 11px 24px" }} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <button style={btn(C.accent)} onClick={addExpense} disabled={saving}>{saving ? "Adding..." : "+ Add Expense"}</button>
        </div>

        {todayExpenses.length > 0 && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={secTitle}>Expenses for {fmtDate(date)}</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.error, fontFamily: FONT }}>{fmt(totalToday)}</span>
            </div>
            {todayExpenses.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid #F5F5F5` }}>
                <span style={{ fontSize: 14, color: C.dark, fontFamily: FONT }}>{e.name}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.dark, fontFamily: FONT }}>{fmt(e.amount)}</span>
                  <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {todayExpenses.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.light, fontSize: 14, fontFamily: FONT }}>No expenses logged for this date</div>
        )}
      </div>
    </div>
  );
}

/* ─── MENU SCREEN ────────────────────────────────────────── */
function MenuScreen({ setScreen, user, hotelName, onSignOut }: {
  setScreen: (s: Screen) => void; user: User; hotelName: string; onSignOut: () => void;
}) {
  const items = [
    { icon: "💰", label: "Monthly Costs",    action: () => setScreen("costProfile"),    danger: false },
    { icon: "📋", label: "Daily Expenses",   action: () => setScreen("dailyExpenses"),  danger: false },
    { icon: "⚙️", label: "Settings",         action: null,                              danger: false },
    { icon: "ℹ️", label: "About",            action: null,                              danger: false },
    { icon: "❓", label: "Help",             action: null,                              danger: false },
    { icon: "🚪", label: "Sign Out",         action: onSignOut,                         danger: true  },
  ];
  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}><span style={{ width: 36 }} /><span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Menu</span><span style={{ width: 36 }} /></div>
      <div style={{ padding: "20px 12px 0" }}>
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FFE4E8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.dark, fontFamily: FONT }}>{hotelName}</div>
            <div style={{ color: C.mid, fontSize: 13, marginTop: 2, fontFamily: FONT }}>{user.email}</div>
          </div>
          <button onClick={() => setScreen("costProfile")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: FONT }}>Edit →</button>
        </div>
        <div style={{ background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          {items.map((item, i) => (
            <div key={item.label}>
              {i > 0 && <div style={{ height: 1, background: "#F5F5F5", marginLeft: 56 }} />}
              <div onClick={item.action ?? undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", cursor: item.action ? "pointer" : "default" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{item.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: item.danger ? C.error : C.dark, fontFamily: FONT }}>{item.label}</span>
                </div>
                {!item.danger && <span style={{ color: C.light, fontSize: 18 }}>›</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32, color: C.light, fontSize: 11, fontFamily: FONT }}>MyStay ERP v1.0.0</div>
      </div>
      <BottomNav screen="menu" setScreen={setScreen} />
    </div>
  );
}

/* ─── CHECK-IN FORM ──────────────────────────────────────── */
function CheckInForm({ setScreen, prefill, guests, user, propertyId, isTest, onComplete }: {
  setScreen: (s: Screen) => void; prefill: CheckInPrefill;
  guests: Guest[]; user: User; propertyId: string; isTest: boolean;
  onComplete: (data: ConfirmData, guestId?: string) => void;
}) {
  const isOTA = prefill !== null;
  const [form, setForm] = useState({ name: prefill?.name ?? "", phone: prefill?.phone ?? "", idType: "Aadhaar", idNum: "", address: "", checkin: prefill?.checkin ?? today, checkout: prefill?.checkout ?? in2days, room: prefill?.room ?? "101", numGuests: prefill?.guests ?? 1, purpose: "Tourism" });
  const [idVerified, setIdVerified] = useState(false);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const submit = async () => {
    if (!form.name) return;
    if (!idVerified) { setShake(true); setTimeout(() => setShake(false), 500); showToast("Please verify guest ID before check-in"); return; }
    setSaving(true);

    if (prefill?.guestId) {
      await supabase.from("guests").update({ status: "Staying", form_complete: true, id_type: form.idType, phone: form.phone, address: form.address, purpose: form.purpose }).eq("id", prefill.guestId);
      onComplete({ name: form.name, room: form.room, checkin: form.checkin, checkout: form.checkout, guests: form.numGuests, idType: form.idType }, prefill.guestId);
    } else {
      const nights = Math.max(1, Math.round((new Date(form.checkout).getTime() - new Date(form.checkin).getTime()) / 86400000));
      const { data } = await supabase.from("guests").insert({
        property_id: propertyId, user_id: user.id,
        name: form.name, phone: form.phone, room: form.room,
        status: "Staying", source: "Owner Check-in",
        id_type: form.idType, id_number: form.idNum, address: form.address,
        checkin: form.checkin, checkout: form.checkout,
        nights, guest_count: form.numGuests, purpose: form.purpose,
        form_complete: true, is_test: isTest,
      }).select().single();
      if (data) onComplete({ name: form.name, room: form.room, checkin: form.checkin, checkout: form.checkout, guests: form.numGuests, idType: form.idType }, data.id);
    }
    setSaving(false);
  };

  const ro = (s: React.CSSProperties): React.CSSProperties => isOTA ? { ...s, background: "#F7F7F7", color: C.light } : s;

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      {toast && <Toast msg={toast} />}
      <div style={hdr}>
        <button style={hdrIcon} onClick={() => setScreen("dashboard")}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>{isOTA ? "Verify & Check-in" : "New Check-in"}</span>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ padding: "12px 12px 100px" }}>
        {isOTA && <div style={{ background: "#EEF4FF", border: `1px solid #C5D9FF`, borderRadius: 12, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 16 }}>ℹ️</span><span style={{ fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: FONT }}>Details pre-filled from {prefill?.source} — verify and complete</span></div>}
        <div style={fgrp}><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Guest full name" /></div>
        <div style={fgrp}><label style={lbl}>Phone Number</label><div style={{ display: "flex", gap: 8 }}><div style={{ ...inp, width: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F7F7", color: C.mid, borderRadius: 10 }}>+91</div><input style={{ ...inp, flex: 1 }} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="9XXXXXXXXX" /></div></div>
        <div style={fgrp}><label style={lbl}>ID Type</label><select style={inp} value={form.idType} onChange={e => set("idType", e.target.value)}><option>Aadhaar</option><option>Passport</option><option>Driving Licence</option></select></div>
        <div style={fgrp}><label style={lbl}>ID Number</label><input style={inp} value={form.idNum} onChange={e => set("idNum", e.target.value)} placeholder="Enter ID number" /></div>
        <div style={fgrp}><label style={lbl}>ID Photo</label><div style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#FAFAFA" }}><div style={{ fontSize: 28, marginBottom: 8 }}>📷</div><div style={{ fontWeight: 700, color: C.dark, fontSize: 13, fontFamily: FONT }}>Upload ID Photo</div><div style={{ fontSize: 12, color: C.light, marginTop: 4, fontFamily: FONT }}>Required for check-in</div></div></div>
        <div style={fgrp}><label style={lbl}>Address</label><textarea style={{ ...inp, height: 76, resize: "none" } as React.CSSProperties} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Home address" /></div>
        <div style={{ display: "flex", gap: 10, ...fgrp }}>
          <div style={{ flex: 1 }}><label style={lbl}>Check-in</label><input type="date" style={ro(inp)} value={form.checkin} readOnly={isOTA} onChange={e => !isOTA && set("checkin", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Check-out</label><input type="date" style={ro(inp)} value={form.checkout} readOnly={isOTA} onChange={e => !isOTA && set("checkout", e.target.value)} /></div>
        </div>
        <div style={fgrp}>
          <label style={lbl}>Room Number</label>
          {isOTA ? <div style={{ ...inp, background: "#F7F7F7", color: C.mid, display: "flex", alignItems: "center" }}>{form.room}</div> : <select style={inp} value={form.room} onChange={e => set("room", e.target.value)}>{ALL_ROOMS.map(r => { const state = getRoomState(r, guests); const disabled = state !== "vacant"; return <option key={r} value={r} disabled={disabled}>{state === "occupied" ? `${r} (Occupied)` : state === "arriving" ? `${r} (Arriving)` : r}</option>; })}</select>}
        </div>
        <div style={fgrp}>
          <label style={lbl}>Number of Guests</label>
          {isOTA ? <div style={{ ...inp, background: "#F7F7F7", color: C.mid, display: "flex", alignItems: "center" }}>{form.numGuests}</div> : <div style={{ display: "flex", alignItems: "center", gap: 20 }}><button onClick={() => set("numGuests", Math.max(1, form.numGuests - 1))} style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${C.border}`, fontSize: 20, cursor: "pointer", background: C.white, color: C.dark }}>−</button><span style={{ fontSize: 20, fontWeight: 700, minWidth: 24, textAlign: "center", fontFamily: FONT }}>{form.numGuests}</span><button onClick={() => set("numGuests", Math.min(10, form.numGuests + 1))} style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${C.border}`, fontSize: 20, cursor: "pointer", background: C.white, color: C.dark }}>+</button></div>}
        </div>
        <div style={fgrp}><label style={lbl}>Purpose of Visit</label><select style={inp} value={form.purpose} onChange={e => set("purpose", e.target.value)}><option>Tourism</option><option>Business</option><option>Personal</option></select></div>
        <div onClick={() => setIdVerified(v => !v)} style={{ background: idVerified ? "#E6F4EA" : "#F7F7F7", border: `1.5px solid ${shake ? C.error : idVerified ? "#A5D6A7" : C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", cursor: "pointer", transition: "all 0.2s" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${idVerified ? C.success : C.border}`, background: idVerified ? C.success : C.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, color: "#fff" }}>{idVerified ? "✓" : ""}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: shake ? C.error : C.dark, fontFamily: FONT }}>I have physically verified the guest's ID</span>
        </div>
        <button style={btn(C.accent)} onClick={submit} disabled={saving}>{saving ? "Saving..." : isOTA ? "Confirm & Complete Check-in →" : "Complete Check-in →"}</button>
      </div>
    </div>
  );
}

/* ─── CONFIRMATION ───────────────────────────────────────── */
function Confirmation({ data, setScreen }: { data: ConfirmData; setScreen: (s: Screen) => void }) {
  const nights = Math.max(1, Math.round((new Date(data.checkout).getTime() - new Date(data.checkin).getTime()) / 86400000));
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}><button style={hdrIcon} onClick={() => setScreen("dashboard")}>←</button><span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Check-in Complete</span><span style={{ width: 36 }} /></div>
      <div style={{ padding: "40px 20px 24px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#E6F4EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 36 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 6, fontFamily: FONT }}>{data.name} Checked In</div>
        <div style={{ fontSize: 13, color: C.mid, marginBottom: 28, fontFamily: FONT }}>Room {data.room} · {fmtDate(data.checkin)} – {fmtDate(data.checkout)} · {nights} Night{nights !== 1 ? "s" : ""}</div>
        <div style={{ ...card, textAlign: "left", marginBottom: 12 }}>
          <div style={secTitle}>Guest Summary</div>
          {[["ID Type", data.idType], ["Check-in Method", "Owner Check-in"], ["Guests", String(data.guests)]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #F5F5F5` }}><span style={{ fontSize: 13, color: C.mid, fontFamily: FONT }}>{k}</span><span style={{ fontWeight: 600, fontSize: 13, fontFamily: FONT }}>{v}</span></div>)}
        </div>
        <div style={{ background: "#E6F4EA", borderRadius: 14, padding: 16, marginBottom: 12, textAlign: "left" }}>
          <div style={{ color: C.success, fontWeight: 700, marginBottom: 8, fontSize: 13, fontFamily: FONT }}>Automated Actions</div>
          {["WhatsApp confirmation sent", "Registry entry saved"].map(a => <div key={a} style={{ color: C.success, fontSize: 13, marginBottom: 4, fontFamily: FONT }}>✓ {a}</div>)}
        </div>
        <div style={{ color: C.light, fontSize: 12, marginBottom: 24, fontFamily: FONT }}>Police upload: Pending</div>
        <button style={btn(C.dark, "#fff", true)} onClick={() => setScreen("dashboard")}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

/* ─── CHECKOUT ───────────────────────────────────────────── */
const DEFAULT_EXTRA: ExtraCharge[] = [
  { id: 1, name: "Water Bottle",      category: "Food & Beverage",    amount: 50  },
  { id: 2, name: "Extra Pillow",      category: "Other",              amount: 100 },
  { id: 3, name: "Late Checkout Fee", category: "Laundry & Services", amount: 500 },
];

function Checkout({ guest, setScreen, onCheckout }: { guest: Guest; setScreen: (s: Screen) => void; onCheckout: (p: CheckoutPayload) => void }) {
  const [roomRate, setRoomRate]   = useState(3200);
  const [editing, setEditing]     = useState(false);
  const [extras, setExtras]       = useState<ExtraCharge[]>(DEFAULT_EXTRA);
  const [payStatus, setPayStatus] = useState("Fully Paid");
  const [payMethod, setPayMethod] = useState("Cash");
  const nextId = useRef(10);
  const nights   = 1;
  const gstRate  = roomGSTRate(roomRate);
  const halfGST  = gstRate / 2;
  const roomBase = roomRate * nights;
  const roomCGST = +(roomBase * halfGST / 100).toFixed(2);
  const roomSGST = roomCGST;
  const addExtra    = () => setExtras(e => [...e, { id: nextId.current++, name: "", category: "Food & Beverage", amount: 0 }]);
  const updateExtra = (id: number, field: keyof ExtraCharge, val: string | number) => setExtras(e => e.map(x => x.id === id ? { ...x, [field]: val } : x));
  const removeExtra = (id: number) => setExtras(e => e.filter(x => x.id !== id));
  const extraTotals = extras.map(e => { const gst = +(e.amount * itemGSTRate(e.category) / 100).toFixed(2); return { ...e, gst, lineTotal: e.amount + gst }; });
  const grandTotal  = +(roomBase + roomCGST + roomSGST + extraTotals.reduce((s, e) => s + e.amount + e.gst, 0)).toFixed(2);
  const proceed     = () => onCheckout({ total: grandTotal, roomBase, roomGSTRate: gstRate, roomCGST, roomSGST, nights, extraCharges: extras });
  const tog = (active: boolean): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 24, border: `1.5px solid ${active ? C.dark : C.border}`, background: active ? C.dark : "transparent", color: active ? "#fff" : C.mid, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT });

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      <div style={hdr}><button style={hdrIcon} onClick={() => setScreen("dashboard")}>←</button><div style={{ textAlign: "center" }}><div style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Check-out</div><div style={{ fontSize: 12, color: C.mid }}>{guest.name}</div></div><span style={{ width: 36 }} /></div>
      <div style={{ padding: "12px 12px 0" }}>
        <div style={card}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><Avatar name={guest.name} size={40} /><div><div style={{ fontWeight: 700, fontSize: 15, color: C.dark, fontFamily: FONT }}>{guest.name}</div><div style={{ display: "flex", gap: 6, marginTop: 4 }}><span style={{ ...pill("#EEF4FF", C.blue), fontSize: 11 }}>Room {guest.room}</span><OTATag source={guest.source} /></div></div></div></div>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Charges</div><button onClick={() => setEditing(e => !e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.mid, fontWeight: 600, fontFamily: FONT }}>{editing ? "Done" : "✏️ Edit Rate"}</button></div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}><span style={{ fontSize: 14, color: C.dark, fontWeight: 500, fontFamily: FONT }}>Room ({nights} night)</span>{editing ? <input type="number" value={roomRate} onChange={e => setRoomRate(+e.target.value || 0)} style={{ ...inp, width: 90, textAlign: "right", padding: "8px 10px" }} /> : <span style={{ fontWeight: 700, fontFamily: FONT }}>{fmt(roomBase)}</span>}</div>
            {gstRate > 0 && <div style={{ paddingLeft: 12 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>CGST {halfGST}%</span><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>{fmt(roomCGST)}</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>SGST {halfGST}%</span><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>{fmt(roomSGST)}</span></div></div>}
          </div>
          <div style={{ borderTop: `1px solid #F5F5F5`, paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.light, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 10, fontFamily: FONT }}>Additional</div>
            {extraTotals.map(e => <div key={e.id} style={{ marginBottom: 10 }}><div style={{ display: "flex", gap: 6, marginBottom: 3 }}><input style={{ ...inp, flex: 2, fontSize: 12, padding: "8px 10px" }} value={e.name} onChange={ev => updateExtra(e.id, "name", ev.target.value)} placeholder="Item" /><select style={{ ...inp, flex: 2, fontSize: 11, padding: "8px 8px" }} value={e.category} onChange={ev => updateExtra(e.id, "category", ev.target.value as ExtraCharge["category"])}><option>Food & Beverage</option><option>Laundry & Services</option><option>Other</option></select><input type="number" style={{ ...inp, width: 66, fontSize: 12, padding: "8px 8px", textAlign: "right" }} value={e.amount} onChange={ev => updateExtra(e.id, "amount", +ev.target.value || 0)} /><button onClick={() => removeExtra(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.light, fontSize: 18, padding: "0 2px", flexShrink: 0 }}>×</button></div>{e.amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 10 }}><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>GST {itemGSTRate(e.category)}%</span><span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>{fmt(e.gst)}</span></div>}</div>)}
            <button onClick={addExtra} style={{ background: "none", border: "none", cursor: "pointer", color: C.mid, fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT }}>+ Add Item</button>
          </div>
          <div style={{ borderTop: `1.5px solid #F0F0F0`, paddingTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 15, fontWeight: 700, color: C.dark, fontFamily: FONT }}>Total</span><span style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: FONT }}>{fmt(grandTotal)}</span></div></div>
        </div>
        <div style={card}>
          <div style={secTitle}>Payment Status</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>{["Fully Paid", "Partial", "Pending"].map(s => <button key={s} onClick={() => setPayStatus(s)} style={tog(payStatus === s)}>{s}</button>)}</div>
          <div style={secTitle}>Payment Method</div>
          <div style={{ display: "flex", gap: 8 }}>{["Cash", "UPI", "Card"].map(m => <button key={m} onClick={() => setPayMethod(m)} style={tog(payMethod === m)}>{m}</button>)}</div>
          {payMethod === "UPI" && <div style={{ marginTop: 16, textAlign: "center" }}><div style={{ width: 110, height: 110, background: "#F5F5F5", margin: "0 auto 8px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.light, border: `1px solid ${C.border}` }}>QR Code</div><div style={{ fontWeight: 700, color: C.dark, fontSize: 14, fontFamily: FONT }}>heritagegrand@upi</div></div>}
        </div>
        <button style={btn(C.accent)} onClick={proceed}>Proceed to Check-out →</button>
      </div>
    </div>
  );
}

/* ─── INVOICE MODAL ──────────────────────────────────────── */
function InvoiceModal({ guest, payload, onClose }: { guest: Guest; payload: CheckoutPayload; onClose: () => void }) {
  const extraTotals = payload.extraCharges.map(e => { const gstPct = itemGSTRate(e.category); const gst = +(e.amount * gstPct / 100).toFixed(2); return { ...e, gstPct, gst, lineTotal: e.amount + gst }; });
  const subtotal   = payload.roomBase + extraTotals.reduce((s, e) => s + e.amount, 0);
  const totalGST   = payload.roomCGST + payload.roomSGST + extraTotals.reduce((s, e) => s + e.gst, 0);
  const grandTotal = +(subtotal + totalGST).toFixed(2);
  const catLabel   = (cat: ExtraCharge["category"]) => cat === "Food & Beverage" ? "F&B" : cat === "Laundry & Services" ? "Svc" : "Other";
  const rows = [{ item: `Room (${payload.nights}n)`, cat: "Accomm.", amt: payload.roomBase, gstPct: payload.roomGSTRate, gst: payload.roomCGST + payload.roomSGST, total: payload.roomBase + payload.roomCGST + payload.roomSGST }, ...extraTotals.map(e => ({ item: e.name, cat: catLabel(e.category), amt: e.amount, gstPct: e.gstPct, gst: e.gst, total: e.lineTotal }))];
  return (
    <div style={{ position: "fixed", inset: 0, background: C.white, zIndex: 500, overflowY: "auto", maxWidth: "100%", margin: "0 auto", fontFamily: FONT }}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}><button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, cursor: "pointer", color: C.mid }}>×</button></div>
        <div style={{ textAlign: "center", marginBottom: 16 }}><div style={{ fontSize: 18, fontWeight: 700, color: C.dark, letterSpacing: 1, fontFamily: FONT }}>TAX INVOICE</div><div style={{ height: 2, background: "#F0F0F0", marginTop: 10, borderRadius: 1 }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
          <div style={{ fontSize: 12, lineHeight: 1.8, fontFamily: FONT }}><div style={{ fontWeight: 700, fontSize: 13 }}>Heritage Grand</div><div style={{ color: C.mid }}>42, Civil Lines, Jaipur 302006</div><div style={{ color: C.mid }}>GSTIN: 08AABCH1234F1Z5</div><div style={{ color: C.mid }}>+91 98100-00000</div></div>
          <div style={{ fontSize: 12, lineHeight: 1.8, textAlign: "right", fontFamily: FONT }}><div><strong>INV-2026-0047</strong></div><div style={{ color: C.mid }}>27 Mar 2026</div><div style={{ color: C.mid }}>In: 27 Mar | Out: 28 Mar</div></div>
        </div>
        <div style={{ ...card, padding: 14, marginBottom: 14 }}><div style={secTitle}>Guest</div><div style={{ fontSize: 13, fontFamily: FONT }}><strong>{guest.name}</strong> · Aadhaar XXXX-4821 · Room {guest.room} · {payload.nights}N</div></div>
        <div style={{ marginBottom: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: FONT }}>
            <thead><tr style={{ background: C.dark, color: "#fff" }}>{["Item", "Cat", "Amt", "GST%", "GST", "Total"].map(h => <th key={h} style={{ padding: "9px 6px", textAlign: (h === "Item" || h === "Cat" ? "left" : "right") as "left" | "right", fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? C.white : "#FAFAFA" }}><td style={{ padding: "8px 6px" }}>{r.item}</td><td style={{ padding: "8px 6px", color: C.mid }}>{r.cat}</td><td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{fmt(r.amt)}</td><td style={{ padding: "8px 6px", textAlign: "right", color: C.mid }}>{r.gstPct}%</td><td style={{ padding: "8px 6px", textAlign: "right", color: C.mid }}>{fmt(r.gst)}</td><td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>{fmt(r.total)}</td></tr>)}</tbody>
          </table>
        </div>
        <div style={{ ...card, padding: 14, marginBottom: 16 }}>
          {[["Subtotal", fmt(subtotal)], ["Total GST", fmt(totalGST)]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, color: C.mid, fontFamily: FONT }}>{k}</span><span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT }}>{v}</span></div>)}
          <div style={{ height: 1, background: "#F0F0F0", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: 15, fontFamily: FONT }}>Grand Total</span><span style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: FONT }}>{fmt(grandTotal)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: C.mid, fontFamily: FONT }}>Balance Due</span><span style={{ fontSize: 13, fontWeight: 700, color: C.success, fontFamily: FONT }}>₹0</span></div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 80, height: 80, background: C.dark, margin: "0 auto 8px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 60, height: 60, background: C.white, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2, padding: 4, borderRadius: 2 }}>{Array.from({ length: 25 }).map((_, i) => <div key={i} style={{ background: [0,1,5,6,9,11,13,15,18,20,23,24].includes(i) ? C.dark : C.white, borderRadius: 1 }} />)}</div></div>
          <div style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>Scan to verify · Computer generated invoice</div>
          <div style={{ fontSize: 13, color: C.mid, marginTop: 6, fontWeight: 500, fontFamily: FONT }}>Thank you for staying at Heritage Grand</div>
        </div>
        <button style={btn(C.dark)} onClick={onClose}>✕ Close Invoice</button>
      </div>
    </div>
  );
}

/* ─── CHECKOUT SUMMARY ───────────────────────────────────── */
function CheckoutSummary({ guest, payload, setScreen }: { guest: Guest; payload: CheckoutPayload; setScreen: (s: Screen) => void }) {
  const [showInvoice, setShowInvoice] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT }}>
      {showInvoice && <InvoiceModal guest={guest} payload={payload} onClose={() => setShowInvoice(false)} />}
      <div style={hdr}><button style={hdrIcon} onClick={() => setScreen("dashboard")}>←</button><span style={{ fontSize: 17, fontWeight: 700, color: C.dark }}>Check-out Complete</span><span style={{ width: 36 }} /></div>
      <div style={{ padding: "40px 20px 24px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#E6F4EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 36 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 6, fontFamily: FONT }}>{guest.name} Checked Out</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28, flexWrap: "wrap" }}>
          <span style={pill("#EEF4FF", C.blue)}>Total {fmt(payload.total)}</span>
          <span style={pill("#E6F4EA", C.success)}>Paid {fmt(payload.total)}</span>
          <span style={pill("#E6F4EA", C.success)}>Balance ₹0</span>
        </div>
        <div style={{ ...card, textAlign: "left", marginBottom: 12 }}>
          <div style={secTitle}>Stay Summary</div>
          {[["Room", guest.room], ["Source", guest.source], ["Duration", `${payload.nights} Night${payload.nights !== 1 ? "s" : ""}`]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #F5F5F5` }}><span style={{ fontSize: 13, color: C.mid, fontFamily: FONT }}>{k}</span><span style={{ fontWeight: 700, fontSize: 13, fontFamily: FONT }}>{v}</span></div>)}
        </div>
        <div style={{ background: "#E6F4EA", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "left" }}>
          <div style={{ color: C.success, fontWeight: 700, marginBottom: 8, fontSize: 13, fontFamily: FONT }}>Automated Actions</div>
          {["WhatsApp receipt sent", "SMS sent", "GST Invoice generated", "Invoice sent to guest"].map(a => <div key={a} style={{ color: C.success, fontSize: 13, marginBottom: 4, fontFamily: FONT }}>✓ {a}</div>)}
        </div>
        <button style={{ ...btn(C.dark, "#fff", true), marginBottom: 12 }} onClick={() => setShowInvoice(true)}>🧾 View Invoice</button>
        <button style={{ ...btn(C.accent), marginBottom: 12 }}>⭐ Request Google Review</button>
        <button style={btn(C.dark, "#fff", true)} onClick={() => setScreen("dashboard")}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

/* ─── LOADING SCREEN ─────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "#FFE4E8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 16 }}>🏨</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.dark, marginBottom: 8 }}>MyStay</div>
      <div style={{ fontSize: 14, color: C.mid }}>Loading...</div>
    </div>
  );
}

/* ─── APP ROOT ───────────────────────────────────────────── */
export default function App() {
  const [user,            setUser]            = useState<User | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [screen,          setScreen]          = useState<Screen>("dashboard");
  const [guests,          setGuests]          = useState<Guest[]>([]);
  const [activeGuest,     setActiveGuest]     = useState<Guest | null>(null);
  const [prefill,         setPrefill]         = useState<CheckInPrefill>(null);
  const [confirmData,     setConfirmData]     = useState<ConfirmData | null>(null);
  const [checkoutPayload, setCheckoutPayload] = useState<CheckoutPayload | null>(null);
  const [costs,           setCosts]           = useState<CostItem[]>([]);
  const [dailyExpenses,   setDailyExpenses]   = useState<DailyExpense[]>([]);
  const [hotelName,       setHotelName]       = useState("My Hotel");
  const [propertyId,      setPropertyId]      = useState("");
  const [,     setIsFirstTime]     = useState(false);
  const [isTest,          setIsTest]          = useState(false);

  /* ── Auth listener ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ── Load data when user logs in ── */
  useEffect(() => {
    if (!user) return;
    const test = user.email === TEST_EMAIL;
    setIsTest(test);
    loadUserData(user, test);
  }, [user]);

  const loadUserData = async (u: User, test: boolean) => {
    // Load property
    const { data: props } = await supabase.from("properties").select("*").eq("user_id", u.id).eq("is_test", test);
    if (!props || props.length === 0) { setIsFirstTime(true); setScreen("onboarding"); return; }

    const prop = props[0];
    setPropertyId(prop.id);
    setHotelName(prop.name);

    // Load guests
    const { data: guestData } = await supabase.from("guests").select("*").eq("user_id", u.id).eq("is_test", test).order("created_at", { ascending: false });
    if (guestData) {
      setGuests(guestData.map(g => ({
        id: g.id, name: g.name, room: g.room,
        status: g.status as Status, source: g.source,
        phone: g.phone, checkin: g.checkin, checkout: g.checkout,
        nights: g.nights, totalCharged: g.total_charged,
        guestCount: g.guest_count, formComplete: g.form_complete,
      })));
    }

    // Load costs
    const { data: costData } = await supabase.from("monthly_costs").select("*").eq("user_id", u.id).eq("is_test", test);
    if (costData) setCosts(costData.map(c => ({ id: c.id, name: c.name, amount: c.amount })));

    // Load daily expenses
    const { data: expData } = await supabase.from("daily_expenses").select("*").eq("user_id", u.id).eq("is_test", test).order("date", { ascending: false });
    if (expData) setDailyExpenses(expData.map(e => ({ id: e.id, name: e.name, amount: e.amount, date: e.date })));

    setScreen("dashboard");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setGuests([]); setCosts([]); setDailyExpenses([]);
    setScreen("dashboard"); setPropertyId(""); setHotelName("My Hotel");
  };

  const handleOnboardingComplete = async (newCosts: CostItem[]) => {
    setCosts(newCosts);
    setIsFirstTime(false);
    if (user) await loadUserData(user, isTest);
    setScreen("dashboard");
  };

  const handleCheckinComplete = async (data: ConfirmData, guestId?: string) => {
    if (guestId) {
      setGuests(prev => prev.map(g => g.id === guestId ? { ...g, status: "Staying" as Status } : g));
    } else {
      const nights = Math.max(1, Math.round((new Date(data.checkout).getTime() - new Date(data.checkin).getTime()) / 86400000));
      const newGuest: Guest = {
        id: Date.now().toString(), name: data.name, room: data.room,
        status: "Staying", source: "Owner Check-in", formComplete: true,
        checkin: data.checkin, checkout: data.checkout, nights, guestCount: data.guests,
      };
      setGuests(prev => [newGuest, ...prev]);
    }
    setConfirmData(data);
    setScreen("confirmation");
  };

  const handleCheckout = async (payload: CheckoutPayload) => {
    if (activeGuest) {
      await supabase.from("guests").update({ status: "Checked Out", total_charged: payload.total, nights: payload.nights }).eq("id", activeGuest.id);
      setGuests(prev => prev.map(g => g.id === activeGuest.id ? { ...g, status: "Checked Out" as Status, totalCharged: payload.total, nights: payload.nights } : g));
    }
    setCheckoutPayload(payload);
    setScreen("checkoutSummary");
  };

  if (loading) return <LoadingScreen />;
  if (!user)   return <LoginScreen />;

  if (screen === "onboarding" && user) {
    return <OnboardingScreen user={user} isTest={isTest} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={{ fontFamily: FONT, width: "100%", margin: 0, minHeight: "100vh", background: C.bg, position: "relative" }}>
      {screen === "dashboard"       && <Dashboard guests={guests} setScreen={setScreen} setActiveGuest={setActiveGuest} setPrefill={setPrefill} hotelName={hotelName} isTest={isTest} />}
      {screen === "guests"          && <GuestsScreen guests={guests} setScreen={setScreen} setActiveGuest={setActiveGuest} />}
      {screen === "insights"        && <InsightsScreen costs={costs} dailyExpenses={dailyExpenses} setScreen={setScreen} />}
      {screen === "menu"            && <MenuScreen setScreen={setScreen} user={user} hotelName={hotelName} onSignOut={handleSignOut} />}
      {screen === "costProfile"     && propertyId && <CostProfilePage costs={costs} setCosts={setCosts} user={user} propertyId={propertyId} isTest={isTest} setScreen={setScreen} />}
      {screen === "dailyExpenses"   && propertyId && <DailyExpensesPage dailyExpenses={dailyExpenses} setDailyExpenses={setDailyExpenses} user={user} propertyId={propertyId} isTest={isTest} setScreen={setScreen} />}
      {screen === "checkin"         && user && propertyId && <CheckInForm setScreen={setScreen} prefill={prefill} guests={guests} user={user} propertyId={propertyId} isTest={isTest} onComplete={handleCheckinComplete} />}
      {screen === "confirmation"    && confirmData && <Confirmation data={confirmData} setScreen={setScreen} />}
      {screen === "checkout"        && activeGuest && <Checkout guest={activeGuest} setScreen={setScreen} onCheckout={handleCheckout} />}
      {screen === "checkoutSummary" && activeGuest && checkoutPayload && <CheckoutSummary guest={activeGuest} payload={checkoutPayload} setScreen={setScreen} />}
    </div>
  );
}
