import { useState } from "react";

// ─── SAMPLES ─────────────────────────────────────────────────────────────────
const SAMPLES = [
  {
    label: "🚨 Carbon monoxide",
    client: "Hargreaves Residential",
    text: `Hi, I need to raise something urgent. One of our tenants set off her carbon monoxide alarm this morning and messaged Felicity to ask what she should do. Felicity told her to open a window, ventilate the room, and wait 24-48 hours for an engineer to attend. She is still in the flat. I only found out because she called our office directly. This feels very serious and I am not happy with how Felicity handled it. Can someone call me urgently. Sarah Chen, Lettings Director, Hargreaves Residential.`
  },
  {
    label: "🔒 Tenant data exposed",
    client: "Northgate Property Group",
    text: `Hello, I am writing to flag a serious data issue. One of our tenants at Birchwood House received a message from Felicity this morning that contained the full name, phone number and outstanding rent balance of a completely different tenant in the building. The tenant who received this is very upset and has mentioned going to the ICO. This is the second time something like this has happened in the past month. We have 340 units across six buildings and I need to understand the full scope immediately. Please treat this as urgent. Marcus Webb, Operations Manager, Northgate Property Group.`
  },
  {
    label: "📄 Tenancy agreement ignored",
    client: "Elmfield Lettings",
    text: `Hi team, I am writing on behalf of one of our tenants, Mr Okonkwo in Flat 7. He has now requested a copy of his tenancy agreement three times over the past two weeks. Each time Felicity has acknowledged the request and told him someone will follow up. No one has. His mortgage application is dependent on this document and the offer expires on the 20th of this month. He is extremely frustrated and frankly so am I. This is a basic admin task and it has not been done. Priya Sharma, Property Manager, Elmfield Lettings.`
  }
];

