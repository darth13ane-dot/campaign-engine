/* GM-authored player documents, with exact isolated preview before approval. */
let activePlayerPacketId = null;
let playerPacketSourceQuery = "";
let playerPacketSourceChoice = "";
let playerPacketError = "";
let playerPacketPreview = null;

function playerPacketCore() { return window.CampaignPlayerPacket; }
function packetEnsureSourceIds(campaign) {
  ensureCampaignPlanning(campaign);
  window.CampaignHistory.ensureIds(campaign);
}
function packetSourceChoices(campaign) {
  packetEnsureSourceIds(campaign);
  return playerPacketCore().sourceChoices(campaign);
}
function activePlayerPacket(campaign = activeCampaign()) {
  return campaign?.sessionWorkflow?.playerPackets?.[activePlayerPacketId] || null;
}
function closePlayerPacketPreview() {
  if (playerPacketPreview?.dialog.open) playerPacketPreview.dialog.close();
}
function openPlayerPacket(campaign, session, packetId) {
  if (playerPreviewActive() || !session || !playerPacketCore()) return;
  closePlayerPacketPreview();
  packetEnsureSourceIds(campaign);
  SESSION_WORKFLOW.ensureWorkflow(campaign);
  const packet = packetId ? playerPacketCore().findPacket(campaign, session, packetId) : playerPacketCore().ensurePacket(campaign, session);
  if (!packet) { showToast("That player packet is unavailable."); return; }
  activePlayerPacketId = packet.id;
  playerPacketSourceQuery = "";
  playerPacketSourceChoice = "";
  playerPacketError = "";
  currentView = "player-packet";
  saveState();
  render();
}
function packetValidation(campaign, packet) {
  try { return playerPacketCore().validatePacket(campaign, packet); }
  catch (error) { return { valid: false, approved: false, empty: true, errors: [{ message: error.message || "The packet could not be checked." }], redactions: 0 }; }
}
function packetChoices(campaign, query = playerPacketSourceQuery) {
  const search = query.trim().toLocaleLowerCase();
  return packetSourceChoices(campaign).filter(choice => !search || `${choice.title} ${choice.ref?.type || ""}`.toLocaleLowerCase().includes(search));
}
function packetSourceOptions(campaign) {
  const choices = packetChoices(campaign);
  return `<option value="">${choices.length ? "Choose a player-known record…" : "No matching player-known records"}</option>${choices.map(choice => `<option value="${esc(choice.key)}"${choice.key === playerPacketSourceChoice ? " selected" : ""}>${esc(ENTRY_TYPES[choice.ref?.type] || choice.ref?.type || "Record")} · ${esc(choice.title)}</option>`).join("")}`;
}
function packetSourcePreviewMarkup(campaign) {
  const choice = packetSourceChoices(campaign).find(item => item.key === playerPacketSourceChoice);
  return choice ? `<strong>${esc(choice.title)}</strong><p>${esc(choice.excerpt || "Open the copied section to review its text after adding it.")}</p>` : `<p>Choose a shared record to inspect the text available for this packet.</p>`;
}
function packetAlertMarkup(status) {
  const errors = Array.isArray(status.errors) ? status.errors.filter(error => error.code !== "empty") : [];
  if (!playerPacketError && !errors.length) return "";
  return `<div class="packet-alert" role="alert"><strong>Review before sharing</strong>${playerPacketError ? `<p>${esc(playerPacketError)}</p>` : ""}${errors.length ? `<ul>${errors.map(error => `<li>${esc(error.message || error)}</li>`).join("")}</ul>` : ""}</div>`;
}
function packetApprovalMarkup(status) {
  return `<div class="packet-approval-state ${status.approved ? "is-approved" : ""}"><strong>${status.approved ? "This version is approved" : "Preview & approve this version"}</strong><p>${status.approved ? "Download the approved player document below. Further edits require another review." : "Inspect the exact player document, then approve the version you want to share."}</p>${status.redactions ? `<p>${status.redactions} ${status.redactions === 1 ? "reference has" : "references have"} been replaced with a neutral notice in the player document. Inspect the preview before approval.</p>` : ""}</div><div class="packet-approval-actions"><button class="${status.approved ? "secondary-button" : "primary-button"}" type="button" data-packet-preview ${status.empty ? "disabled" : ""}>${status.approved ? "Preview player document" : "Preview for approval"}</button><div class="packet-downloads"><button class="secondary-button" type="button" data-packet-download="markdown" ${status.approved ? "" : "disabled"}>Markdown ↓</button><button class="secondary-button" type="button" data-packet-download="html" ${status.approved ? "" : "disabled"}>Printable HTML ↓</button></div></div>`;
}
function packetSectionMarkup(section, index, total, status) {
  const source = section.kind === "source";
  const errors = (status.errors || []).filter(error => error.sectionId === section.id);
  const redacted = errors.some(error => /permission|private|hidden|missing|unavailable|ambiguous|redact/i.test(`${error.code} ${error.message}`));
  const notices = errors.map(error => error.message || error);
  return `<article class="card packet-section" data-packet-section="${esc(section.id)}"><div class="packet-section-heading"><div><span class="packet-section-number">${String(index + 1).padStart(2, "0")} · ${source ? "Copied player-known record" : "Written for players"}</span><h3 data-packet-section-title>${esc(section.heading || "Untitled section")}</h3></div><div class="packet-section-actions"><button type="button" data-packet-move="${esc(section.id)}" data-packet-direction="-1" aria-label="Move section ${index + 1} up" title="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-packet-move="${esc(section.id)}" data-packet-direction="1" aria-label="Move section ${index + 1} down" title="Move down" ${index === total - 1 ? "disabled" : ""}>↓</button><button class="packet-remove" type="button" data-packet-remove="${esc(section.id)}" aria-label="Remove section ${index + 1}" title="Remove section">×</button></div></div>
    ${source ? `<div class="packet-section-source ${redacted ? "is-redacted" : notices.length ? "is-stale" : ""}"><p><strong>Copied from ${esc(section.sourceRef?.name || "a campaign record")}</strong><br />You can adapt this copy. Its source must remain player-known and current.</p><button class="secondary-button" type="button" data-packet-refresh-source="${esc(section.id)}">Refresh copy</button></div>` : ""}
    ${notices.map(notice => `<p class="packet-section-notice ${redacted ? "is-redacted" : ""}">${esc(notice)}</p>`).join("")}
    <label>Section heading<input data-packet-field="heading" data-packet-row="${esc(section.id)}" maxlength="240" value="${esc(section.heading || "")}" placeholder="A heading your players can see" /></label><label>Player-facing text<textarea data-packet-field="body" data-packet-row="${esc(section.id)}" rows="6" maxlength="20000" placeholder="Write the text exactly as you want the players to receive it.">${esc(section.body || "")}</textarea></label></article>`;
}
function playerPacketView(campaign) {
  if (playerPreviewActive()) return playerPreviewRestrictedView();
  const packet = activePlayerPacket(campaign);
  const session = packet && window.CampaignSessionPrep.findSession(campaign, packet.sessionRef);
  if (!packet || !session) return `<div class="empty-state"><h2>This player packet is unavailable.</h2><p>Choose a session to create or continue a player document.</p><button class="primary-button" type="button" data-view-jump="sessions">Back to sessions</button></div>`;
  const status = packetValidation(campaign, packet);
  const packets = playerPacketCore().packetsForSession(campaign, session);
  return `<div class="session-prep-page player-packet-page" data-player-packet-id="${esc(packet.id)}">
    ${header("Player packet", "PREPARE SOMETHING TO SHARE", "Assemble a recap, briefing, or handout. Review the player document before approving a download.", `<div class="packet-header-actions"><button class="secondary-button" type="button" data-packet-back>Session prep</button><button class="secondary-button" type="button" data-packet-preview ${status.empty ? "disabled" : ""}>Preview player document</button></div>`)}
    <p class="packet-introduction">Working with ${esc(session.title)}. The exported document contains the packet title and sections you assemble below.</p>
    <div class="packet-select-row"><label>Packet for this session<select data-packet-choice>${packets.map(item => `<option value="${esc(item.id)}"${item.id === packet.id ? " selected" : ""}>${esc(item.title || "Untitled player packet")}</option>`).join("")}</select></label><button class="secondary-button" type="button" data-packet-new>＋ New packet</button></div>
    <div data-packet-alert>${packetAlertMarkup(status)}</div>
    <div class="packet-layout"><div class="packet-editor"><section class="card packet-panel packet-title-panel"><p class="eyebrow">ON THE PLAYER DOCUMENT</p><h2>Title & ordered sections</h2><p class="packet-help">Write for your players. Choose every campaign record you include, and adapt its copied text for this document.</p><label>Packet title<input data-packet-field="title" maxlength="200" value="${esc(packet.title || "")}" placeholder="A neutral title for your players" /></label></section>
    <div class="packet-section-list">${packet.sections.length ? packet.sections.map((section, index) => packetSectionMarkup(section, index, packet.sections.length, status)).join("") : `<section class="packet-empty"><h2>Give your players something useful.</h2><p>Add a custom recap, briefing, or handout, or choose a record already marked “Players know.” Each section appears in the order you set here.</p></section>`}</div>
    <section class="card packet-panel"><form class="packet-add-form" data-packet-add-manual><label>Start a custom section<select name="kind"><option value="recap">Session recap</option><option value="briefing">Briefing</option><option value="handout">Handout or letter</option></select></label><button class="secondary-button" type="submit">＋ Add section</button></form></section></div>
    <aside class="packet-tools"><section class="card packet-panel"><p class="eyebrow">EXACT PLAYER VIEW</p><h2>Review & download</h2><div data-packet-approval>${packetApprovalMarkup(status)}</div><p class="packet-help" style="margin-top:14px">Approval covers the exact preview. Editing a section or changing its source requires another review.</p></section>
    <section class="card packet-panel"><p class="eyebrow">CHOOSE SHARED MATERIAL</p><h2>Add a campaign record</h2><form class="packet-source-form" data-packet-add-source><label>Find a player-known record<input type="search" data-packet-source-search value="${esc(playerPacketSourceQuery)}" placeholder="Search shared people, places, notes…" /></label><label>Record<select name="source" data-packet-source-choice required>${packetSourceOptions(campaign)}</select></label><button class="secondary-button" type="submit" data-packet-source-add-button ${playerPacketSourceChoice ? "" : "disabled"}>Add copied section</button></form><div class="packet-source-preview" data-packet-source-preview>${packetSourcePreviewMarkup(campaign)}</div><p class="packet-help">Available records are already marked “Players know.” Choosing one adds an editable copy to this packet.</p></section></aside></div>
  </div>`;
}

