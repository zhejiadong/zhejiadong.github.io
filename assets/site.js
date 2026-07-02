(function () {
  const data = {
    ...(window.SITE_DATA || {}),
    home: window.HOME_DATA || window.SITE_DATA?.home || {},
    research: window.RESEARCH_DATA || window.SITE_DATA?.research || {},
    presentations: window.PRESENTATIONS_DATA || window.SITE_DATA?.presentations || {},
    teaching: window.TEACHING_DATA || window.SITE_DATA?.teaching || {}
  };
  const profile = data.profile || {};
  const site = data.site || {};
  const page = document.body.dataset.page;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseInlineMarkdown(text) {
    let html = escapeHtml(text);
    const tokens = [];
    const stash = replacement => {
      const token = `HERMESTOKEN${tokens.length}X`;
      tokens.push(replacement);
      return token;
    };

    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`));
    html = html.replace(/\[([^\]]+)\]\((mailto:[^\s)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\)/g, (_, label, email) => stash(`<a href="${email.startsWith('mailto:') ? email : `mailto:${email}`}">${label}</a>`));
    html = html.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`));
    html = html.replace(/(^|[\s(])((https?:\/\/[^\s<]+))/g, (_, prefix, url) => `${prefix}${stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)}`);
    html = html.replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_, prefix, email) => `${prefix}${stash(`<a href="mailto:${email}">${email}</a>`)}`);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return tokens.reduce((result, replacement, index) => result.replace(`HERMESTOKEN${index}X`, replacement), html);
  }

  function parseInlineCitation(text) {
    let html = escapeHtml(text);
    const tokens = [];
    const stash = replacement => {
      const token = `HERMESCITE${tokens.length}X`;
      tokens.push(replacement);
      return token;
    };

    html = html.replace(/\\\s*/g, '<br>');
    html = html.replace(/(Dong,\s*Zhejia|Dong,\s*Z\.)/g, '<strong>$1</strong>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">[${label}]</a>`));
    html = html.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">[${url}]</a>`));
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return tokens.reduce((result, replacement, index) => result.replace(`HERMESCITE${index}X`, replacement), html);
  }

  function renderParagraphs(selector, paragraphs) {
    const target = qs(selector);
    if (!target || !Array.isArray(paragraphs)) return;
    target.innerHTML = paragraphs.map(text => `<p>${text}</p>`).join('');
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraphLines = [];
    let listType = null;
    let listItems = [];

    function flushParagraph() {
      if (!paragraphLines.length) return;
      const text = paragraphLines.join(' ').trim();
      if (text) html.push(`<p>${parseInlineMarkdown(text)}</p>`);
      paragraphLines = [];
    }

    function flushList() {
      if (!listType || !listItems.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      html.push(`<${tag}>${listItems.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
      listType = null;
      listItems = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${parseInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
      if (unorderedMatch) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(unorderedMatch[1]);
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(orderedMatch[1]);
        continue;
      }

      if (listType) flushList();
      paragraphLines.push(line);
    }

    flushParagraph();
    flushList();
    return html.join('');
  }

  async function renderMarkdownFile(selector, path, fallbackParagraphs) {
    const target = qs(selector);
    if (!target) return;

    if (!path) {
      renderParagraphs(selector, fallbackParagraphs || []);
      return;
    }

    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();
      target.innerHTML = markdownToHtml(markdown);
    } catch (error) {
      console.warn(`Failed to load markdown from ${path}:`, error);
      renderParagraphs(selector, fallbackParagraphs || []);
    }
  }

  function renderProfileIcon(text) {
    const key = (text || '').toLowerCase();
    const icons = {
      'providence, ri': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-6-5.33-6-11a6 6 0 1 1 12 0c0 5.67-6 11-6 11Zm0-8.25a2.75 2.75 0 1 0 0-5.5a2.75 2.75 0 0 0 0 5.5Z"/></svg></span>',
      'email': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.75 6.75h16.5A1.5 1.5 0 0 1 21.75 8.25v7.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Zm0 1.9v.2l8.25 4.95l8.25-4.95v-.2H3.75Z"/></svg></span>',
      'twitter': '<span class="profile-link-icon profile-link-icon--text" aria-hidden="true">𝕏</span>',
      'github': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.76-.24.76-.54v-2.08c-3.1.68-3.75-1.32-3.75-1.32c-.5-1.27-1.22-1.61-1.22-1.61c-1-.69.08-.68.08-.68c1.11.08 1.7 1.14 1.7 1.14c.98 1.69 2.58 1.2 3.21.92c.1-.72.39-1.2.7-1.48c-2.48-.28-5.09-1.24-5.09-5.52c0-1.22.44-2.22 1.14-3c-.11-.28-.49-1.43.11-2.98c0 0 .94-.3 3.08 1.14a10.69 10.69 0 0 1 5.6 0c2.14-1.44 3.07-1.14 3.07-1.14c.61 1.55.23 2.7.12 2.98c.71.78 1.14 1.78 1.14 3c0 4.29-2.61 5.24-5.1 5.51c.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z"/></svg></span>',
      'google scholar': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3L1.5 8.25L12 13.5l8.62-4.31v4.06h1.88V8.25L12 3Zm-6.75 8.92v3.58c0 1.8 3.02 3.25 6.75 3.25s6.75-1.45 6.75-3.25v-3.58L12 15.3l-6.75-3.38Z"/></svg></span>',
      'pubmed': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3.75h9A3.75 3.75 0 0 1 18.75 7.5v9A3.75 3.75 0 0 1 15 20.25H6A3.75 3.75 0 0 1 2.25 16.5v-9A3.75 3.75 0 0 1 6 3.75Zm1.5 4.5v7.5h1.5v-2.25h1.12c1.84 0 2.88-.97 2.88-2.62c0-1.73-1.1-2.63-2.95-2.63H7.5Zm1.5 1.2h.93c.99 0 1.54.45 1.54 1.43c0 .94-.52 1.42-1.52 1.42H9v-2.85Zm5.25-1.2v7.5h5.25v-1.27h-3.75v-1.98h3.15v-1.23h-3.15V9.52h3.75V8.25h-5.25Z"/></svg></span>',
      'linkedin': '<span class="profile-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.94 8.5H3.56V19.5h3.38V8.5ZM5.25 3a1.97 1.97 0 1 0 0 3.94a1.97 1.97 0 0 0 0-3.94ZM20.44 12.74c0-3.31-1.77-4.85-4.13-4.85c-1.9 0-2.75 1.04-3.23 1.78V8.5H9.7c.04.78 0 11 0 11h3.38v-6.14c0-.33.02-.65.12-.88c.26-.65.85-1.32 1.84-1.32c1.3 0 1.82.99 1.82 2.44v5.9h3.38v-6.76Z"/></svg></span>'
    };
    return icons[key] || '<span class="profile-link-icon" aria-hidden="true">•</span>';
  }

  function renderLinks(selector, links) {
    const target = qs(selector);
    if (!target || !Array.isArray(links)) return;
    target.innerHTML = links.map(item => {
      const text = item.text || item.label || '';
      const hasLabel = item.label && item.text && !item.plain;
      const icon = renderProfileIcon(text);
      if (item.href) {
        if (hasLabel) {
          return `<li>${icon}<span class="label">${item.label}:</span> <a href="${item.href}">${item.text}</a></li>`;
        }
        return `<li>${icon}<a href="${item.href}">${text}</a></li>`;
      }
      if (hasLabel) {
        return `<li>${icon}<span class="label">${item.label}:</span> ${item.text}</li>`;
      }
      return `<li>${icon}<span>${text}</span></li>`;
    }).join('');
  }

  function renderCardList(selector, items) {
    const target = qs(selector);
    if (!target || !Array.isArray(items)) return;
    target.classList.add('numbered-list');
    target.innerHTML = items.map(item => {
      if (typeof item === 'string') {
        return `
          <div class="info-card info-card--simple">
            <p class="info-card__plain">${parseInlineCitation(item)}</p>
          </div>
        `;
      }
      const linkedTitle = item.href
        ? `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || '')}</a>`
        : parseInlineMarkdown(item.title || '');
      return `
        <div class="info-card">
          ${item.meta ? `<div class="info-card__meta">${parseInlineMarkdown(item.meta)}</div>` : ''}
          <h4 class="info-card__title">${linkedTitle}</h4>
          ${item.body ? `<p class="info-card__body">${parseInlineMarkdown(item.body)}</p>` : ''}
          ${item.award ? `<p class="info-card__award">Award: ${parseInlineMarkdown(item.award)}</p>` : ''}
          ${item.note ? `<p class="info-card__note">${parseInlineMarkdown(item.note)}</p>` : ''}
          ${renderPills(item.tags)}
          ${renderActionLinks(item.links)}
        </div>
      `;
    }).join('');
  }

  function renderEducationList(selector, items) {
    const target = qs(selector);
    if (!target || !Array.isArray(items)) return;
    const listItems = items.map(item => {
      if (typeof item === 'string') {
        return `<li>${parseInlineMarkdown(item)}</li>`;
      }
      const parts = [item.degree, item.institution, item.years, item.details].filter(Boolean);
      return `<li>${parseInlineMarkdown(parts.join(', '))}</li>`;
    }).join('');
    target.innerHTML = `<ul class="simple-list">${listItems}</ul>`;
  }

  function renderLineList(selector, items) {
    const target = qs(selector);
    if (!target || !Array.isArray(items)) return;
    target.innerHTML = `<div class="simple-lines">${items.map(item => {
      if (typeof item === 'string') {
        return `<p class="simple-lines__item">${parseInlineMarkdown(item)}</p>`;
      }
      const parts = [item.title, item.body, item.note].filter(Boolean);
      return `<p class="simple-lines__item">${parseInlineMarkdown(parts.join(' '))}</p>`;
    }).join('')}</div>`;
  }

  function renderNewsList(selector, items) {
    const target = qs(selector);
    if (!target || !Array.isArray(items)) return;
    target.innerHTML = items.map(item => {
      if (typeof item === 'string') {
        return `
          <div class="news-item">
            <p class="news-item__lead">${parseInlineMarkdown(item)}</p>
          </div>
        `;
      }
      const details = Array.isArray(item.details) && item.details.length
        ? `<ul class="news-item__details">${item.details.map(detail => `<li>${parseInlineMarkdown(detail)}</li>`).join('')}</ul>`
        : '';
      const linkedTitle = item.href
        ? `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || '')}</a>`
        : parseInlineMarkdown(item.title || '');
      const label = item.label ? `<span class="news-item__label">[${escapeHtml(item.label)}]</span> ` : '';
      const title = item.title ? `${linkedTitle} ` : '';
      const body = parseInlineMarkdown(item.body || '');
      const date = item.date ? `<span class="news-item__date">${escapeHtml(item.date)}.</span> ` : '';
      return `
        <div class="news-item">
          <p class="news-item__lead">${date}${label}${title}${body}</p>
          ${details}
        </div>
      `;
    }).join('');
  }

  function renderPills(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return `<div class="pill-row">${tags.map(tag => `<span class="pill">${tag}</span>`).join('')}</div>`;
  }

  function renderActionLinks(links) {
    if (!Array.isArray(links) || !links.length) return '';
    return `<div class="link-row">${links.map(link => {
      const rawLabel = String(link.label || '').trim();
      const label = /^\[.*\]$/.test(rawLabel) ? rawLabel : `[${escapeHtml(rawLabel)}]`;
      return `<a href="${link.href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }).join('')}</div>`;
  }

  function renderPresentationList(selector, items) {
    const target = qs(selector);
    if (!target || !Array.isArray(items)) return;
    target.classList.add('numbered-list');
    let currentYear = null;
    target.innerHTML = items.map(item => {
      if (typeof item === 'string') {
        return `
          <div class="presentation-item presentation-item--simple">
            <p class="presentation-title">${parseInlineMarkdown(item)}</p>
          </div>
        `;
      }
      const yearHeader = item.year !== currentYear ? `<h3 class="presentation-year">[${item.year}]</h3>` : '';
      currentYear = item.year;
      const title = item.href
        ? `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || '')}</a>`
        : parseInlineMarkdown(item.title || '');
      const lineParts = [
        item.month ? `<span class="presentation-month">${escapeHtml(item.month)}</span>` : '',
        item.label ? `<span class="presentation-tag">[${escapeHtml(item.label)}]</span>` : '',
        item.location ? `${escapeHtml(item.location)}.` : ''
      ].filter(Boolean);
      const headingLine = [...lineParts, title].filter(Boolean).join(' ');
      return `
        ${yearHeader}
        <div class="presentation-item">
          ${headingLine ? `<p class="presentation-line">${headingLine}</p>` : ''}
          ${item.body ? `<p class="presentation-body">${parseInlineMarkdown(item.body)}</p>` : ''}
          ${item.award ? `<p class="presentation-award">Award: ${parseInlineMarkdown(item.award)}</p>` : ''}
          ${item.note ? `<p class="presentation-note">${parseInlineMarkdown(item.note)}</p>` : ''}
          ${renderActionLinks(item.links)}
        </div>
      `;
    }).join('');
  }

  function setProfile() {
    qsa('[data-profile-name]').forEach(el => el.textContent = profile.name || 'Your Name');
    qsa('[data-profile-title]').forEach(el => el.textContent = profile.shortTitle || 'Your title');
    qsa('[data-brand-name]').forEach(el => el.textContent = profile.brandName || profile.name || 'Your Name');
    qsa('[data-profile-photo]').forEach(el => {
      el.src = profile.photo || 'assets/images/avatar-placeholder.svg';
      el.alt = `${profile.name || 'Profile'} photo`;
    });
    renderLinks('[data-profile-links]', profile.links || []);
  }

  function setActiveNav() {
    qsa('[data-nav]').forEach(link => {
      if (link.dataset.nav === page) link.classList.add('is-active');
    });
  }

  function setFooter() {
    qsa('[data-site-footer]').forEach(el => {
      const owner = site.footerOwner || profile.name || 'Your Name';
      const footerPrefix = site.footerPrefix || 'Powered by';
      const footerLinks = Array.isArray(site.footerLinks) ? site.footerLinks.filter(link => link?.label && link?.href) : [];
      const linkedText = footerLinks.length
        ? footerLinks.map(link => `<a href="${link.href}" target="_blank" rel="noopener noreferrer">${link.label}</a>`).join(' & ')
        : '<a href="https://github.com/academicpages/academicpages.github.io" target="_blank" rel="noopener noreferrer">AcademicPages</a>';
      el.innerHTML = `© ${new Date().getFullYear()} ${owner}. ${footerPrefix} ${linkedText}.`;
    });
  }

  async function renderPage() {
    if (page === 'home') {
      await renderMarkdownFile('[data-home-intro]', data.home?.introMarkdownPath, data.home?.intro || []);
      renderEducationList('[data-education-list]', data.home?.education || []);
      renderNewsList('[data-news-list]', data.home?.news || []);
      renderNewsList('[data-awards-list]', data.home?.awards || []);
      renderNewsList('[data-service-list]', data.home?.service || []);
    }
    if (page === 'research') {
      await renderMarkdownFile('[data-research-overview]', data.research?.overviewMarkdownPath, data.research?.overview || []);
      renderCardList('[data-publication-list]', data.research?.publications || []);
      renderCardList('[data-project-list]', data.research?.projects || []);
    }
    if (page === 'presentations') {
      await renderMarkdownFile('[data-talks-overview]', data.presentations?.overviewMarkdownPath, data.presentations?.overview || []);
      renderPresentationList('[data-talk-list]', data.presentations?.talks || []);
    }
    if (page === 'teaching') {
      await renderMarkdownFile('[data-teaching-overview]', data.teaching?.overviewMarkdownPath, data.teaching?.overview || []);
      renderLineList('[data-course-list]', data.teaching?.courses || []);
    }
  }

  setProfile();
  setActiveNav();
  setFooter();
  renderPage();
})();