// ─── TRIAGE ENGINE ─────────────────────────────────────────────────────────────
function triage(text, client) {
  const t = text.toLowerCase();
  const c = client?.trim() || "the client";
  const now = new Date().toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", hour12:true }).toUpperCase();

  // ── Detect issues ──
  const flags = {
    co:         /carbon monoxide|co alarm|monoxide/.test(t),
    gas:        /gas leak|smell.{0,10}gas|gas.{0,10}smell|gas escape/.test(t),
    fire:       /\bfire\b|smoke alarm|flames/.test(t),
    electrical: /electric shock|sparking|live wire|exposed wire|electrical hazard/.test(t),
    leakLight:  /leak.{0,30}light|light.{0,30}leak|through the light|light fitting/.test(t),
    gdpr:       /ico|data protection|gdpr|information commissioner|wrong tenant|another tenant|someone else.{0,20}(name|details|rent|data)|data.{0,20}(breach|incident)/.test(t),
    legalThreat:/solicitor|lawyer|legal action|sue\b|tribunal|compensation|withhold rent/.test(t),
    noHeating:  /no heating|no hot water|heating.{0,15}(broken|not working|failed)|boiler.{0,10}(broken|not working)/.test(t),
    vulnerable: /elderly|vulnerable|heart condition|disabled|\b7[4-9]\b|\b8[0-9]\b/.test(t),
    maintenance:/repair.{0,30}(not|no|never)|no.{0,15}(contractor|engineer|plumber)|contractor.{0,20}(not|never)|not.{0,20}(fixed|resolved|followed|booked|dispatched)|still waiting|nobody.{0,20}(called|came|visited)|mould|damp|leak/.test(t),
    platform:   /not receiv|no reply|not replying|not responding|felicity.{0,20}(not|stopped|down)|outage|duplicate|same message|loop|offline/.test(t),
    badAdvice:  /wrong advice|incorrect advice|told her to wait|told to ventilate|bad advice|incorrect information|wrong information/.test(t),
    document:   /tenancy agreement|tenancy contract|lease.{0,15}copy|deposit certificate|rent statement|reference request/.test(t),
    mortgage:   /mortgage|deadline|expires|completion/.test(t),
    billing:    /wrong charge|incorrect charge|overcharged|charged twice|arrears|outstanding balance/.test(t),
    repeated:   /three times|3 times|twice|second time|again|repeated|multiple times|keep.{0,15}(telling|saying|sending)/.test(t),
    churnRisk:  /pause.{0,20}rollout|cancel|switch off|reconsidering|not confident|not sure it.{0,10}working/.test(t),
  };

  // ── Severity ──
  let severity, severityReason;
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || flags.gdpr || (flags.noHeating && flags.vulnerable)) {
    severity = "P0";
    if (flags.co || flags.badAdvice) severityReason = "Felicity gave unsafe guidance during a carbon monoxide emergency. Tenant may still be in the property. Immediate safety and legal risk.";
    else if (flags.gas) severityReason = "Active gas leak reported. Immediate evacuation and emergency services required.";
    else if (flags.gdpr) severityReason = "Personal tenant data sent to wrong recipient. GDPR breach — ICO notification may be required within 72 hours.";
    else if (flags.leakLight) severityReason = "Water leak through live electrical fitting. Electrocution and fire risk — requires emergency attendance.";
    else severityReason = "Active safety or legal risk detected. Immediate escalation required.";
  } else if (flags.noHeating || flags.legalThreat || flags.churnRisk || (flags.maintenance && flags.repeated) || (flags.document && flags.mortgage)) {
    severity = "P1";
    if (flags.legalThreat) severityReason = "Tenant or client has indicated legal action or rent withholding. Requires CS Lead intervention today.";
    else if (flags.churnRisk) severityReason = "Client considering pausing or cancelling rollout. High churn risk — requires executive CS response.";
    else if (flags.document && flags.mortgage) severityReason = "Document request unresolved with mortgage deadline approaching. Time-critical — same-day resolution required.";
    else if (flags.noHeating) severityReason = "Heating or hot water failure reported. Tenant habitability at risk.";
    else severityReason = "Repeated workflow failure or urgent operational issue affecting tenant welfare or client trust.";
  } else if (flags.document || flags.billing || flags.maintenance || flags.platform) {
    severity = "P2";
    if (flags.document) severityReason = "Admin or document request unresolved after multiple attempts. Workflow failure.";
    else if (flags.billing) severityReason = "Billing discrepancy reported. Needs verification and correction.";
    else if (flags.platform) severityReason = "Platform delivery issue — Felicity not responding or sending duplicate messages.";
    else severityReason = "Standard maintenance or operational issue requiring follow-up.";
  } else {
    severity = "P3";
    severityReason = "Low-urgency query or general feedback. No immediate risk detected.";
  }

  // ── Risk category ──
  let riskCategory;
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || (flags.noHeating && flags.vulnerable)) riskCategory = "Safety";
  else if (flags.gdpr) riskCategory = "Data Protection";
  else if (flags.legalThreat || flags.churnRisk) riskCategory = "Workflow Failure";
  else if (flags.maintenance) riskCategory = "Maintenance";
  else if (flags.platform) riskCategory = "Delivery Issue";
  else if (flags.badAdvice) riskCategory = "Product Issue";
  else if (flags.document || flags.billing) riskCategory = "Workflow Failure";
  else riskCategory = "Other";

  // ── Owner ──
  let owner;
  if (flags.gdpr || flags.legalThreat) owner = "CS + Legal/DPO";
  else if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || flags.noHeating) owner = "CS + Client Operations";
  else if (flags.badAdvice || flags.platform) owner = "CS + Engineering + Product";
  else if (flags.maintenance) owner = "Client Operations";
  else owner = "CS";

  // ── Customer impact ──
  let customerImpact;
  if (flags.co && flags.badAdvice) customerImpact = `${c} is at risk of serious reputational and legal damage. Felicity gave incorrect safety advice during an emergency. If harm comes to the tenant, ${c} — and LightWork AI — face direct liability.`;
  else if (flags.gdpr) customerImpact = `${c} faces regulatory exposure under GDPR. A formal ICO complaint has been threatened. Failure to act within 72 hours may result in mandatory breach notification and potential fines.`;
  else if (flags.churnRisk) customerImpact = `${c} is actively reconsidering the rollout. Without a confident CS response today, this account is at serious churn risk.`;
  else if (flags.legalThreat) customerImpact = `${c} has indicated their tenant may pursue legal action or withhold rent. This creates direct financial and reputational exposure.`;
  else if (flags.document && flags.mortgage) customerImpact = `${c} is managing a tenant with a time-critical mortgage deadline. Failure to resolve today could result in the tenant losing their mortgage offer and blaming ${c} and LightWork AI.`;
  else if (flags.maintenance && flags.repeated) customerImpact = `${c} has flagged a repeated workflow failure. Tenant trust is eroding and ${c} is losing confidence in the platform.`;
  else customerImpact = `${c} has raised a service issue that requires follow-up. Client confidence may be affected if not addressed promptly.`;

  // ── Tenant impact ──
  let tenantImpact;
  if (flags.co) tenantImpact = "Tenant is in immediate danger — still in a property with an active CO alarm following incorrect AI guidance. Evacuation may not have occurred.";
  else if (flags.gdpr) tenantImpact = "Tenant has had their personal financial data exposed to another resident. They are distressed and threatening regulatory action.";
  else if (flags.noHeating && flags.vulnerable) tenantImpact = "Elderly or vulnerable tenant has no heating or hot water. This is a health and welfare emergency under housing law.";
  else if (flags.leakLight) tenantImpact = "Tenant is at risk of electrocution from water contact with live electrical fitting. Property is unsafe to occupy.";
  else if (flags.document && flags.mortgage) tenantImpact = "Tenant is at risk of losing a mortgage offer due to a missing document that was requested three times and never actioned.";
  else if (flags.maintenance && flags.repeated) tenantImpact = "Tenant has received repeated acknowledgements with no follow-through. Trust in the platform has broken down.";
  else if (flags.platform) tenantImpact = "Tenant is unable to communicate with their property manager via Felicity. Messages are not being delivered or acknowledged.";
  else tenantImpact = "Tenant experience has been negatively affected. Follow-up required to restore confidence.";

  // ── SLA ──
  const sla = severity === "P0" ? "Respond within 30 minutes. Resolve or escalate to senior leadership within 2 hours."
    : severity === "P1" ? "Respond within 2 hours. Resolution plan confirmed by end of day."
    : severity === "P2" ? "Respond within 4 hours. Resolve within 2 business days."
    : "Respond within 1 business day. No urgent escalation required.";

  // ── Next action ──
  let nextAction;
  if (flags.co || flags.badAdvice) nextAction = `Call ${c} immediately. Confirm the tenant has evacuated and called 999 or 0800 111 999 (Gas Emergency). Suspend Felicity from handling safety-related messages. Pull the conversation log for Product review.`;
  else if (flags.gdpr) nextAction = `Escalate to Legal/DPO within the hour. Identify all affected tenants and assess breach scope. Confirm whether ICO notification is required. Do not send further automated messages to affected tenants.`;
  else if (flags.leakLight) nextAction = `Dispatch emergency electrician to the property immediately. Do not route further messages through Felicity until the fault is cleared. Notify ${c} within 30 minutes.`;
  else if (flags.noHeating && flags.vulnerable) nextAction = `Contact ${c} within 30 minutes. Arrange emergency boiler repair or temporary heating for the affected tenant today. Document all actions.`;
  else if (flags.legalThreat) nextAction = `CS Lead to call ${c} today. Do not respond to legal threats in writing without Legal review. Document the full communication history.`;
  else if (flags.document && flags.mortgage) nextAction = `CS Lead to retrieve and send the tenancy agreement to the tenant today. Confirm receipt. Check why Felicity's follow-up workflow failed to resolve this after three requests.`;
  else if (flags.maintenance) nextAction = `Operations to contact the affected tenant directly and book a contractor. Do not route through Felicity until the routing issue is diagnosed.`;
  else if (flags.platform) nextAction = `Engineering to pull delivery logs for ${c}'s account and confirm scope of the issue. Check whether other accounts are affected.`;
  else nextAction = `CS Lead to review and respond to ${c} within the SLA window. Log the issue in the account record.`;

  // ── Checklist ──
  const checklist = [];
  if (severity === "P0" || severity === "P1") checklist.push("Acknowledge to client within 30 minutes");
  if (flags.co || flags.gas) checklist.push("Confirm tenant has evacuated and emergency services contacted");
  if (flags.gdpr) checklist.push("Notify Legal/DPO — assess ICO notification requirement (72hr window)");
  if (flags.gdpr) checklist.push("Identify all tenants potentially affected by the data exposure");
  if (flags.badAdvice || flags.co) checklist.push("Pull Felicity conversation log — share with Product and Engineering");
  if (flags.badAdvice || flags.co) checklist.push("Suspend Felicity from safety-category queries pending review");
  if (flags.maintenance || flags.document) checklist.push("Bypass Felicity — contact tenant directly with resolution");
  if (flags.legalThreat) checklist.push("Do not respond to legal threats in writing without Legal sign-off");
  checklist.push("Log full incident in account record with timestamps");
  checklist.push(`Send structured follow-up to ${c} confirming resolution or timeline`);
  if (severity === "P0") checklist.push("Brief CS Lead and relevant exec before client update call");

  // ── Client reply ──
  const replyParts = [`Hi,\n\nThank you for raising this — I want to be direct with you, this is being treated as a priority right now.\n`];
  if (flags.co || flags.badAdvice) replyParts.push(`On the carbon monoxide situation: the guidance Felicity gave was incorrect. Any tenant with an active CO alarm should leave the property immediately and call the Gas Emergency Service on 0800 111 999. Please pass this on to the tenant now if you have not already done so. I have escalated this internally as a critical safety incident.\n`);
  if (flags.gdpr) replyParts.push(`On the data privacy issue: I have flagged this to our Legal and Data Protection team as of this moment. We are treating it as a potential GDPR incident, investigating scope, and will confirm our response plan to you directly. No further automated messages will be sent to the affected tenants until this is resolved.\n`);
  if (flags.leakLight) replyParts.push(`On the leak through the light fitting: this is being escalated to Client Operations for emergency attendance. In the meantime, please advise the tenant not to use the affected room and to switch off the electrical supply to that area if safe to do so.\n`);
  if (flags.noHeating) replyParts.push(`On the heating issue: Client Operations will contact the affected tenant directly today to arrange emergency repair. We are not routing this through Felicity.\n`);
  if (flags.document) replyParts.push(`On the tenancy agreement request: I am picking this up personally and will ensure the document reaches the tenant today. I am also reviewing why our follow-up workflow failed to resolve this after repeated requests.\n`);
  if (flags.maintenance && !flags.co) replyParts.push(`On the outstanding repair: Client Operations will contact the affected tenant directly today. I am investigating why the escalation workflow did not route this correctly.\n`);
  if (flags.platform) replyParts.push(`On the platform issue: our Engineering team is reviewing delivery logs for your account now. I will confirm root cause and resolution timeline as part of my update to you.\n`);
  replyParts.push(`I will send you a full update — including confirmed next steps and root causes — ${severity === "P0" ? "within 2 hours" : "by end of day"}.\n\nI am sorry this has happened.\n\nCS Lead, LightWork AI`);
  const clientReply = replyParts.join("\n");

  // ── Internal Slack ──
  const ownerLine = `*Owner: ${owner}*`;
  const slackParts = [
    `🚨 *[${severity}] ESCALATION — ${c.toUpperCase()}*\n`,
    `*Severity:* ${severity} — ${severityReason}`,
    `*Risk category:* ${riskCategory}`,
    `*SLA:* ${sla}\n`,
    `*What happened:*\n${text.slice(0, 300)}${text.length > 300 ? "..." : ""}\n`,
    `*Tenant impact:* ${tenantImpact}`,
    `*Customer impact:* ${customerImpact}\n`,
    ownerLine,
    `*Next action:* ${nextAction}\n`,
  ];
  if (flags.co || flags.badAdvice) slackParts.push(`⚠️ *Pull Felicity conversation log immediately. Do not wait for client callback.*`);
  if (flags.gdpr) slackParts.push(`⚠️ *Legal/DPO — 72hr GDPR clock may be running. Confirm ICO notification decision today.*`);
  slackParts.push(`\nReply here or call me directly before client update goes out.`);
  const internalSlack = slackParts.join("\n");

  return { severity, severityReason, riskCategory, customerImpact, tenantImpact, owner, nextAction, sla, clientReply, internalSlack, checklist, timestamp: now };
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const P = {
  P0: { color:"#FF2D55", bg:"#1a0008", border:"#FF2D5540", dot:"🔴", label:"Immediate Executive Attention Required" },
  P1: { color:"#FF9500", bg:"#1a0e00", border:"#FF950040", dot:"🟠", label:"Urgent — Senior Leadership Aware" },
  P2: { color:"#0A84FF", bg:"#00101a", border:"#0A84FF40", dot:"🔵", label:"Elevated — Active Monitoring Required" },
  P3: { color:"#30D158", bg:"#001a08", border:"#30D15840", dot:"🟢", label:"Standard — Scheduled Resolution" },
};
const CAT_COLOR = {
  "Safety":"#FF2D55","Data Protection":"#BF5AF2","Maintenance":"#FF9500",
  "Workflow Failure":"#0A84FF","Delivery Issue":"#64D2FF","Product Issue":"#FF6B35","Other":"#636366"
};
const OWNER_COLOR = {
  "CS":"#30D158","CS + Legal/DPO":"#FF2D55","CS + Client Operations":"#FF9500",
  "CS + Engineering + Product":"#BF5AF2","Client Operations":"#FF9500","Engineering":"#BF5AF2"
};

