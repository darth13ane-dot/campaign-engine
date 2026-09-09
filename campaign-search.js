(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const definitions = { characters: "character", quests: "quest", locations: "location", journal: "journal", sessions: "session", arcs: "arc" };
  const labels = { character: "Character", quest: "Quest", location: "World", journal: "Journal", session: "Session", prep: "Session prep", arc: "Story arc", note: "Live note", reference: "Reference" };
  const terms = query => [...new Set(String(query || "").toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [])];
  const plain = value => String(value || "").replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/\s+/g, " ").trim();
  function excerpt(text, query, length = 280) {
    const value = plain(text), lower = value.toLocaleLowerCase();
    const positions = terms(query).map(term => lower.indexOf(term)).filter(n => n >= 0);
    const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 70);
    return `${start ? "…" : ""}${value.slice(start, start + length)}${start + length < value.length ? "…" : ""}`;
  }
  function documentPages(document) {
    return Array.isArray(document.pageTexts) && document.pageTexts.length ? document.pageTexts : [{ page: null, text: document.text || "" }];
  }
  function buildIndex(campaign, { playerPreview = false, visible = () => !playerPreview } = {}) {
    const entries = [];
    for (const [collection, type] of Object.entries(definitions)) {
      if (playerPreview && type === "arc") continue;
      for (const record of campaign[collection] || []) {
        if (playerPreview && !visible(record, collection)) continue;
        const fields = [record.description, record.detail, record.body, record.recap, record.tension, record.change, record.nextStep, ...(record.tags || []), ...(record.directions || []), ...(record.milestones || [])];
        if (!playerPreview) fields.push(record.voice, record.quirks, record.relationships, record.statBlock);
        entries.push({ type, title: record.name || record.title, id: record.archivistId || record.localId || record.id, text: fields.filter(Boolean).join(" ") });
      }
    }
    if (!playerPreview) {
      const rows = value => Array.isArray(value) ? value.filter(item => item && typeof item === "object") : [];
      for (const [key, prep] of Object.entries(campaign.sessionWorkflow?.preps || {})) {
        if (!prep || typeof prep !== "object") continue;
        const fields = [prep.opening,
          ...rows(prep.scenes).flatMap(scene => [scene.title, scene.detail, scene.question]),
          ...rows(prep.revelations).map(item => item.text),
          ...rows(prep.spotlights).flatMap(item => [item.character, item.opportunity]),
          ...rows(prep.tasks).map(item => item.text),
          ...rows(prep.pinned).map(item => item.name),
          ...rows(prep.clocks).map(item => item.label)];
        entries.push({ type: "prep", title: prep.sessionRef?.name || "Session prep", prepId: prep.id || key, text: fields.filter(Boolean).join(" ") });
      }
      for (const desk of Object.values(campaign.sessionWorkflow?.desks || {})) {
        if (desk.scratch) entries.push({ type: "note", title: `${desk.sessionRef.name} · Scratchpad`, deskId: desk.id, text: desk.scratch });
        for (const note of desk.log || []) entries.push({ type: "note", title: `${desk.sessionRef.name} · Log`, deskId: desk.id, noteId: note.id, text: note.text });
      }
      for (const document of campaign.documents || []) for (const page of documentPages(document)) entries.push({ type: "reference", title: document.title, documentId: document.id, page: page.page, text: page.text });
    }
    return entries.map(entry => ({ ...entry, haystack: `${entry.title} ${entry.text}`.toLocaleLowerCase() }));
  }
  function search(index, query, { type = "all", limit = 30 } = {}) {
    const words = terms(query);
    if (!words.length) return { total: 0, results: [] };
    const matches = index.filter(entry => (type === "all" || entry.type === type) && words.every(word => entry.haystack.includes(word)))
      .map(entry => ({ ...entry, score: words.reduce((score, word) => score + (entry.title.toLocaleLowerCase().includes(word) ? 10 : 1), 0) }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || (a.page || 0) - (b.page || 0));
    return { total: matches.length, results: matches.slice(0, limit).map(entry => ({ ...entry, excerpt: excerpt(entry.text, query) })) };
  }
  function referencePassages(campaign, query, { limit = 6, budget = 10000 } = {}) {
    const words = terms(query).filter(word => word.length > 2);
    const candidates = [];
    for (const document of campaign.documents || []) {
      if (!document.contextEnabled) continue;
      for (const page of documentPages(document)) {
        const value = plain(page.text);
        for (let start = 0; start < value.length; start += 900) {
          const text = value.slice(start, start + 1200), lower = text.toLocaleLowerCase();
          const score = words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
          if (!words.length || score) candidates.push({ title: document.title, documentId: document.id, page: page.page, text, score, start });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.start - b.start);
    const selected = [];
    let used = 0;
    for (const candidate of candidates) {
      if (selected.length >= limit || used + candidate.text.length > budget) break;
      if (selected.some(p => p.documentId === candidate.documentId && p.page === candidate.page && Math.abs(p.start - candidate.start) < 1200)) continue;
      selected.push(candidate); used += candidate.text.length;
    }
    return selected;
  }
  return { labels, terms, excerpt, documentPages, buildIndex, search, referencePassages };
});
