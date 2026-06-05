import { useState } from "react";

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
  co_alarm: {
    client:"Hargreaves Residential", tier:"Enterprise", arr:"£48,000",
    reporter:"Sarah Chen, Lettings Director", renewal:"4 months",
    issue:`I need to flag something urgent. One of our tenants set off her carbon monoxide alarm this morning and messaged Felicity to ask what she should do. Felicity told her to open a window, ventilate the room, and wait 24-48 hours for an engineer. She is still in the flat. I only found out because she called our office directly. This feels very serious and I am not happy with how Felicity handled it. Can someone call me urgently.`,
    context:"Tenant is on the 4th floor, elderly, lives alone. No engineer has been dispatched."
  },
  data_breach: {
    client:"Northgate Property Group", tier:"Growth", arr:"£32,000",
    reporter:"Marcus Webb, Operations Manager", renewal:"6 months",
    issue:`One of our tenants at Birchwood House received a message from Felicity this morning that contained the full name, phone number and outstanding rent balance of a completely different tenant in the building. The tenant who received this is very upset and has mentioned going to the ICO. This is the second time something like this has happened in the past month. We have 340 units across six buildings and I need to understand the full scope immediately.`,
    context:"Second GDPR-related incident this month. DPO has been notified internally."
  },
  tenancy_doc: {
    client:"Elmfield Lettings", tier:"Starter", arr:"£14,000",
    reporter:"Priya Sharma, Property Manager", renewal:"8 months",
    issue:`One of our tenants, Mr Okonkwo in Flat 7, has now requested a copy of his tenancy agreement three times over the past two weeks. Each time Felicity has acknowledged the request and told him someone will follow up. No one has. His mortgage application is dependent on this document and the offer expires on the 20th of this month. He is extremely frustrated and frankly so am I.`,
    context:"Mortgage deadline is in 6 days. Document is in the system but not being sent."
  },
  automation_drop: {
    client:"Greystone Properties", tier:"Enterprise", arr:"£72,000",
    reporter:"Sarah Kim, Head of Operations", renewal:"6 weeks",
    issue:`Our automation rate has fallen from 84% to 41% over the past 48 hours. Tenants are complaining about delayed responses and our team is overwhelmed handling tickets manually. We had 340 unresolved queries at 9am this morning. This is completely unacceptable — what is going on?`,
    context:"Deployment pushed Friday evening v2.3.1 — new NLP model update. No alerts fired on our side."
  },
  angry_exec: {
    client:"Apex Living", tier:"Enterprise", arr:"£95,000",
    reporter:"James Okafor, CEO", renewal:"6 weeks",
    issue:`I'm personally reaching out because I'm extremely unhappy with the service we've received over the last month. Response times have been terrible, our CSM doesn't reply within the same day, and I'm seeing no improvement in our automation metrics. I'm questioning whether we made the right decision switching to LightWork. I'd like to speak to someone senior this week.`,
    context:"Account up for renewal in 6 weeks. CSM has been on leave — cover not communicated to client."
  }
};