function Badge({ text, color, bg }) {
  return <span style={{ background:bg||`${color}18`, border:`1px solid ${color}40`, color, padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700, letterSpacing:"0.03em" }}>{text}</span>;
}

function CopyBtn({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { try{navigator.clipboard.writeText(text)}catch{} setDone(true); setTimeout(()=>setDone(false),2000); }}
      style={{ display:"flex", alignItems:"center", gap:6, background:done?"#0d2a0d":"#0f172a", border:`1px solid ${done?"#30D158":"#1e293b"}`, color:done?"#30D158":"#64748b", padding:"8px 16px", borderRadius:7, fontSize:12, fontFamily:"inherit", cursor:"pointer", fontWeight:500, transition:"all 0.15s" }}>
      <span>{done?"✓":""}</span>{done?"Copied":label}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.09em", textTransform:"uppercase", fontWeight:600, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [text, setText] = useState("");
  const [client, setClient] = useState("");
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("client");
  const [editableReply, setEditableReply] = useState("");
  const [editableSlack, setEditableSlack] = useState("");

  const run = () => { if(text.trim()) { const r = triage(text, client); setResult(r); setEditableReply(r.clientReply || ""); setEditableSlack(r.internalSlack || ""); setTab("client"); }};
  const load = (s) => { setText(s.text); setClient(s.client); setResult(null); };

  const pc = result ? P[result.severity] : null;

  return (
    <div style={{ minHeight:"100vh", background:"#020817", color:"#f1f5f9", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px;}
        textarea,input{outline:none;}
        @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .up{animation:up 0.3s ease forwards;} .pulse{animation:pulse 2s infinite;}
        .field-box{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px 16px;font-size:13px;color:#cbd5e1;line-height:1.75;white-space:pre-wrap;}
        .tab{background:none;border:none;border-bottom:2px solid transparent;color:#475569;padding:9px 18px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}
        .tab.on{color:#f1f5f9;border-bottom-color:#4f46e5;}
        .tab:hover:not(.on){color:#94a3b8;}
        .card{background:#0a1628;border:1px solid #1e293b;border-radius:12px;padding:20px 22px;}
        .run{background:#4f46e5;color:#fff;border:none;padding:12px 28px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .run:hover{background:#4338ca;} .run:disabled{background:#1e293b;color:#475569;cursor:not-allowed;}
        .sample{background:none;border:1px solid #1e293b;color:#64748b;padding:6px 12px;border-radius:6px;font-family:inherit;font-size:11px;cursor:pointer;transition:all 0.15s;}
        .sample:hover{border-color:#334155;color:#94a3b8;background:#0f172a;}
        .inp{width:100%;background:#0f172a;border:1px solid #1e293b;color:#f1f5f9;border-radius:8px;padding:10px 14px;font-family:inherit;font-size:13px;line-height:1.6;transition:border-color 0.15s;}
        .inp:focus{border-color:#334155;} .inp::placeholder{color:#334155;}
        .check-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #0f172a;}
        .check-item:last-child{border-bottom:none;}
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0f172a", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#020817", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:"#4f46e5", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⚡</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>LightWork AI</div>
            <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.07em", textTransform:"uppercase" }}>CS Escalation Triage Agent</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div className="pulse" style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e" }} />
          <span style={{ fontSize:11, color:"#334155", fontWeight:500 }}>AGENT READY</span>
        </div>
      </div>

      <div style={{ maxWidth:920, margin:"0 auto", padding:"24px 16px" }}>

        {/* Input card */}
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>New Escalation</div>
          <div style={{ fontSize:12, color:"#64748b", marginBottom:16 }}>Paste a client email, tenant complaint, or support note. The tool analyses what you write.</div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#334155", fontWeight:500 }}>Load sample:</span>
            {SAMPLES.map((s,i) => <button key={i} className="sample" onClick={() => load(s)}>{s.label}</button>)}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, marginBottom:5 }}>Client / Account Name</div>
              <input className="inp" value={client} onChange={e=>setClient(e.target.value)} placeholder="e.g. Hargreaves Residential" />
            </div>
            <div>
              <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, marginBottom:5 }}>Date of Escalation</div>
              <input className="inp" defaultValue={new Date().toLocaleDateString("en-GB")} readOnly style={{ color:"#64748b" }} />
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500, marginBottom:5 }}>Escalation Message</div>
            <textarea className="inp" value={text} onChange={e=>{setText(e.target.value);setResult(null);}} placeholder="Paste the client email, tenant complaint, or support note here..." rows={9} style={{ resize:"vertical" }} />
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:11, color:"#334155", maxWidth:480 }}>
              ⚠ AI assists with classification and summarisation. <strong style={{ color:"#475569" }}>Human review is required for all P0 and P1 incidents before any action is taken.</strong>
            </div>
            <button className="run" onClick={run} disabled={!text.trim()}>Triage Escalation →</button>
          </div>
        </div>

        {/* Dashboard */}
        {result && (
          <div className="up">

            {/* Severity banner */}
            <div style={{ background:pc.bg, border:`1px solid ${pc.border}`, borderLeft:`4px solid ${pc.color}`, borderRadius:12, padding:"18px 22px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:30 }}>{pc.dot}</span>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:pc.color, letterSpacing:"-0.01em" }}>{result.severity} — {pc.label}</div>
                  <div style={{ fontSize:12, color:"#94a3b8", marginTop:4, maxWidth:520 }}>{result.severityReason}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:20, flexShrink:0 }}>
                <div>
                  <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:500, marginBottom:3 }}>SLA</div>
                  <div style={{ fontSize:12, color:pc.color, fontWeight:700 }}>{result.severity === "P0" ? "30 min response" : result.severity === "P1" ? "2 hour response" : result.severity === "P2" ? "4 hour response" : "1 business day"}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", fontWeight:500, marginBottom:3 }}>Triaged</div>
                  <div style={{ fontSize:12, color:"#64748b", fontWeight:600 }}>{result.timestamp}</div>
                </div>
              </div>
            </div>

            {/* Core fields grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

              <div className="card">
                <Field label="Risk Category">
                  <Badge text={result.riskCategory} color={CAT_COLOR[result.riskCategory]||"#636366"} />
                </Field>
                <Field label="Recommended Owner">
                  <Badge text={result.owner} color={OWNER_COLOR[result.owner]||"#30D158"} />
                </Field>
                <Field label="SLA Recommendation">
                  <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.6 }}>{result.sla}</div>
                </Field>
              </div>

              <div className="card">
                <Field label="Next Action">
                  <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.65 }}>{result.nextAction}</div>
                </Field>
              </div>

              <div className="card">
                <Field label="Customer Impact">
                  <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.65 }}>{result.customerImpact}</div>
                </Field>
              </div>

              <div className="card">
                <Field label="Tenant Impact">
                  <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.65 }}>{result.tenantImpact}</div>
                </Field>
              </div>
            </div>

            {/* Follow-up checklist */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:"#475569", letterSpacing:"0.09em", textTransform:"uppercase", fontWeight:600, marginBottom:12 }}>Follow-up Checklist</div>
              {result.checklist.map((item, i) => (
                <div key={i} className="check-item">
                  <div style={{ width:20, height:20, border:"1px solid #334155", borderRadius:4, flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:"#334155" }} />
                  </div>
                  <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.55 }}>{item}</div>
                </div>
              ))}
            </div>

            {/* Drafts */}
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:"flex", borderBottom:"1px solid #0f172a", marginBottom:18, justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex" }}>
                  {[{id:"client",label:"Client Reply Draft"},{id:"slack",label:"Internal Escalation"}].map(t=>(
                    <button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
                  ))}
                </div>
                <div style={{ paddingBottom:2 }}>
                  {tab==="client" ? <CopyBtn text={editableReply} label="Copy client response" /> : <CopyBtn text={editableSlack} label="Copy internal escalation" />}
                </div>
              </div>
              {tab==="client" && (
                <div>
                  <div style={{ fontSize:11, color:"#475569", marginBottom:10 }}>To: {client||"Client"} — <strong style={{color:"#94a3b8"}}>edit below before sending.</strong> Do not send automatically for P0/P1.</div>
                  <textarea
                    value={editableReply}
                    onChange={e => setEditableReply(e.target.value)}
                    style={{ width:"100%", minHeight:180, background:"#0a0f1a", border:"1px solid #1e293b", borderRadius:8, padding:"14px 16px", fontSize:13, color:"#cbd5e1", lineHeight:1.7, resize:"vertical", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
                  />
                </div>
              )}
              {tab==="slack" && (
                <div>
                  <div style={{ fontSize:11, color:"#475569", marginBottom:10 }}>Post to #escalations — <strong style={{color:"#94a3b8"}}>edit below</strong> then tag relevant owners before sending.</div>
                  <textarea
                    value={editableSlack}
                    onChange={e => setEditableSlack(e.target.value)}
                    style={{ width:"100%", minHeight:180, background:"#0a0f1a", border:"1px solid #1e293b", borderRadius:8, padding:"14px 16px", fontSize:13, color:"#cbd5e1", lineHeight:1.7, resize:"vertical", outline:"none", fontFamily:"monospace", boxSizing:"border-box" }}
                  />
                </div>
              )}
            </div>

            {/* AI notice */}
            <div style={{ background:"#0a0f1a", border:"1px solid #1e293b", borderRadius:10, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>🤖</span>
              <div style={{ fontSize:12, color:"#64748b", lineHeight:1.65 }}>
                <strong style={{ color:"#94a3b8" }}>AI Triage Notice:</strong> This tool assists with classification, summarisation, and draft generation. It does not connect to live systems and cannot verify facts in the escalation message. <strong style={{ color:"#94a3b8" }}>All P0 and P1 outputs must be reviewed by a human CS Lead before any action is taken.</strong> For genuine emergencies, always call the client directly.
              </div>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!result && (
          <div style={{ textAlign:"center", padding:"52px 24px" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#334155", marginBottom:6 }}>Ready to triage</div>
            <div style={{ fontSize:13, color:"#1e293b" }}>Load a sample or paste an escalation above</div>
          </div>
        )}

      </div>
    </div>
  );
}
