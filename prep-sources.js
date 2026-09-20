(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignPrepSources = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const rows = value => Array.isArray(value) ? value.filter(object) : [];
  const identity = value => typeof value === "string" && value.length > 0 && value.length <= 160 ? value : "";
  const validPage = value => Number.isSafeInteger(value) && value > 0;
  const pageFields = value => value?.type === "reference" ? { page: value.page === null ? null : validPage(value.page) ? value.page : 0 } : {};
  function reference(value) {
    return { type: "reference", id: identity(value?.id), name: String(value?.name || value?.title || "PDF reference").slice(0, 200), ...pageFields({ ...value, type: "reference" }) };
  }
  function key(value) {
    const ref = reference(value);
    return `reference:id:${ref.id}:page:${ref.page === null ? "legacy" : ref.page}`;
  }
  function pageRecord(document, page) {
    const notice = page.page === null ? "Legacy extraction · page unavailable" : `PDF page ${page.page}`;
    return { id: document.id, page: page.page, title: `${String(document.title || "Untitled PDF").slice(0, 160)} · ${notice}`, body: typeof page.text === "string" ? page.text : "", referenceType: "pdf" };
  }
  function pages(document) {
    if (document.pageTexts != null && !Array.isArray(document.pageTexts)) return [];
    if (Array.isArray(document.pageTexts) && document.pageTexts.length) return rows(document.pageTexts).filter(page => validPage(page.page));
    return typeof document.text === "string" ? [{ page: null, text: document.text }] : [];
  }
  function resolve(campaign, value) {
    if (value?.type !== "reference" || !identity(value.id) || !(validPage(value.page) || value.page === null)) return null;
    const documents = rows(campaign?.documents).filter(document => document.id === value.id);
    if (documents.length !== 1) return null;
    const matching = pages(documents[0]).filter(page => page.page === value.page);
    return matching.length === 1 ? pageRecord(documents[0], matching[0]) : null;
  }
  function listRecords(campaign, query = "") {
    const search = String(query || "").trim().toLocaleLowerCase(), documents = rows(campaign?.documents), ids = new Map();
    for (const document of documents) ids.set(document.id, (ids.get(document.id) || 0) + 1);
    return documents.filter(document => identity(document.id) && ids.get(document.id) === 1).flatMap(document => {
      const candidates = pages(document), numbers = new Map();
      for (const page of candidates) numbers.set(page.page, (numbers.get(page.page) || 0) + 1);
      return candidates.filter(page => numbers.get(page.page) === 1).map(page => pageRecord(document, page))
        .filter(record => !search || `${record.title} reference pdf ${record.body}`.toLocaleLowerCase().includes(search))
        .map(record => ({ ref: reference(record), record }));
    });
  }
  return { reference, key, resolve, listRecords };
});