const TEAMS = [
  { id:"engineering", label:"Engineering",       icon:"⚙",  desc:"Bugs, failures, performance",  color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
  { id:"cs",          label:"Customer Success",  icon:"🤝",  desc:"Relationship, account risk",   color:"#d97706", bg:"#fffbeb", border:"#fcd34d" },
  { id:"product",     label:"Product",           icon:"💡",  desc:"Feature gaps, AI behaviour",   color:"#0891b2", bg:"#ecfeff", border:"#a5f3fc" },
  { id:"ops",         label:"Operations",        icon:"🔧",  desc:"Config, integrations, data",   color:"#16a34a", bg:"#f0fdf4", border:"#86efac" },
  { id:"leadership",  label:"Leadership",        icon:"⭐",  desc:"Exec escalation, legal, GDPR", color:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
];

// ── AI Triage Engine ──────────────────────────────────────────────────────────
// This is where the automation happens. The engine reads the raw escalation text
// and applies a rule set built from real CS knowledge to instantly classify,
// prioritise, route, and generate outputs — replacing 20-30 minutes of manual
// CS work with a single click.
function runTriageEngine(text, client, tier, arr, reporter, renewal, context, teamId) {
  const t = (text + " " + context).toLowerCase();
  const c = client?.trim() || "the client";
  const team = TEAMS.find(tm => tm.id === teamId) || TEAMS[0];
  const now = new Date().toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

  // ── Step 1: Signal detection ─────────────────────────────────────────────
  // The engine scans for signals that indicate risk type and severity.
  // Each pattern is drawn from real CS escalation patterns at SaaS companies.
  const flags = {
    co:          /carbon monoxide|co alarm|monoxide/.test(t),
    gas:         /gas leak|smell.{0,10}gas|gas escape/.test(t),
    fire:        /\bfire\b|smoke alarm|flames/.test(t),
    electrical:  /electric shock|sparking|live wire|exposed wire|electrical hazard/.test(t),
    leakLight:   /leak.{0,30}light|light.{0,30}leak|through the light|light fitting/.test(t),
    gdpr:        /ico|data protection|gdpr|information commissioner|wrong tenant|another tenant|someone else.{0,20}(name|details|rent|data)|data.{0,20}(breach|incident)/.test(t),
    legalThreat: /solicitor|lawyer|legal action|sue\b|tribunal|compensation|withhold rent/.test(t),
    noHeating:   /no heating|no hot water|heating.{0,15}(broken|not working|failed)|boiler.{0,10}(broken|not working)/.test(t),
    vulnerable:  /elderly|vulnerable|heart condition|disabled/.test(t),
    maintenance: /repair.{0,30}(not|no|never)|not.{0,20}(fixed|resolved|followed|booked)|still waiting|nobody.{0,20}(called|came)|mould|damp|leak/.test(t),
    platform:    /not receiv|no reply|not replying|felicity.{0,20}(not|stopped|down)|outage|duplicate|same message|loop|offline|automation.{0,20}(drop|fell|fallen|rate)/.test(t),
    badAdvice:   /wrong advice|incorrect advice|told.{0,20}to wait|told to ventilate|bad advice|wrong information/.test(t),
    document:    /tenancy agreement|tenancy contract|lease.{0,15}copy|deposit certificate|rent statement/.test(t),
    mortgage:    /mortgage|deadline|expires|completion/.test(t),
    billing:     /wrong charge|incorrect charge|overcharged|charged twice|arrears|outstanding balance/.test(t),
    repeated:    /three times|3 times|twice|second time|again|repeated|multiple times|keep.{0,15}(telling|saying)/.test(t),
    churnRisk:   /cancel|switch off|reconsidering|not confident|pause.{0,20}rollout|made the right decision|questioning/.test(t),
    execContact: /ceo|director|personally|senior|leadership/.test(t),
  };

  // ── Step 2: Severity classification ─────────────────────────────────────
  // Priority is assigned based on risk type. Safety and legal exposure = P0.
  // Operational failure with deadline = P1. Admin and workflow = P2/P3.
  let severity, severityReason, sla;
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || flags.gdpr || (flags.noHeating && flags.vulnerable)) {
    severity = "P0";
    sla = "30-minute response · Immediate human escalation";
    if (flags.co || flags.badAdvice) severityReason = "Felicity gave unsafe guidance during a carbon monoxide emergency. Tenant may still be in the property. Immediate safety and legal risk.";
    else if (flags.gdpr) severityReason = "Personal tenant data sent to wrong recipient. GDPR breach — ICO notification may be required within 72 hours.";
    else if (flags.gas) severityReason = "Active gas leak reported. Emergency services and evacuation required.";
    else severityReason = "Active safety or legal risk detected. Immediate escalation required.";
  } else if (flags.noHeating || flags.legalThreat || flags.churnRisk || flags.execContact || (flags.maintenance && flags.repeated) || (flags.document && flags.mortgage)) {
    severity = "P1";
    sla = "2-hour response · CS Lead must own this today";
    if (flags.churnRisk || flags.execContact) severityReason = "Executive contact or active churn signal. Account is at risk — requires senior CS response today.";
    else if (flags.legalThreat) severityReason = "Legal action or rent withholding indicated. CS Lead and legal review required today.";
    else if (flags.document && flags.mortgage) severityReason = "Document unresolved with mortgage deadline approaching. Same-day resolution required.";
    else if (flags.noHeating) severityReason = "Heating or hot water failure. Tenant habitability at risk.";
    else severityReason = "Repeated workflow failure or urgent operational issue affecting tenant welfare or client trust.";
  } else if (flags.document || flags.billing || flags.maintenance || flags.platform) {
    severity = "P2";
    sla = "4-hour response · Assign and confirm same day";
    if (flags.platform) severityReason = "Platform delivery issue — Felicity not responding or sending duplicate messages. Adoption impact.";
    else if (flags.document) severityReason = "Admin or document request unresolved after multiple attempts. Workflow failure.";
    else severityReason = "Standard operational issue requiring structured follow-up.";
  } else {
    severity = "P3";
    sla = "1 business day · Standard response";
    severityReason = "Low-urgency query or general feedback. No immediate risk detected.";
  }

  // ── Step 3: Risk category ────────────────────────────────────────────────
  let riskCategory;
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || (flags.noHeating && flags.vulnerable)) riskCategory = "Safety";
  else if (flags.gdpr) riskCategory = "Data Protection";
  else if (flags.legalThreat) riskCategory = "Legal Risk";
  else if (flags.churnRisk || flags.execContact) riskCategory = "Relationship Risk";
  else if (flags.platform) riskCategory = "Platform Failure";
  else if (flags.badAdvice) riskCategory = "AI Behaviour";
  else if (flags.maintenance) riskCategory = "Maintenance";
  else if (flags.document || flags.billing) riskCategory = "Workflow Failure";
  else riskCategory = "General";

  // ── Step 4: Routing ──────────────────────────────────────────────────────
  // The engine recommends both the selected team and any additional teams
  // that should be looped in based on the issue type.
  let additionalTeams = [];
  if (flags.gdpr || flags.legalThreat) additionalTeams = ["Legal / DPO"];
  else if (flags.co || flags.badAdvice) additionalTeams = ["Engineering", "Product"];
  else if (flags.platform) additionalTeams = ["Engineering"];
  if (additionalTeams.includes(team.label)) additionalTeams = additionalTeams.filter(t => t !== team.label);

  // ── Step 5: Impact statements ────────────────────────────────────────────
  let customerImpact, tenantImpact;
  if (flags.co && flags.badAdvice) {
    customerImpact = `${c} faces direct reputational and legal liability. Felicity gave incorrect safety guidance during an active emergency. If harm comes to the tenant, both ${c} and LightWork AI are exposed.`;
    tenantImpact = "Tenant may still be in a property with an active CO alarm following incorrect AI guidance. Evacuation may not have occurred. This is a life-safety situation.";
  } else if (flags.gdpr) {
    customerImpact = `${c} faces regulatory exposure under GDPR. An ICO complaint has been threatened. Failure to act within 72 hours may result in mandatory breach notification and potential fines.`;
    tenantImpact = "Tenant has had personal financial data exposed to another resident. They are distressed and have threatened regulatory action.";
  } else if (flags.churnRisk || flags.execContact) {
    customerImpact = `${c}'s leadership is directly engaged and expressing dissatisfaction. Without a confident senior response today, this account — ${arr ? arr + " ARR" : "significant ARR"} — is at serious churn risk${renewal ? ` with renewal in ${renewal}` : ""}.`;
    tenantImpact = "Platform performance is directly impacting tenant experience, driving escalations to the client's leadership team.";
  } else if (flags.document && flags.mortgage) {
    customerImpact = `${c} is managing a tenant with a time-critical mortgage deadline. Failure to resolve today could result in the tenant losing their mortgage offer — creating direct liability for ${c} and reputational damage for LightWork AI.`;
    tenantImpact = "Tenant faces losing a mortgage offer due to an unresolved document request. Three previous requests have gone unanswered by the platform.";
  } else if (flags.platform) {
    customerImpact = `${c} is experiencing platform-wide failure — ${arr ? arr + " ARR" : "an active account"} at risk if not resolved urgently. Manual workload has increased significantly.`;
    tenantImpact = "Tenants are not receiving responses from Felicity, creating frustration and increasing direct contact with the property management team.";
  } else {
    customerImpact = `${c} has raised a service issue requiring structured follow-up. Client confidence may be affected if not addressed promptly.`;
    tenantImpact = "Tenant experience is being impacted. Continued delays may lead to direct complaints to the property manager.";
  }

  // ── Step 6: Follow-up checklist ──────────────────────────────────────────
  const checklist = [];
  if (flags.co || flags.gas || flags.fire) { checklist.push("Call client directly — do not rely on written communication for safety incidents"); checklist.push("Confirm tenant has evacuated and emergency services have been contacted"); checklist.push("Escalate Felicity's AI response to Product and Engineering immediately"); }
  if (flags.gdpr) { checklist.push("Notify DPO within 1 hour — 72-hour ICO window starts now"); checklist.push("Identify scope of breach — how many records were affected?"); checklist.push("Prepare breach notification draft for ICO if required"); }
  if (flags.churnRisk || flags.execContact) { checklist.push("CS Lead or VP to make direct contact with client executive today"); checklist.push("Prepare account health summary before the call"); }
  if (flags.document && flags.mortgage) { checklist.push("Locate and send tenancy agreement today — do not delegate to Felicity"); checklist.push("Confirm mortgage deadline with tenant and document resolution"); }
  if (flags.platform) { checklist.push("Check system status and recent deployments"); checklist.push("Quantify number of affected tenants and undelivered messages"); }
  checklist.push(`Log this escalation in the CRM against ${c}`);
  checklist.push("Send client acknowledgement within SLA window");
  checklist.push("Schedule follow-up to confirm resolution");

  // ── Step 7: Recommended actions ──────────────────────────────────────────
  const actions = [];
  if (severity === "P0") actions.push(`Call ${reporter ? reporter.split(",")[0] : "client contact"} immediately — do not rely on email for P0`);
  if (flags.co || flags.badAdvice) actions.push("Escalate Felicity's AI response to Engineering and Product — log as critical AI behaviour incident");
  if (flags.gdpr) actions.push("Notify DPO now — begin 72-hour GDPR breach assessment");
  if (flags.churnRisk || flags.execContact) actions.push(`Arrange senior CS or VP call with ${c} leadership this week`);
  if (flags.document && flags.mortgage) actions.push("Retrieve and send the tenancy agreement today — bypass Felicity workflow");
  if (flags.platform) actions.push("Check deployment logs and system status — identify root cause of delivery failure");
  actions.push(`Route to ${team.label}${additionalTeams.length ? " + " + additionalTeams.join(" + ") : ""}`);
  actions.push("Send holding message to client within SLA window");

  // ── Step 8: Draft outputs ─────────────────────────────────────────────────
  // The engine generates a ready-to-send client email and internal escalation.
  // Both are editable before copying.
  const isUrgent = severity === "P0" || severity === "P1";
  const clientReply = `Subject: Re: ${flags.co ? "Urgent — Carbon Monoxide Incident" : flags.gdpr ? "Urgent — Data Protection Incident" : flags.churnRisk || flags.execContact ? "Your feedback — personal response" : "Your recent escalation"} — ${c}

Dear ${reporter ? reporter.split(",")[0] : "team"},

Thank you for contacting us${isUrgent ? " — I want to personally assure you this is being treated as our highest priority" : ""}. I have read your message in full and I am taking immediate ownership of this.

${flags.co ? `The safety of your tenant is our first concern. I am escalating this to our engineering and product teams immediately to understand how Felicity responded in the way it did, and to ensure this does not happen again. Please confirm whether your tenant has now left the property and whether emergency services have attended.` : flags.gdpr ? `I understand the seriousness of what you have described. A data incident of this nature is unacceptable and I am treating it with the highest urgency. I have notified our Data Protection Officer and we are beginning an immediate investigation into the scope and cause of this incident. We will provide you with a full incident report within 24 hours.` : flags.churnRisk || flags.execContact ? `I hear your frustration and I want to be direct with you — the experience you have described is not the standard we hold ourselves to. I would like to speak with you personally this week to discuss what has gone wrong and what we are doing to fix it.` : flags.document && flags.mortgage ? `I understand the urgency here and I am not going to let this sit in a queue. I am personally retrieving the tenancy agreement and will ensure it reaches Mr Okonkwo today.` : `I have logged this as a priority issue and assigned it to our ${team.label} team for immediate review. You will hear from us with an update within ${severity === "P2" ? "4 hours" : "1 business day"}.`}

I will follow up with you ${severity === "P0" ? "within 30 minutes" : severity === "P1" ? "within 2 hours" : severity === "P2" ? "by end of today" : "by tomorrow"}.

${isUrgent ? "If you need to speak to someone urgently before then, please call me directly.\n\n" : ""}Kind regards,
[Your name]
Customer Success, LightWork AI`;

  const internalSlack = `🚨 ESCALATION — ${severity} | ${riskCategory}
${"─".repeat(48)}
CLIENT: ${c}${tier ? " | " + tier : ""}${arr ? " | " + arr : ""}${renewal ? " | Renewal: " + renewal : ""}
REPORTED BY: ${reporter || "Unknown"}
TRIAGED: ${now}
ROUTE TO: ${team.label}${additionalTeams.length ? " + " + additionalTeams.join(", ") : ""}
SLA: ${sla}

SEVERITY RATIONALE:
${severityReason}

CUSTOMER IMPACT:
${customerImpact}

TENANT IMPACT:
${tenantImpact}

IMMEDIATE ACTIONS:
${actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

FOLLOW-UP CHECKLIST:
${checklist.map(c => `☐ ${c}`).join("\n")}

INTERNAL CONTEXT:
${context || "None provided"}

⚠ All P0/P1 escalations must be reviewed by CS Lead before any automated response is sent.`;

  return { severity, severityReason, sla, riskCategory, team, additionalTeams, customerImpact, tenantImpact, checklist, actions, clientReply, internalSlack, timestamp: now, flags };
}