function packetEventContext(event) {
  if (playerPreviewActive()) return null;
  const page = event.target.closest("[data-player-packet-id]");
  const campaign = activeCampaign();
  const packet = activePlayerPacket(campaign);
  const session = packet && window.CampaignSessionPrep.findSession(campaign, packet.sessionRef);
  return page && packet && session && page.dataset.playerPacketId === packet.id ? { page, campaign, packet, session } : null;
}
function packetSaveChange(packet) {
  delete packet.approval;
  playerPacketError = "";
  saveState();
}
function packetApplyField(packet, field) {
  const key = field.dataset.packetField;
  const section = field.dataset.packetRow ? packet.sections.find(item => item.id === field.dataset.packetRow) : null;
  if (section ? !["heading", "body"].includes(key) : key !== "title") return false;
  const target = section || packet;
  if (target[key] === field.value) return false;
  target[key] = field.value;
  if (section) field.closest("[data-packet-section]").querySelector("[data-packet-section-title]").textContent = section.heading || "Untitled section";
  return true;
}
function packetFlushFields(context) {
  let changed = false;
  context.page.querySelectorAll("[data-packet-field]").forEach(field => { if (packetApplyField(context.packet, field)) changed = true; });
  if (changed) packetSaveChange(context.packet);
}
function packetUpdateControls(context) {
  const status = packetValidation(context.campaign, context.packet);
  context.page.querySelector("[data-packet-alert]").innerHTML = packetAlertMarkup(status);
  context.page.querySelector("[data-packet-approval]").innerHTML = packetApprovalMarkup(status);
  context.page.querySelectorAll("[data-packet-preview]").forEach(button => { button.disabled = status.empty; });
  const option = Array.from(context.page.querySelector("[data-packet-choice]").options).find(item => item.value === context.packet.id);
  if (option) option.textContent = context.packet.title || "Untitled player packet";
}
function packetFocusSection(id) {
  const section = Array.from(document.querySelectorAll("[data-packet-section]")).find(element => element.dataset.packetSection === id);
  section?.querySelector("textarea")?.focus();
}
function packetCurrentPreviewContext(preview) {
  if (playerPreviewActive()) throw new Error("Return to the GM editor to review this packet.");
  const campaign = activeCampaign();
  if (campaign.id !== preview.campaignId) throw new Error("The campaign changed. Return to the editor and open a fresh preview.");
  const packet = campaign.sessionWorkflow?.playerPackets?.[preview.packetId];
  if (!packet) throw new Error("This packet is unavailable. Return to the editor.");
  return { campaign, packet };
}
function packetPreviewNeedsRefresh(preview, message) {
  preview.dialog.querySelector("[data-packet-preview-approve]").disabled = true;
  preview.dialog.querySelector("[data-packet-preview-status]").textContent = message;
  // Remove the old document immediately; replacing srcdoc waits for iframe navigation.
  preview.dialog.querySelector("iframe")?.remove();
  if (!preview.dialog.querySelector(".packet-preview-replacement")) {
    const replacement = document.createElement("div");
    replacement.className = "packet-preview-replacement";
    replacement.innerHTML = '<h1>Preview needs refreshing</h1><p>Return to the packet editor and open a fresh preview of the current document.</p>';
    preview.dialog.appendChild(replacement);
  }
}
function openPlayerPacketPreview(campaign, packet) {
  if (playerPreviewActive()) return;
  try {
    const status = packetValidation(campaign, packet);
    const projected = playerPacketCore().previewPacket(campaign, packet);
    const html = playerPacketCore().previewHTML(campaign, packet);
    closePlayerPacketPreview();
    const dialog = document.createElement("dialog");
    dialog.className = "packet-preview-dialog";
    dialog.setAttribute("aria-label", "Exact player document preview");
    dialog.innerHTML = `<div class="packet-preview-controls"><span>Player document preview</span><div class="packet-preview-control-actions"><button type="button" data-packet-preview-close>Return to editor</button><button type="button" class="packet-preview-approve" data-packet-preview-approve ${!status.valid || status.empty ? "disabled" : ""}>${status.approved ? "Approve this version again" : "Approve this packet"}</button></div></div><p class="packet-preview-status" data-packet-preview-status aria-live="polite"></p><iframe title="Player document" sandbox=""></iframe>`;
    const preview = { dialog, campaignId: campaign.id, packetId: packet.id, fingerprint: projected.fingerprint, observer: null };
    playerPacketPreview = preview;
    dialog.querySelector("iframe").srcdoc = html;
    if (!status.valid) dialog.querySelector("[data-packet-preview-status]").textContent = "Review the notices in the editor before approving this document.";
    dialog.querySelector("[data-packet-preview-close]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-packet-preview-approve]").addEventListener("click", () => {
      try {
        const current = packetCurrentPreviewContext(preview);
        const approved = playerPacketCore().approvePacket(current.campaign, current.packet, preview.fingerprint);
        current.campaign.sessionWorkflow.playerPackets[approved.id] = approved;
        playerPacketError = "";
        saveState();
        dialog.close();
        render();
        showToast("Player packet approved. Its downloads are ready.");
      } catch (error) { packetPreviewNeedsRefresh(preview, error.message || "The packet changed. Open a fresh preview before approving it."); }
    });
    dialog.addEventListener("close", () => {
      preview.observer?.disconnect();
      if (playerPacketPreview === preview) playerPacketPreview = null;
      dialog.remove();
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    preview.observer = new MutationObserver(() => {
      if (!dialog.open) return;
      try {
        const current = packetCurrentPreviewContext(preview);
        const latest = playerPacketCore().previewPacket(current.campaign, current.packet);
        if (latest.fingerprint !== preview.fingerprint) packetPreviewNeedsRefresh(preview, "The packet or its source permissions changed. Open a fresh preview before approval.");
      } catch (error) { packetPreviewNeedsRefresh(preview, error.message || "The source changed. Open a fresh preview."); }
    });
    preview.observer.observe(document.querySelector("#viewRoot"), { childList: true, subtree: true });
  } catch (error) {
    playerPacketError = error.message || "The player document could not be previewed.";
    render();
  }
}
function downloadPlayerPacket(campaign, packet, format) {
  if (playerPreviewActive()) return;
  const content = format === "html" ? playerPacketCore().exportHTML(campaign, packet) : playerPacketCore().exportMarkdown(campaign, packet);
  const projected = playerPacketCore().previewPacket(campaign, packet);
  const name = String(projected.title || "Player packet").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 90) || "Player packet";
  const blob = new Blob([content], { type: format === "html" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.${format === "html" ? "html" : "md"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(format === "html" ? "Printable player document downloaded." : "Player Markdown document downloaded.");
}

const playerPacketRoot = document.querySelector("#viewRoot");
playerPacketRoot.addEventListener("input", event => {
  const context = packetEventContext(event);
  if (!context) return;
  const field = event.target.closest("[data-packet-field]");
  if (field && packetApplyField(context.packet, field)) {
    packetSaveChange(context.packet);
    packetUpdateControls(context);
  }
  if (event.target.matches("[data-packet-source-search]")) {
    playerPacketSourceQuery = event.target.value;
    if (!packetChoices(context.campaign).some(choice => choice.key === playerPacketSourceChoice)) playerPacketSourceChoice = "";
    context.page.querySelector("[data-packet-source-choice]").innerHTML = packetSourceOptions(context.campaign);
    context.page.querySelector("[data-packet-source-preview]").innerHTML = packetSourcePreviewMarkup(context.campaign);
    context.page.querySelector("[data-packet-source-add-button]").disabled = !playerPacketSourceChoice;
  }
});
playerPacketRoot.addEventListener("change", event => {
  const context = packetEventContext(event);
  if (!context) return;
  if (event.target.matches("[data-packet-choice]")) { packetFlushFields(context); openPlayerPacket(context.campaign, context.session, event.target.value); return; }
  if (event.target.matches("[data-packet-source-choice]")) {
    playerPacketSourceChoice = event.target.value;
    context.page.querySelector("[data-packet-source-preview]").innerHTML = packetSourcePreviewMarkup(context.campaign);
    context.page.querySelector("[data-packet-source-add-button]").disabled = !packetSourceChoices(context.campaign).some(choice => choice.key === playerPacketSourceChoice);
    return;
  }
  const field = event.target.closest("[data-packet-field]");
  if (field && packetApplyField(context.packet, field)) { packetSaveChange(context.packet); packetUpdateControls(context); }
});
playerPacketRoot.addEventListener("click", event => {
  const context = packetEventContext(event);
  const button = event.target.closest("button");
  if (!context || !button) return;
  packetFlushFields(context);
  const action = ["back", "new", "preview", "download", "move", "remove", "refresh-source"].find(value => button.hasAttribute(`data-packet-${value}`));
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const { campaign, packet, session } = context;
  if (action === "back") { openSessionPrep(campaign, session); return; }
  if (action === "preview") { openPlayerPacketPreview(campaign, packet); return; }
  try {
    if (action === "new") {
      const count = playerPacketCore().packetsForSession(campaign, session).length;
      const next = playerPacketCore().createPacket(campaign, session, { title: `Player packet ${count + 1}` });
      openPlayerPacket(campaign, session, next.id);
      return;
    }
    if (action === "download") { downloadPlayerPacket(campaign, packet, button.dataset.packetDownload); return; }
    let focusId = null;
    if (action === "move") {
      const index = packet.sections.findIndex(section => section.id === button.dataset.packetMove);
      const next = index + (button.dataset.packetDirection === "-1" ? -1 : 1);
      if (index < 0 || next < 0 || next >= packet.sections.length) return;
      [packet.sections[index], packet.sections[next]] = [packet.sections[next], packet.sections[index]];
      focusId = packet.sections[next].id;
    } else if (action === "remove") packet.sections = packet.sections.filter(section => section.id !== button.dataset.packetRemove);
    else if (action === "refresh-source") {
      const index = packet.sections.findIndex(section => section.id === button.dataset.packetRefreshSource);
      if (index < 0 || packet.sections[index].kind !== "source") return;
      if (!confirm("Replace this section with the current player-known record? This overwrites the copied heading and text, including your edits.")) return;
      packetEnsureSourceIds(campaign);
      packet.sections[index] = playerPacketCore().refreshSourceSection(campaign, packet.sections[index]);
      focusId = packet.sections[index].id;
    }
    packetSaveChange(packet);
    render();
    if (focusId) packetFocusSection(focusId);
  } catch (error) { playerPacketError = error.message || "The packet could not be updated."; packetUpdateControls(context); }
}, true);
playerPacketRoot.addEventListener("submit", event => {
  if (!event.target.matches("[data-packet-add-manual], [data-packet-add-source]")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const context = packetEventContext(event);
  if (!context) return;
  packetFlushFields(context);
  try {
    let section;
    if (event.target.matches("[data-packet-add-manual]")) {
      const headings = { recap: "Session recap", briefing: "Briefing", handout: "Handout" };
      section = playerPacketCore().createManualSection({ heading: headings[event.target.elements.kind.value] || "Handout", body: "" });
    } else {
      const choice = packetSourceChoices(context.campaign).find(item => item.key === event.target.elements.source.value);
      if (!choice) throw new Error("Choose an available player-known record before adding it.");
      section = playerPacketCore().createSourceSection(context.campaign, choice.ref);
      playerPacketSourceChoice = "";
    }
    context.packet.sections.push(section);
    packetSaveChange(context.packet);
    render();
    packetFocusSection(section.id);
  } catch (error) { playerPacketError = error.message || "The section could not be added."; packetUpdateControls(context); }
}, true);
