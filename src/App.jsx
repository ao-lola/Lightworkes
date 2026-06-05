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
  }
};

const TEAMS = [
  { id:"engineering", label:"Engineering",       icon:"⚙",  desc:"Bugs, failures, performance",  color:"#7c3aed", bg:"#f5f3ff", border:"#ddd6fe" },
  { id:"cs",          label:"Customer Success",  icon:"🤝",  desc:"Relationship, account risk",   color:"#d97706", bg:"#fffbeb", border:"#fcd34d" },
  { id:"product",     label:"Product",           icon:"💡",  desc:"Feature gaps, AI behaviour",   color:"#0891b2", bg:"#ecfeff", border:"#a5f3fc" },
  { id:"ops",         label:"Operations",        icon:"🔧",  desc:"Config, integrations, data",   color:"#16a34a", bg:"#f0fdf4", border:"#86efac" },
  { id:"leadership",  label:"Leadership",        icon:"⭐",  desc:"Exec escalation, legal, GDPR", color:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
];

// ── Gibberish / unrecognised input detection ─────────────────────────────────
function isUnrecognisedInput(text) {
  const t = text.trim();

  // Must have at least 15 characters
  if (t.length < 15) return { bad: true, reason: "Input is too short to triage. Please paste the full client message or describe the issue in detail." };

  // Must have at least 3 real words
  const words = t.match(/[a-zA-Z]{2,}/g) || [];
  if (words.length < 3) return { bad: true, reason: "Not enough context to triage. Please describe the issue in a few sentences." };

  // Catch pure keyboard mash: same character repeated 5+ times
  if (/(.){5,}/.test(t.replace(/\s/g, ""))) return { bad: true, reason: "Input does not appear to be a real escalation message. Please paste the client's actual message." };

  // Catch pure random letter strings with almost no vowels (e.g. "sdfkjhsdkjfh")
  const noSpaces = t.replace(/\s/g, "");
  const vowels = (noSpaces.match(/[aeiou]/gi) || []).length;
  const vowelRatio = vowels / noSpaces.length;
  if (noSpaces.length > 20 && vowelRatio < 0.05) return { bad: true, reason: "Input contains unrecognised text. Please paste the actual client escalation message." };

  return { bad: false };
}

// ── Specific routing destinations ─────────────────────────────────────────────
// Maps team selection to specific named contacts, channels, and ticket systems
const ROUTING_DESTINATIONS = {
  engineering: {
    channel: "#eng-incidents",
    ticketSystem: "Linear — Engineering board",
    escalateTo: "On-call engineer + Engineering Lead",
    action: "Create a Linear ticket tagged [CS-Escalation] and post in #eng-incidents with @eng-oncall"
  },
  cs: {
    channel: "#cs-escalations",
    ticketSystem: "HubSpot — CS queue",
    escalateTo: "CS Lead (Lola Amidu)",
    action: "Log in HubSpot and post in #cs-escalations — CS Lead to take ownership within SLA window"
  },
  product: {
    channel: "#product-feedback",
    ticketSystem: "Linear — Product board",
    escalateTo: "Head of Product",
    action: "Create a Linear ticket tagged [AI-Behaviour] and post summary in #product-feedback with @product-lead"
  },
  ops: {
    channel: "#ops-support",
    ticketSystem: "Linear — Ops board",
    escalateTo: "Operations Manager",
    action: "Create an Ops ticket in Linear and post in #ops-support — assign to Operations Manager"
  },
  leadership: {
    channel: "#leadership-escalations",
    ticketSystem: "Direct notification",
    escalateTo: "CEO / VP Customer Success",
    action: "Direct message to VP CS and CEO — do not post publicly. Prepare a one-page incident summary."
  }
};

// ── AI Triage Engine ──────────────────────────────────────────────────────────
// This is where the automation happens. The engine reads the raw escalation text
// and applies a rule set built from real CS knowledge to instantly classify,
// prioritise, route, and generate outputs — replacing 20-30 minutes of manual
// CS work with a single click.
function runTriageEngine(text, client, tier, arr, reporter, renewal, context, teamId) {
  const t = (text + " " + context).toLowerCase();
  const team = TEAMS.find(tm => tm.id === teamId) || TEAMS[0];
  const now = new Date().toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

  // ── Extract named context for dynamic output generation ─────────────────────
  const reporterName = reporter ? reporter.split(",")[0].trim() : "the client contact";
  const reporterTitle = reporter && reporter.includes(",") ? reporter.split(",").slice(1).join(",").trim() : "client representative";
  const clientName = client?.trim() || "the client";
  const arrValue = arr ? arr.trim() : null;
  const tierLabel = tier ? tier.trim() : null;
  const renewalText = renewal ? renewal.trim() : null;
  const isEnterprise = /enterprise/i.test(tier || "");
  const isHighARR = arr && (parseInt(arr.replace(/[^0-9]/g,"")) >= 40000);
  const isRenewalImminent = renewal && /week|month|30|60|90/i.test(renewal);
  const isExec = /ceo|cto|coo|director|head of|vp |president|founder|owner|principal/i.test(reporter || "");
  const isSeniorRole = isExec || /manager|lead|director/i.test(reporter || "");

  // ── Signal detection ─────────────────────────────────────────────────────────
  const flags = {
    co:          /carbon monoxide|co alarm|monoxide/.test(t),
    gas:         /gas leak|smell.{0,10}gas|gas escape/.test(t),
    fire:        /fire|smoke alarm|flames/.test(t),
    electrical:  /electric shock|sparking|live wire|exposed wire/.test(t),
    leakLight:   /leak.{0,30}light|light.{0,30}leak|through the light|light fitting/.test(t),
    gdpr:        /ico|data protection|gdpr|information commissioner|wrong tenant|another tenant|someone else.{0,20}(name|details|rent|data)|data.{0,20}(breach|incident)/.test(t),
    legalThreat: /solicitor|lawyer|legal action|sue|tribunal|compensation|withhold rent/.test(t),
    noHeating:   /no heating|no hot water|heating.{0,15}(broken|not working|failed)|boiler.{0,10}(broken|not working)/.test(t),
    vulnerable:  /elderly|vulnerable|heart condition|disabled|alone|lives alone/.test(t),
    maintenance: /repair.{0,30}(not|no|never)|not.{0,20}(fixed|resolved|followed|booked)|still waiting|nobody.{0,20}(called|came)|mould|damp|leak/.test(t),
    platform:    /not receiv|no reply|not replying|felicity.{0,20}(not|stopped|down)|outage|duplicate|same message|offline|automation.{0,20}(drop|fell|fallen|rate)/.test(t),
    badAdvice:   /wrong advice|incorrect advice|told.{0,20}to wait|told to ventilate|bad advice|wrong information|incorrect guidance/.test(t),
    document:    /tenancy agreement|tenancy contract|lease.{0,15}copy|deposit certificate|rent statement/.test(t),
    mortgage:    /mortgage|deadline|expires|completion/.test(t),
    billing:     /wrong charge|incorrect charge|overcharged|charged twice|arrears/.test(t),
    repeated:    /three times|3 times|twice|second time|again|repeated|multiple times/.test(t),
    churnRisk:   /cancel|switch off|reconsidering|not confident|pause.{0,20}rollout|made the right decision|questioning/.test(t),
    noEngineer:  /no engineer|engineer.{0,20}(not|never|hasn|dispatch)|not dispatched|nobody.{0,20}came/.test(t),
    bypassed:    /called.{0,20}(office|directly|us)|contacted.{0,20}directly|rang us|phoned/.test(t),
    floorInfo:   t.match(/(\d+)(st|nd|rd|th).{0,10}floor/) ? t.match(/(\d+)(st|nd|rd|th).{0,10}floor/)[0] : null,
    tenantInfo:  t.match(/tenant.{0,60}(?:alone|elderly|floor|flat|unit|vulnerable)/) ? true : false,
  };

  // Extract specific numbers and facts from text
  const automationMatch = text.match(/(\d+)%?\s*(?:to|down to|from.+?to)\s*(\d+)%/);
  const unresolvedMatch = text.match(/(\d[\d,]*)\s*unresolved/i);
  const buildingMatch = text.match(/(\d+)\s*(?:properties|buildings|units|sites)/i);
  const requestCountMatch = text.match(/(two|three|four|five|2|3|4|5)\s*times?|(\d+)\s*(?:separate\s*)?requests?/i);
  const flatMatch = text.match(/flat\s*(\w+)|unit\s*(\w+)/i);

  // ── Severity + confidence ────────────────────────────────────────────────────
  let severity, severityReason, sla, confidenceScore, confidenceReason;
  const signals = [];
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || flags.gdpr || (flags.noHeating && flags.vulnerable)) {
    severity = "P0";
    sla = "30-minute response · Immediate human escalation";
    if (flags.co) {
      signals.push("Carbon monoxide alarm detected in escalation text");
      if (flags.badAdvice) signals.push("Felicity provided incorrect safety guidance — tenant advised to wait rather than evacuate");
      if (flags.vulnerable) signals.push("Tenant described as elderly or vulnerable");
      if (flags.noEngineer || context.toLowerCase().includes("no engineer")) signals.push("No engineer has been dispatched");
      if (flags.bypassed) signals.push(`${reporterName} has contacted the office directly, bypassing standard support channels`);
      if (flags.floorInfo) signals.push(`Tenant located on ${flags.floorInfo} — evacuation may be more complex`);
      severityReason = `Carbon monoxide emergency with incorrect AI guidance${flags.vulnerable ? " affecting a vulnerable tenant" : ""}. Multiple compounding risk factors detected.`;
      confidenceScore = 98;
      confidenceReason = "Multiple high-confidence safety and legal risk signals detected simultaneously.";
    } else if (flags.gdpr) {
      signals.push("Personal tenant data sent to wrong recipient");
      signals.push("ICO complaint explicitly threatened");
      if (flags.repeated) signals.push("Second occurrence — pattern indicates systemic issue");
      if (buildingMatch) signals.push(`${buildingMatch[0]} affected — broad scope increases breach severity`);
      severityReason = "Personal data exposure with regulatory threat. ICO 72-hour notification window may have started.";
      confidenceScore = 96;
      confidenceReason = "GDPR breach indicators are explicit and unambiguous. Regulatory exposure is clear.";
    } else {
      signals.push("Active safety hazard detected");
      severityReason = "Immediate safety or legal risk identified.";
      confidenceScore = 90;
      confidenceReason = "Safety signals detected in escalation text.";
    }
  } else if (flags.legalThreat || flags.churnRisk || isExec || (flags.maintenance && flags.repeated) || (flags.document && flags.mortgage)) {
    severity = "P1";
    sla = "2-hour response · CS Lead must own this today";
    if (flags.document && flags.mortgage) {
      signals.push("Tenancy document request unresolved after multiple attempts");
      signals.push("Mortgage application deadline creates hard time constraint");
      if (requestCountMatch) signals.push(`${requestCountMatch[0]} requests made — repeated failure to action`);
      if (flatMatch) signals.push(`Specific tenant identified: ${flatMatch[0]}`);
      severityReason = "Document request with active mortgage deadline. Each hour of delay increases risk of financial harm to the tenant.";
      confidenceScore = 92;
      confidenceReason = "Mortgage deadline creates an objective, verifiable time constraint with clear financial consequence.";
    } else if (isExec) {
      signals.push(`${reporterTitle} has escalated directly — not a standard support contact`);
      if (flags.churnRisk) signals.push("Language indicates active consideration of cancellation or rollout pause");
      if (isRenewalImminent) signals.push(`Renewal ${renewalText} — commercial window is open`);
      signals.push("Executive-level contact suggests internal escalation has already occurred");
      severityReason = `${reporterTitle} engagement indicates the issue has reached leadership level at ${clientName}. Commercial and relationship risk is elevated.`;
      confidenceScore = 89;
      confidenceReason = "Executive contact combined with dissatisfaction language and renewal proximity are strong P1 indicators.";
    } else if (flags.legalThreat) {
      signals.push("Legal action or rent withholding explicitly threatened");
      severityReason = "Legal threat requires CS Lead and potential legal review today.";
      confidenceScore = 94;
      confidenceReason = "Legal threat language is explicit and unambiguous.";
    } else {
      signals.push("Repeated workflow failure detected");
      severityReason = "Escalating operational failure affecting client trust.";
      confidenceScore = 82;
      confidenceReason = "Repeated failure pattern and client frustration language detected.";
    }
  } else if (flags.document || flags.billing || flags.maintenance || flags.platform) {
    severity = "P2";
    sla = "4-hour response · Assign and confirm same day";
    if (flags.platform) {
      signals.push("Platform delivery or automation failure detected");
      if (automationMatch) signals.push(`Automation rate drop: ${automationMatch[0]}`);
      if (unresolvedMatch) signals.push(`${unresolvedMatch[0]} queries reported unresolved`);
      severityReason = "Platform operational failure with measurable client impact.";
      confidenceScore = 85;
      confidenceReason = "Platform failure signals with quantified impact metrics detected.";
    } else {
      signals.push("Workflow or admin failure without immediate safety or legal risk");
      severityReason = "Standard operational issue requiring structured follow-up.";
      confidenceScore = 78;
      confidenceReason = "Issue is clearly defined but no urgent risk indicators detected.";
    }
  } else {
    severity = "P3";
    sla = "1 business day · Standard response";
    signals.push("No high-priority risk signals detected");
    severityReason = "Low-urgency query or general feedback.";
    confidenceScore = 70;
    confidenceReason = "No elevated risk signals found. Standard triage applied.";
  }

  // ── Risk category ──────────────────────────────────────────────────────────
  let riskCategory;
  if (flags.co || flags.gas || flags.fire || flags.electrical || flags.leakLight || (flags.noHeating && flags.vulnerable)) riskCategory = "Safety";
  else if (flags.gdpr) riskCategory = "Data Protection";
  else if (flags.legalThreat) riskCategory = "Legal Risk";
  else if (flags.churnRisk || isExec) riskCategory = "Relationship Risk";
  else if (flags.platform) riskCategory = "Platform Failure";
  else if (flags.badAdvice) riskCategory = "AI Behaviour";
  else if (flags.maintenance) riskCategory = "Maintenance";
  else if (flags.document || flags.billing) riskCategory = "Workflow Failure";
  else riskCategory = "General";

  // ── Additional teams ────────────────────────────────────────────────────────
  let additionalTeams = [];
  if (flags.gdpr || flags.legalThreat) additionalTeams = ["Legal / DPO"];
  else if (flags.co || flags.badAdvice) additionalTeams = ["Engineering", "Product"];
  else if (flags.platform) additionalTeams = ["Engineering"];
  additionalTeams = additionalTeams.filter(t => t !== team.label);

  // ── Routing justification — specific per team ────────────────────────────────
  const routingJustification = {};
  if (flags.co || flags.badAdvice) {
    routingJustification["Engineering"] = ["Investigate why Felicity provided incorrect safety guidance", "Review delivery pipeline for failed message confirmation", "Check if similar advice has been given to other tenants"];
    routingJustification["Product"] = ["Felicity's response to CO alarm must be reviewed as a critical AI behaviour incident", "Safety scenario handling needs immediate audit across all active deployments"];
  }
  if (flags.gdpr) {
    routingJustification["Engineering"] = ["Identify root cause of cross-tenant data exposure", "Audit message delivery logs to determine full breach scope"];
    routingJustification["Legal / DPO"] = ["Begin 72-hour GDPR breach assessment", "Prepare ICO notification if required", "Document breach scope and containment steps"];
  }
  if (flags.platform) {
    routingJustification["Engineering"] = [
      automationMatch ? `Automation rate drop from ${automationMatch[0]} requires root cause analysis` : "Platform delivery failure requires immediate investigation",
      "Check deployment logs — correlate with any recent releases",
      unresolvedMatch ? `${unresolvedMatch[0]} unresolved queries indicates message queue issue` : "Message queue health check required"
    ];
  }
  if (flags.document && flags.mortgage) {
    routingJustification["Operations"] = ["Retrieve and manually send tenancy agreement today — do not re-route through Felicity", "Verify mortgage deadline and document directly to CRM"];
  }
  // Always add the selected team if not already covered
  if (!routingJustification[team.label]) {
    routingJustification[team.label] = [
      `Primary owner for ${riskCategory.toLowerCase()} incidents`,
      `${isSeniorRole ? `${reporterTitle} contact requires ${isEnterprise ? "senior" : "standard"} CS response` : "Account relationship management"}`,
      isRenewalImminent ? `Renewal in ${renewalText} — commercial sensitivity is high` : "Account health monitoring required"
    ];
  }

  // ── Business risk assessment ─────────────────────────────────────────────────
  const businessRisk = (() => {
    const parts = [];
    if (arrValue) parts.push(`${arrValue} ARR is directly at risk${severity === "P0" || severity === "P1" ? " if this incident is not resolved within SLA" : ""}.`);
    if (tierLabel && isHighARR) parts.push(`As an ${tierLabel} account, ${clientName} sits in the top tier of the portfolio and any churn or escalation will have disproportionate impact on portfolio ARR.`);
    if (isRenewalImminent) parts.push(`Renewal is ${renewalText} away. This incident is occurring during an active commercial window — poor incident management at this stage materially increases the risk of non-renewal or downgrade.`);
    if (isExec) parts.push(`${reporterName} is ${reporterTitle} at ${clientName}. Executive-level engagement at this stage suggests the issue has already been discussed internally. Recovery will require senior-to-senior relationship management.`);
    if (flags.churnRisk) parts.push(`Language in the escalation suggests ${clientName} is actively reconsidering the rollout. This is not a retention risk — it is a live churn signal.`);
    if (flags.gdpr) parts.push(`GDPR breach risk creates regulatory exposure independent of the commercial relationship. ICO fines and reputational damage could extend beyond this account.`);
    if (!parts.length) parts.push(`No immediate commercial risk beyond standard SLA compliance. Monitor for escalation signals over the next 30 days.`);
    return parts.join(" ");
  })();

  // ── Dynamic customer impact ──────────────────────────────────────────────────
  const customerImpact = (() => {
    if (flags.co && flags.bypassed) return `${reporterName} has bypassed standard support channels and called the office directly — a clear signal of lost confidence in the platform's ability to handle this incident. As ${reporterTitle}, they are likely to escalate internally to ${clientName}'s leadership if they do not receive an immediate senior-level response. The nature of the incident — a safety failure combined with incorrect AI guidance — creates both reputational and legal exposure for ${clientName}.`;
    if (flags.gdpr) return `${clientName} now faces regulatory exposure that sits outside the normal CS relationship. ${reporterName} has explicitly mentioned the ICO — this is not a threat being made lightly. With ${buildingMatch ? buildingMatch[0] + " affected" : "multiple units potentially affected"}, the breach scope may require formal notification. ${arrValue ? `The ${arrValue} ARR relationship is secondary to the immediate legal risk.` : ""}`;
    if (flags.document && flags.mortgage) return `${reporterName} has made this a formal written complaint, not a support request. The tenant faces a direct financial consequence — losing a mortgage offer — that ${clientName} will hold LightWork partially responsible for. ${requestCountMatch ? `${requestCountMatch[0]} previous requests have gone unresolved.` : "Multiple previous requests have gone unanswered."} ${clientName}'s trust in Felicity's ability to handle admin workflows is eroding.`;
    if (isExec) return `${reporterName} (${reporterTitle}) has engaged directly, which indicates this issue has already been discussed at ${clientName}'s leadership level before this message was sent. ${isRenewalImminent ? `With renewal ${renewalText} away, this is the worst possible moment for a relationship breakdown.` : ""} A delayed or junior response will confirm their concerns rather than resolve them.`;
    if (flags.platform) return `${clientName}${automationMatch ? ` has seen their automation rate drop from ${automationMatch[0]}` : " is experiencing platform-wide delivery failures"}. ${unresolvedMatch ? `${unresolvedMatch[0]} unresolved queries` : "A growing backlog"} means their team is manually handling work the platform should be automating. The core value proposition of LightWork is being undermined in real time.`;
    return `${reporterName} has raised a formal issue that requires a structured response. ${clientName} expects acknowledgement within the SLA window${isSeniorRole ? ` — ${reporterTitle} will be monitoring the response closely` : ""}. ${isRenewalImminent ? `Renewal in ${renewalText} makes timely resolution commercially important.` : ""}`;
  })();

  // ── Dynamic tenant impact ────────────────────────────────────────────────────
  const tenantImpact = (() => {
    if (flags.co) {
      const location = flags.floorInfo ? ` on the ${flags.floorInfo}` : "";
      const vuln = flags.vulnerable ? " The tenant has been described as elderly and living alone" : "";
      const engineer = (flags.noEngineer || context.toLowerCase().includes("no engineer")) ? " No engineer has been dispatched." : "";
      return `The tenant${location} may still be in a property with an active carbon monoxide alarm following incorrect guidance from Felicity.${vuln}.${engineer} Every minute without contact or evacuation increases the risk of serious harm and the legal exposure for all parties.`;
    }
    if (flags.gdpr) return `A tenant at ${clientName} has had their personal data — ${text.toLowerCase().includes("rent") ? "name, phone number, and outstanding rent balance" : "personal details"} — exposed to another resident. They are aware of the breach and have threatened regulatory action. Their trust in ${clientName}'s data handling has been broken.`;
    if (flags.document && flags.mortgage) {
      const tenantName = text.match(/Mr\.?\s+\w+|Ms\.?\s+\w+|Mrs\.?\s+\w+/) ? text.match(/Mr\.?\s+\w+|Ms\.?\s+\w+|Mrs\.?\s+\w+/)[0] : "The tenant";
      return `${tenantName}${flatMatch ? ` in ${flatMatch[0]}` : ""} faces losing a mortgage offer if this document is not delivered today. ${requestCountMatch ? `They have made ${requestCountMatch[0]} requests` : "Multiple requests have been made"}, each time being told someone will follow up. The financial consequence of further delay is direct and measurable.`;
    }
    if (flags.platform && unresolvedMatch) return `Tenants across ${clientName}'s portfolio are waiting for responses that Felicity is failing to deliver. With ${unresolvedMatch[0]} queries unresolved, frustration is increasing and tenants are likely beginning to contact the property management team directly — adding to ${clientName}'s operational burden.`;
    return `Tenant experience is being directly affected by this issue. Continued delays risk complaints being escalated beyond ${clientName} to the property manager or building owner.`;
  })();

  // ── Executive summary ────────────────────────────────────────────────────────
  const executiveSummary = (() => {
    if (flags.co) return `A${flags.vulnerable ? "n elderly" : ""} tenant${flags.floorInfo ? ` on the ${flags.floorInfo}` : ""} at ${clientName} remains in a property after a carbon monoxide alarm was triggered. Felicity provided incorrect guidance — advising the tenant to ventilate and wait rather than evacuate. No engineer has been dispatched. ${reporterName} (${reporterTitle}) has contacted the office directly, having lost confidence in the platform's handling. This incident creates simultaneous safety, legal, and reputational exposure for both ${clientName} and LightWork AI. Immediate human intervention is required.`;
    if (flags.gdpr) return `A GDPR data breach has occurred at ${clientName}. A tenant received Felicity-generated communication containing another tenant's personal and financial data. ${flags.repeated ? "This is the second such incident in recent weeks, indicating a systemic issue rather than an isolated fault." : ""} ${reporterName} (${reporterTitle}) has threatened ICO notification. The 72-hour notification window may have started. ${buildingMatch ? `${clientName} manages ${buildingMatch[0]}, and the full scope of the breach has not yet been determined.` : ""} Legal and engineering review is required immediately.`;
    if (flags.document && flags.mortgage) return `A tenant at ${clientName} is at risk of losing a mortgage offer due to an unresolved tenancy document request. ${requestCountMatch ? `${requestCountMatch[0].charAt(0).toUpperCase() + requestCountMatch[0].slice(1)} requests have been made` : "Multiple requests have been submitted"} through Felicity, each acknowledged but not actioned. ${reporterName} (${reporterTitle}) has escalated formally in writing. The mortgage deadline creates a hard time constraint — same-day resolution is required to prevent direct financial harm to the tenant and reputational damage to ${clientName}.`;
    if (isExec) return `${reporterName}, ${reporterTitle} at ${clientName}, has personally escalated a service concern to LightWork. ${arrValue ? `This is an ${arrValue} ARR account` : `This is a ${tierLabel || "key"} account`}${isRenewalImminent ? ` with renewal due in ${renewalText}` : ""}. ${flags.churnRisk ? "Language in the escalation indicates active consideration of cancelling or pausing the rollout." : "The escalation indicates that confidence in the platform is declining at a leadership level."} A senior CS response is required today to stabilise the relationship before the renewal conversation.`;
    if (flags.platform) return `${clientName} is experiencing a platform-level failure affecting Felicity's ability to respond to tenant queries. ${automationMatch ? `Automation rate has dropped from ${automationMatch[0]}.` : ""} ${unresolvedMatch ? `${unresolvedMatch[0]} queries are currently unresolved.` : ""} ${reporterName} (${reporterTitle}) has escalated formally. The root cause has not been identified. Engineering investigation is required to restore service and determine whether other accounts are affected.`;
    return `${reporterName} (${reporterTitle}) at ${clientName} has raised a service issue requiring structured CS response. ${arrValue ? `This is a ${arrValue} ARR account` : ""}${isRenewalImminent ? ` with renewal in ${renewalText}` : ""}. Priority is ${severity} with SLA of ${sla.split("·")[0].trim()}.`;
  })();

  // ── Suggested customer response — fully dynamic ──────────────────────────────
  const suggestedResponse = (() => {
    const firstName = reporterName.split(" ")[0];
    const urgencyLine = severity === "P0" ? "We are treating this as a Priority 0 incident and have escalated it immediately to our most senior team." : severity === "P1" ? "We are treating this as a high-priority incident and have escalated it to our CS Lead immediately." : "We have logged this and assigned it to the right team for same-day follow-up.";

    let bodyLine = "";
    if (flags.co) bodyLine = `We are attempting to contact the tenant directly to confirm they have evacuated the property, and we are coordinating an urgent engineering response. In parallel, we are reviewing the guidance Felicity provided — if it was incorrect, that will be escalated to our product and engineering teams as a critical incident. A senior incident manager has been assigned and we will provide you with a full update within 30 minutes.`;
    else if (flags.gdpr) bodyLine = `We have notified our Data Protection Officer and have begun an immediate investigation into how this occurred and the scope of data affected. We understand the seriousness of this — protecting your tenants' data is a fundamental responsibility and we take this breach very seriously. We will provide you with a full incident report within 24 hours and keep you updated as our investigation progresses.`;
    else if (flags.document && flags.mortgage) bodyLine = `I have personally escalated this to ensure the tenancy agreement is retrieved and sent to the tenant today — I will not route this back through the standard queue. Please ask the tenant to expect it by ${new Date(Date.now()+4*3600000).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} at the latest. I will confirm directly with you once it has been sent.`;
    else if (isExec) bodyLine = `I hear your frustration and I want to be direct with you: the experience you have described is not the standard we hold ourselves to. I would like to speak with you personally this week — not to explain what went wrong, but to show you what we are doing to fix it. I am clearing time in my calendar and will send you a meeting request within the hour.`;
    else if (flags.platform) bodyLine = `Our engineering team is investigating the root cause now. ${automationMatch ? `We are aware that your automation rate has dropped and understand the manual burden this is creating for your team.` : ""} I will update you every 30 minutes until service is restored and will send a full incident report once we have a root cause confirmed.`;
    else bodyLine = `I have assigned this to the right team and they will be in touch with you directly within the SLA window. If you need to speak with someone before then, please reply to this message and I will arrange a call.`;

    return `Hi ${firstName},

Thank you for raising this${severity === "P0" || severity === "P1" ? " — I want to personally acknowledge receipt and let you know this is being handled urgently" : ""}.

${urgencyLine}

${bodyLine}

Kind regards,
[Your name]
Customer Success, LightWork AI`;
  })();

  // ── Follow-up checklist ──────────────────────────────────────────────────────
  const checklist = [];
  if (flags.co) {
    checklist.push(`Call ${reporterName} directly — do not rely on written communication for P0 safety incidents`);
    checklist.push("Confirm tenant has evacuated and emergency services have been contacted");
    checklist.push("Escalate Felicity's AI response to Product and Engineering as a critical AI behaviour incident");
    checklist.push("Begin internal incident log — document timeline of events");
  }
  if (flags.gdpr) {
    checklist.push("Notify DPO within 1 hour — 72-hour ICO window may have started");
    checklist.push(`Identify full scope — how many tenants' data was exposed and across how many properties`);
    checklist.push("Prepare draft ICO breach notification");
    checklist.push("Freeze any automated messaging to affected tenants until root cause is confirmed");
  }
  if (flags.document && flags.mortgage) {
    checklist.push("Retrieve tenancy agreement from system immediately — do not re-route through Felicity");
    checklist.push(`Send directly to ${reporterName} and confirm receipt`);
    checklist.push("Document mortgage deadline in CRM and set reminder");
  }
  if (isExec || flags.churnRisk) {
    checklist.push(`CS Lead to make direct contact with ${reporterName} today`);
    checklist.push("Prepare account health summary before any call");
    if (isRenewalImminent) checklist.push(`Flag renewal risk to leadership — ${renewalText} window`);
  }
  if (flags.platform) {
    checklist.push("Check deployment logs and correlate with any recent releases");
    checklist.push(`Quantify affected tenant count and undelivered messages at ${clientName}`);
    checklist.push("Check whether other accounts on same infrastructure are affected");
  }
  checklist.push(`Log escalation in CRM against ${clientName}`);
  checklist.push(`Send acknowledgement to ${reporterName} within SLA: ${sla.split("·")[0].trim()}`);
  checklist.push("Schedule follow-up to confirm full resolution");

  // ── Immediate actions ────────────────────────────────────────────────────────
  const actions = [];
  if (severity === "P0") actions.push(`Call ${reporterName} immediately — ${reporterTitle} level contact requires direct phone response, not email`);
  if (flags.co) actions.push("Escalate Felicity's CO response to Engineering and Product — log as critical AI behaviour incident");
  if (flags.gdpr) actions.push("Notify DPO now and begin formal GDPR breach assessment");
  if (isExec || flags.churnRisk) actions.push(`CS Lead or VP to contact ${reporterName} directly today — prepare account health summary first`);
  if (flags.document && flags.mortgage) actions.push("Retrieve and send tenancy agreement today — bypass Felicity, send manually");
  if (flags.platform) actions.push("Engineering to investigate root cause — check deployment logs and message queue health");
  actions.push(`Create ${ROUTING_DESTINATIONS[teamId]?.ticketSystem || "CRM"} ticket and post to ${ROUTING_DESTINATIONS[teamId]?.channel || "#cs-escalations"}`);
  actions.push(`Send client acknowledgement to ${reporterName} within SLA window`);

  const dest = ROUTING_DESTINATIONS[teamId] || ROUTING_DESTINATIONS.cs;

  return {
    severity, severityReason, sla,
    confidenceScore, confidenceReason,
    riskCategory, team, additionalTeams,
    signals,
    routingJustification,
    customerImpact, tenantImpact,
    businessRisk,
    executiveSummary,
    suggestedResponse,
    checklist, actions,
    clientReply: suggestedResponse,
    internalSlack: `🚨 ESCALATION — ${severity} | ${riskCategory} | Confidence: ${confidenceScore}%
${"─".repeat(52)}
CLIENT: ${clientName}${tierLabel ? " | " + tierLabel : ""}${arrValue ? " | " + arrValue : ""}${renewalText ? " | Renewal: " + renewalText : ""}
REPORTED BY: ${reporter || "Unknown"}
TRIAGED: ${now}
ROUTE TO: ${team.label}${additionalTeams.length ? " + " + additionalTeams.join(", ") : ""}
SLA: ${sla}

EXECUTIVE SUMMARY:
${executiveSummary}

SEVERITY RATIONALE:
${severityReason} (${confidenceScore}% confidence)

WHY THIS WAS CLASSIFIED ${severity}:
${signals.map(s => "• " + s).join("\n")}

BUSINESS RISK:
${businessRisk}

CUSTOMER IMPACT:
${customerImpact}

TENANT IMPACT:
${tenantImpact}

IMMEDIATE ACTIONS:
${actions.map((a, i) => (i+1) + ". " + a).join("\n")}

FOLLOW-UP CHECKLIST:
${checklist.map(c => "☐ " + c).join("\n")}

INTERNAL CONTEXT:
${context || "None provided"}

⚠ All P0/P1 outputs must be reviewed by CS Lead before action is taken.`,
    timestamp: now, flags, dest
  };
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
    const check = isUnrecognisedInput(form.issue);
    if (check.bad) { setError(check.reason); return; }
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

              {/* Severity + Confidence header */}
              <div style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 12, padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: sev.text, padding: "3px 10px", background: sev.border + "33", borderRadius: 20, border: `1px solid ${sev.border}` }}>{SEV_COLOR[result.severity].label}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{result.riskCategory}</span>
                      <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: "#0f172a", border: "1px solid #334155", color: result.confidenceScore >= 90 ? "#4ade80" : result.confidenceScore >= 80 ? "#fcd34d" : "#94a3b8" }}>
                        {result.confidenceScore}% confidence
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 6 }}>{result.severityReason}</div>
                    <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>{result.confidenceReason}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>SLA</div>
                    <div style={{ fontSize: 12, color: sev.text, fontWeight: 600 }}>{result.sla.split("·")[0].trim()}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{result.timestamp}</div>
                  </div>
                </div>
              </div>

              {/* Why this was classified */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 12 }}>Why this was classified {result.severity}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {result.signals.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px", background: "#0f172a", borderRadius: 7, border: "1px solid #1e293b" }}>
                      <span style={{ color: sev.text, fontSize: 12, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Executive summary */}
              <div style={{ background: "#0a0f1a", border: `1px solid ${sev.border}44`, borderRadius: 12, padding: "16px 18px", borderLeft: `3px solid ${sev.border}` }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Executive summary</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.7, fontWeight: 400 }}>{result.executiveSummary}</div>
              </div>

              {/* Impact grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Customer impact</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{result.customerImpact}</div>
                </div>
                <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Tenant impact</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{result.tenantImpact}</div>
                </div>
              </div>

              {/* Business risk assessment */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 10 }}>Business risk assessment</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {result.dest && [
                    form.arr && { label: "ARR", val: form.arr },
                    form.tier && { label: "Tier", val: form.tier },
                    form.renewal && { label: "Renewal", val: form.renewal },
                  ].filter(Boolean).map((m, i) => (
                    <div key={i} style={{ padding: "4px 10px", background: "#0f172a", borderRadius: 6, border: "1px solid #1e293b" }}>
                      <span style={{ fontSize: 10, color: "#475569" }}>{m.label}: </span>
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{m.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{result.businessRisk}</div>
              </div>

              {/* Routing + justification */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 14 }}>Routing justification</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Object.entries(result.routingJustification).map(([teamName, reasons]) => (
                    <div key={teamName} style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 7 }}>{teamName}</div>
                      {reasons.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}>
                          <span style={{ color: "#475569", fontSize: 11, flexShrink: 0, marginTop: 2 }}>•</span>
                          <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ padding: "10px 12px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b" }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Send to</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        { label: "Channel", val: result.dest.channel },
                        { label: "Ticket", val: result.dest.ticketSystem },
                        { label: "Owner", val: result.dest.escalateTo },
                      ].map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#475569", width: 52, flexShrink: 0 }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: r.label === "Channel" ? "DM Mono, monospace" : "inherit" }}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, borderTop: "1px solid #1e293b", paddingTop: 8 }}>{result.dest.action}</div>
                  </div>
                </div>
              </div>

              {/* Immediate actions */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: .6, fontWeight: 500, marginBottom: 12 }}>Immediate actions</div>
                {result.actions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: i === 0 ? sev.border + "44" : "#1e293b", border: `1px solid ${i === 0 ? sev.border : "#334155"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: i === 0 ? sev.text : "#64748b", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: i === 0 ? "#e2e8f0" : "#cbd5e1", lineHeight: 1.55, fontWeight: i === 0 ? 500 : 400 }}>{a}</span>
                  </div>
                ))}
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
                    {[{ id: "client", label: "Suggested customer response" }, { id: "slack", label: "Internal escalation" }].map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ fontSize: 12, padding: "8px 14px", border: "none", borderBottom: tab === t.id ? `2px solid ${sev.border}` : "2px solid transparent", background: "transparent", color: tab === t.id ? "#e2e8f0" : "#475569", cursor: "pointer", fontWeight: tab === t.id ? 600 : 400, marginBottom: -1 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <CopyBtn getText={() => tab === "client" ? editableReply : editableSlack} label={tab === "client" ? "Copy response" : "Copy escalation"} />
                </div>
                {tab === "client" && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>Dynamically generated from the specific details of this escalation. Edit before sending — do not send P0/P1 without CS Lead review.</div>
                    <textarea value={editableReply} onChange={e => setEditableReply(e.target.value)}
                      style={{ width: "100%", minHeight: 220, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                )}
                {tab === "slack" && (
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>Edit below — tag owners before posting to {result.dest.channel}</div>
                    <textarea value={editableSlack} onChange={e => setEditableSlack(e.target.value)}
                      style={{ width: "100%", minHeight: 300, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#cbd5e1", lineHeight: 1.75, resize: "vertical", fontFamily: "DM Mono, monospace", boxSizing: "border-box" }} />
                  </div>
                )}
              </div>

              {/* AI notice */}
              <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>
                  <strong style={{ color: "#64748b" }}>How AI automates this: </strong>
                  The triage engine reads unstructured escalation text and in under one second detects risk signals, classifies severity with a confidence score, generates dynamic impact statements and an executive summary that directly reference the specific client, reporter, ARR, renewal window, and issue details — not generic templates. Every output is specific to this escalation. A task that takes a CS manager 20–30 minutes is reduced to a single click. <strong style={{ color: "#64748b" }}>All P0 and P1 outputs must be reviewed before sending.</strong>
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