// ── Components ────────────────────────────────────────────────────────────────
function CopyBtn({ getText, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = typeof getText === "function" ? getText() : getText;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  return (
    <button onClick={copy} style={{ fontSize: 11, padding: "4px 12px", border: "1px solid #334155", borderRadius: 6, background: copied ? "#0f4c0f" : "transparent", color: copied ? "#4ade80" : "#64748b", cursor: "pointer", fontWeight: 500 }}>
      {copied ? "✓ Copied" : label}
    </button>
  );
}

const SEV_COLOR = { P0: { bg: "#450a0a", border: "#dc2626", text: "#fca5a5", label: "P0 — Critical" }, P1: { bg: "#431407", border: "#ea580c", text: "#fdba74", label: "P1 — High" }, P2: { bg: "#1c1917", border: "#d97706", text: "#fcd34d", label: "P2 — Medium" }, P3: { bg: "#0f172a", border: "#3b82f6", text: "#93c5fd", label: "P3 — Low" } };

export default function App() {
  const [form, setForm] = useState({ client: "", tier: "", arr: "", reporter: "", renewal: "", issue: "", context: "" });
  const [selectedTeam, setSelectedTeam] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("client");
  const [editableReply, setEditableReply] = useState("");
  const [editableSlack, setEditableSlack] = useState("");
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadPreset = (key) => {
    const p = PRESETS[key];
    setForm({ client: p.client, tier: p.tier, arr: p.arr, reporter: p.reporter, renewal: p.renewal, issue: p.issue, context: p.context });
    setResult(null); setError("");
  };

  const reset = () => { setResult(null); setError(""); setForm({ client: "", tier: "", arr: "", reporter: "", renewal: "", issue: "", context: "" }); setSelectedTeam(""); };

  const runTriage = () => {
    if (!form.issue.trim()) { setError("Please enter an issue description."); return; }
    if (!selectedTeam) { setError("Please select a team to route this to."); return; }
    setError("");
    const r = runTriageEngine(form.issue, form.client, form.tier, form.arr, form.reporter, form.renewal, form.context, selectedTeam);
    setResult(r);
    setEditableReply(r.clientReply);
    setEditableSlack(r.internalSlack);
    setTab("client");
    setTimeout(() => document.getElementById("triage-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const sev = result ? SEV_COLOR[result.severity] : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#020817;color:#e2e8f0;min-height:100vh}
        input,select,textarea{font-family:'DM Sans',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:#3b82f6 !important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp .3s ease both}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#020817" }}>

        {/* Nav */}
        <div style={{ background: "#0a0f1a", borderBottom: "1px solid #1e293b", padding: "0 28px", display: "flex", alignItems: "center", height: 52, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>L</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", letterSpacing: -.2 }}>LightWork AI</span>
            <span style={{ fontSize: 11, color: "#475569", background: "#0f172a", padding: "2px 8px", borderRadius: 4, border: "1px solid #1e293b" }}>Escalation Triage</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>Live</span>
          </div>
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px" }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "#f1f5f9", letterSpacing: -.4, marginBottom: 6 }}>Escalation triage</h1>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
              Fill in the client details and paste the escalation message. The triage engine classifies severity, identifies risk type, routes to the right team, and generates a client reply and internal escalation — instantly.
            </p>
          </div>

          {/* Presets */}
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Load a scenario</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "co_alarm",        label: "🚨 Carbon monoxide" },
                { key: "data_breach",     label: "🔒 Data breach" },
                { key: "tenancy_doc",     label: "📄 Tenancy document" },
                { key: "automation_drop", label: "📉 Automation drop" },
                { key: "angry_exec",      label: "😤 Angry executive" },
              ].map(p => (
                <button key={p.key} onClick={() => loadPreset(p.key)}
                  style={{ fontSize: 12, padding: "5px 12px", border: "1px solid #1e293b", borderRadius: 20, background: "#0f172a", color: "#94a3b8", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#94a3b8"; }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 16 }}>Client details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[{ k: "client", label: "Client name", ph: "Hargreaves Residential" }, { k: "tier", label: "Account tier", ph: "Enterprise / Growth / Starter" }, { k: "arr", label: "ARR", ph: "£48,000" }].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.ph}
                    style={{ width: "100%", padding: "8px 11px", border: "1px solid #1e293b", borderRadius: 8, fontSize: 13, color: "#e2e8f0", background: "#0f172a" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[{ k: "reporter", label: "Reported by", ph: "Sarah Chen, Lettings Director" }, { k: "renewal", label: "Renewal date (optional)", ph: "e.g. 6 weeks" }].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.ph}
                    style={{ width: "100%", padding: "8px 11px", border: "1px solid #1e293b", borderRadius: 8, fontSize: 13, color: "#e2e8f0", background: "#0f172a" }} />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 12 }}>Escalation</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 5 }}>Issue description *</label>
              <textarea value={form.issue} onChange={e => set("issue", e.target.value)} placeholder="Paste the client's message or describe the issue…"
                style={{ width: "100%", minHeight: 120, padding: "10px 12px", border: "1px solid #1e293b", borderRadius: 8, fontSize: 13, color: "#e2e8f0", background: "#0f172a", resize: "vertical", lineHeight: 1.6 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 5 }}>Internal context (optional)</label>
              <textarea value={form.context} onChange={e => set("context", e.target.value)} placeholder="Recent deploys, known incidents, previous tickets, account history…"
                style={{ width: "100%", minHeight: 64, padding: "10px 12px", border: "1px solid #1e293b", borderRadius: 8, fontSize: 13, color: "#e2e8f0", background: "#0f172a", resize: "vertical", lineHeight: 1.6 }} />
            </div>
          </div>

          {/* Team selection */}
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>Route to team</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              {TEAMS.map(t => (
                <div key={t.id} onClick={() => setSelectedTeam(t.id)}
                  style={{ border: `1px solid ${selectedTeam === t.id ? t.color : "#1e293b"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", background: selectedTeam === t.id ? t.bg + "22" : "#0f172a", textAlign: "center", transition: "all .15s" }}
                  onMouseEnter={e => { if (selectedTeam !== t.id) e.currentTarget.style.borderColor = "#334155"; }}
                  onMouseLeave={e => { if (selectedTeam !== t.id) e.currentTarget.style.borderColor = "#1e293b"; }}>
                  <div style={{ fontSize: 22, marginBottom: 5 }}>{t.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: selectedTeam === t.id ? t.color : "#94a3b8", marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.3 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: 13, color: "#fca5a5", padding: "10px 14px", background: "#450a0a", borderRadius: 8, border: "1px solid #dc2626", marginBottom: 12 }}>{error}</div>}

          {/* Run button */}
          <button onClick={runTriage}
            style={{ width: "100%", padding: "13px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: -.1 }}
            onMouseEnter={e => e.currentTarget.style.background = "#2563eb"}
            onMouseLeave={e => e.currentTarget.style.background = "#3b82f6"}>
            ⚡ Run triage
          </button>

          {/* ── Result ── */}
          {result && (
            <div id="triage-result" className="fade-up" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Severity header */}
              <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 12, padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: sev.text, padding: "3px 10px", background: sev.border + "33", borderRadius: 20, border: `1px solid ${sev.border}` }}>{SEV_COLOR[result.severity].label}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{result.riskCategory}</span>
                      {result.additionalTeams.length > 0 && <span style={{ fontSize: 12, color: "#64748b" }}>+ loop in: {result.additionalTeams.join(", ")}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{result.severityReason}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>SLA</div>
                    <div style={{ fontSize: 12, color: sev.text, fontWeight: 600 }}>{result.sla.split("·")[0].trim()}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{result.timestamp}</div>
                  </div>
                </div>
              </div>

              {/* Impact grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Customer impact</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65 }}>{result.customerImpact}</div>
                </div>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Tenant impact</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65 }}>{result.tenantImpact}</div>
                </div>
              </div>

              {/* Routing + Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Routing</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{result.team.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: result.team.color }}>{result.team.label}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: result.sev === "P0" ? "#450a0a" : "#0f172a", color: result.severity === "P0" ? "#fca5a5" : result.severity === "P1" ? "#fdba74" : "#86efac", border: "1px solid #334155" }}>{result.severity === "P0" ? "Immediate" : result.severity === "P1" ? "Today" : "This week"}</span>
                  </div>
                  {result.additionalTeams.length > 0 && (
                    <div style={{ fontSize: 12, color: "#64748b" }}>Also loop in: {result.additionalTeams.join(", ")}</div>
                  )}
                  <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{result.sla}</div>
                </div>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Immediate actions</div>
                  {result.actions.slice(0, 4).map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#64748b", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 12 }}>Follow-up checklist</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {result.checklist.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 16, height: 16, border: "1px solid #334155", borderRadius: 4, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editable drafts */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #0f172a", marginBottom: 16, justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex" }}>
                    {[{ id: "client", label: "Client reply draft" }, { id: "slack", label: "Internal escalation" }].map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ fontSize: 12, padding: "8px 16px", border: "none", borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent", background: "transparent", color: tab === t.id ? "#e2e8f0" : "#475569", cursor: "pointer", fontWeight: tab === t.id ? 600 : 400, marginBottom: -1 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <CopyBtn getText={() => tab === "client" ? editableReply : editableSlack} label={tab === "client" ? "Copy reply" : "Copy escalation"} />
                </div>
                {tab === "client" && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>Edit below before sending — do not send P0/P1 drafts without CS Lead review</div>
                    <textarea value={editableReply} onChange={e => setEditableReply(e.target.value)}
                      style={{ width: "100%", minHeight: 220, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                )}
                {tab === "slack" && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>Edit below — tag owners before posting to #escalations</div>
                    <textarea value={editableSlack} onChange={e => setEditableSlack(e.target.value)}
                      style={{ width: "100%", minHeight: 220, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, resize: "vertical", fontFamily: "DM Mono, monospace", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>

              {/* AI notice */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>
                  <strong style={{ color: "#64748b" }}>How AI automates this: </strong>
                  The triage engine reads unstructured escalation text and in under one second: detects risk signals (safety, GDPR, legal, churn, platform failure), classifies severity (P0–P3), generates customer and tenant impact statements, assigns SLA, routes to the right team, produces a follow-up checklist, and drafts both a client reply and internal escalation. A task that takes a CS manager 20–30 minutes of reading, thinking, and writing is reduced to a single click. The CSM reviews and edits the outputs — the AI handles the classification and first draft.
                  <strong style={{ color: "#64748b" }}> All P0 and P1 outputs must be reviewed before sending.</strong>
                </div>
              </div>

              <button onClick={reset} style={{ padding: "10px", border: "1px solid #1e293b", borderRadius: 10, background: "transparent", fontSize: 13, color: "#475569", cursor: "pointer" }}>
                ← Triage another issue
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
