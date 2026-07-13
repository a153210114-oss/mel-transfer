(function () {
  const pageKey = document.body && document.body.dataset.sitePage;
  const main = document.querySelector('main');
  if (!pageKey || !main) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bodyHtml(value) {
    return escapeHtml(value).replace(/\n+/g, '<br>');
  }

  function safeHref(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(\/|https:\/\/www\.huabanapp\.com\/)/.test(raw)) return raw;
    return '';
  }

  function renderGenericPage(content) {
    if (!content || !content.pageTitle) return;
    const sections = Array.isArray(content.sections) ? content.sections : [];
    const ctaHref = safeHref(content.ctaHref);
    document.title = `${content.pageTitle} - 华伴`;
    main.innerHTML = `
      <header>
        <img src="assets/brand/huaban-logo-v1.png" alt="华伴">
        <div>
          <h1>${escapeHtml(content.pageTitle)}</h1>
          <p>${escapeHtml(content.updatedLabel || content.pageSubtitle || '')}</p>
        </div>
      </header>
      <div class="card">
        <p>${bodyHtml(content.pageIntro || content.pageSubtitle || '')}</p>
        ${ctaHref && content.ctaText ? `<a class="btn" href="${escapeHtml(ctaHref)}">${escapeHtml(content.ctaText)}</a>` : ''}
      </div>
      ${sections.map(section => `
        <h2>${escapeHtml(section.title)}</h2>
        <p>${bodyHtml(section.body)}</p>
      `).join('')}
      <p><a href="/">返回官网</a></p>
    `;
  }

  function applyDownloadPage(content) {
    if (!content || !content.pageTitle) return false;
    const title = document.querySelector('[data-download-title]');
    const lead = document.querySelector('[data-download-lead]');
    const note = document.querySelector('[data-download-note]');
    const primary = document.querySelector('[data-download-primary]');
    const sections = Array.isArray(content.sections) ? content.sections : [];
    if (title) title.textContent = content.pageTitle;
    if (lead) lead.textContent = content.pageIntro || content.pageSubtitle || '';
    if (note && content.pageSubtitle) note.textContent = content.pageSubtitle;
    if (primary && content.ctaText) primary.textContent = content.ctaText;
    sections.forEach((section, index) => {
      const card = document.querySelector(`[data-download-section="${index}"]`);
      if (!card) return;
      const h2 = card.querySelector('h2');
      const p = card.querySelector('p');
      if (h2 && section.title) h2.textContent = section.title;
      if (p && section.body) p.textContent = section.body;
    });
    document.title = `${content.pageTitle}｜华伴`;
    return true;
  }

  fetch(`/api/site-content?page=${encodeURIComponent(pageKey)}`, { cache: 'no-store' })
    .then(res => res.ok ? res.json() : null)
    .then(json => {
      const content = json && json.content;
      if (!content) return;
      if (pageKey === 'app_download' && applyDownloadPage(content)) return;
      renderGenericPage(content);
    })
    .catch(() => {});
})();
