/**
 * SURAKSHA Centralized Global Multilingual i18n System
 * Handles translation loading, DOM updating, dynamic interpolation, RTL support, and persistence.
 */

const I18n = {
  currentLang: 'en',
  supportedLanguages: ['en', 'hi', 'ur', 'gu', 'mr'],
  translationsCache: {},
  isLoaded: false,

  async init() {
    const saved = localStorage.getItem('suraksha_lang');
    if (saved && this.supportedLanguages.includes(saved)) {
      this.currentLang = saved;
    } else {
      this.currentLang = 'en';
    }

    // Load initial language
    await this.loadLanguage(this.currentLang);

    // Render selector if not present
    this.renderSelector();

    // Apply translations to DOM
    this.applyTranslations();

    // Also observe DOM changes for newly added dynamic elements
    this.observeDOM();
  },

  async loadLanguage(lang) {
    if (this.translationsCache[lang]) {
      return this.translationsCache[lang];
    }

    try {
      const response = await fetch(`/translations/${lang}.json?v=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${lang}`);
      }
      const data = await response.json();
      this.translationsCache[lang] = data;
      return data;
    } catch (err) {
      console.warn(`[i18n] Error loading /translations/${lang}.json, falling back to en:`, err);
      if (lang !== 'en' && !this.translationsCache['en']) {
        await this.loadLanguage('en');
      }
      return this.translationsCache['en'] || {};
    }
  },

  async setLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) return;
    this.currentLang = lang;
    localStorage.setItem('suraksha_lang', lang);

    await this.loadLanguage(lang);
    this.applyTranslations();

    // Dispatch global languageChanged event for dynamic JS controllers
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { lang, t: this.t.bind(this) }
    }));
  },

  t(keyPath, params = {}) {
    if (!keyPath) return '';
    const currentDict = this.translationsCache[this.currentLang] || this.translationsCache['en'] || {};
    const fallbackDict = this.translationsCache['en'] || {};

    let value = this._getByPath(currentDict, keyPath);
    if (value === undefined || value === null) {
      value = this._getByPath(fallbackDict, keyPath);
    }

    if (value === undefined || value === null) {
      return keyPath; // fallback to key
    }

    if (typeof value === 'string' && params && typeof params === 'object') {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value;
  },

  _getByPath(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = curr[part];
      } else {
        return undefined;
      }
    }
    return curr;
  },

  applyTranslations() {
    const lang = this.currentLang;
    const isRTL = lang === 'ur';

    // Set document direction and language
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    if (isRTL) {
      document.body.classList.add('rtl-layout');
    } else {
      document.body.classList.remove('rtl-layout');
    }

    // 1. Elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.innerHTML = translation;
      }
    });

    // 2. Input and textarea placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.placeholder = translation;
      }
    });

    // 3. Tooltips and titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.title = translation;
      }
    });

    // 4. Aria labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.setAttribute('aria-label', translation);
      }
    });

    // 5. Submit button values
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      const translation = this.t(key);
      if (translation && translation !== key) {
        el.value = translation;
      }
    });

    // 6. Automatic translation for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes('dashboard')) link.textContent = this.t('nav.dashboard');
      else if (href.includes('map')) link.textContent = this.t('nav.map');
      else if (href.includes('report.html')) link.textContent = this.t('nav.report');
      else if (href.includes('reports.html')) link.textContent = this.t('nav.reports');
      else if (href.includes('safety')) link.textContent = this.t('nav.safety');
      else if (href.includes('profile')) link.textContent = this.t('nav.profile');
    });

    // 7. Mobile navigation bar items
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const textSpan = link.querySelector('span:last-child');
      if (textSpan) {
        if (href.includes('dashboard')) textSpan.textContent = this.t('nav.home');
        else if (href.includes('map')) textSpan.textContent = this.t('nav.map');
        else if (href.includes('report.html')) textSpan.textContent = this.t('nav.report');
        else if (href.includes('reports.html')) textSpan.textContent = this.t('nav.history');
      }
    });

    // 8. Sync dropdown selectors
    document.querySelectorAll('.lang-select-input').forEach(sel => {
      sel.value = lang;
    });

    // 9. Sync pill buttons
    document.querySelectorAll('.btn-lang-pill').forEach(btn => {
      if (btn.getAttribute('data-lang') === lang) {
        btn.style.backgroundColor = 'var(--info-blue, #2563EB)';
        btn.style.color = '#FFFFFF';
        btn.style.borderColor = 'var(--info-blue, #2563EB)';
        btn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.35)';
      } else {
        btn.style.backgroundColor = '#FFFFFF';
        btn.style.color = 'var(--navy-800, #1E293B)';
        btn.style.borderColor = 'var(--slate-300, #CBD5E1)';
        btn.style.boxShadow = 'none';
      }
    });
  },

  renderSelector() {
    const navActions = document.querySelector('.nav-actions') || document.querySelector('header .container') || document.querySelector('.navbar');
    if (!navActions) return;

    if (!document.getElementById('quick-lang-buttons-bar')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'quick-lang-buttons-bar';
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '3px';
      wrapper.style.background = 'rgba(255, 255, 255, 0.95)';
      wrapper.style.border = '1px solid var(--slate-300, #CBD5E1)';
      wrapper.style.borderRadius = 'var(--radius-full, 9999px)';
      wrapper.style.padding = '3px 6px';
      wrapper.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';

      wrapper.innerHTML = `
        <span style="font-size: 13px; margin: 0 3px 0 2px;" title="Language / زبان / भाषा">🌐</span>
        <button type="button" class="btn-lang-pill" data-lang="en" onclick="I18n.setLanguage('en')" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid var(--slate-300, #CBD5E1); background: #FFFFFF; cursor: pointer; transition: all 0.2s;">EN</button>
        <button type="button" class="btn-lang-pill" data-lang="hi" onclick="I18n.setLanguage('hi')" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid var(--slate-300, #CBD5E1); background: #FFFFFF; cursor: pointer; transition: all 0.2s;">हिन्दी</button>
        <button type="button" class="btn-lang-pill" data-lang="ur" onclick="I18n.setLanguage('ur')" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid var(--slate-300, #CBD5E1); background: #FFFFFF; cursor: pointer; transition: all 0.2s;">اردو</button>
        <button type="button" class="btn-lang-pill" data-lang="gu" onclick="I18n.setLanguage('gu')" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid var(--slate-300, #CBD5E1); background: #FFFFFF; cursor: pointer; transition: all 0.2s;">ગુજરાતી</button>
        <button type="button" class="btn-lang-pill" data-lang="mr" onclick="I18n.setLanguage('mr')" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; border: 1px solid var(--slate-300, #CBD5E1); background: #FFFFFF; cursor: pointer; transition: all 0.2s;">मराठी</button>
      `;

      navActions.prepend(wrapper);
    }
  },

  observeDOM() {
    // Avoid double attaching
    if (this._observerAttached) return;
    this._observerAttached = true;

    // Throttle translation re-application on dynamic DOM changes
    let timeout = null;
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.applyTranslations();
        }, 80);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
};

// Global helper alias
window.I18n = I18n;
window.t = (keyPath, params) => I18n.t(keyPath, params);

// Auto-initialize when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
  I18n.init();
}
