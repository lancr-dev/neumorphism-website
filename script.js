(() => {
  'use strict';

  function initializeNavigation() {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('[data-nav-toggle]');
    const navigation = document.getElementById('primary-navigation');
    const drawer = document.getElementById('navigation-drawer');
    const closeButton = document.querySelector('[data-nav-close]');

    // Keep anchor destinations below the sticky header, including at high zoom.
    if (header) {
      const updateHeaderHeight = () => {
        document.documentElement.style.setProperty(
          '--header-height',
          `${header.offsetHeight}px`,
        );
      };
      updateHeaderHeight();
      new ResizeObserver(updateHeaderHeight).observe(header);
    }

    if (
      !header ||
      !toggle ||
      !navigation ||
      !drawer ||
      !closeButton ||
      typeof drawer.showModal !== 'function' ||
      header.hasAttribute('data-nav-ready')
    ) {
      return;
    }

    // Matches the desktop navigation breakpoint in style.css.
    const desktopQuery = window.matchMedia('(min-width: 64rem)');
    const firstLink = navigation.querySelector('a[href]');
    const navigationSlot = document.createComment('Desktop navigation');
    navigation.before(navigationSlot);

    function closeDrawer() {
      drawer.close();
      toggle.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('nav-open');
    }

    function synchronizeLayout() {
      const focusedElement = document.activeElement;
      const focusWasInDrawer = drawer.contains(focusedElement);

      closeDrawer();

      // Share one navigation so links and current-section state stay in sync.
      if (desktopQuery.matches) {
        navigationSlot.after(navigation);
      } else {
        drawer.append(navigation);
      }

      // Move focus away from controls hidden by the new layout.
      if (
        desktopQuery.matches &&
        (focusedElement === toggle || focusWasInDrawer)
      ) {
        firstLink?.focus({ preventScroll: true });
      } else if (!desktopQuery.matches && navigation.contains(focusedElement)) {
        toggle.focus({ preventScroll: true });
      }
    }

    toggle.addEventListener('click', () => {
      if (!desktopQuery.matches) {
        drawer.showModal();
        toggle.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('nav-open');
      }
    });

    navigation.addEventListener('click', (event) => {
      const link = event.target.closest("a[href^='#']");

      if (!link || desktopQuery.matches || event.defaultPrevented) {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = document.getElementById(link.hash.slice(1));

      if (!target) return;

      closeDrawer();

      // Preserve native anchor scrolling and browser history.
      // Move focus out of the collapsed navigation.
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');

        target.addEventListener(
          'blur',
          () => target.removeAttribute('tabindex'),
          { once: true },
        );
      }

      target.focus({ preventScroll: true });
    });

    closeButton.addEventListener('click', closeDrawer);

    drawer.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDrawer();
    });

    drawer.addEventListener('close', () => {
      if (drawer.open) return;
      toggle.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('nav-open');
    });

    function isBackdrop(event) {
      const bounds = drawer.getBoundingClientRect();
      return (
        event.target === drawer &&
        (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom)
      );
    }

    let pointerStartedOnBackdrop = false;
    drawer.addEventListener('pointerdown', (event) => {
      pointerStartedOnBackdrop = isBackdrop(event);
    });
    drawer.addEventListener('click', (event) => {
      if (pointerStartedOnBackdrop && isBackdrop(event)) closeDrawer();
      pointerStartedOnBackdrop = false;
    });

    desktopQuery.addEventListener('change', synchronizeLayout);

    toggle.hidden = false;
    header.setAttribute('data-nav-ready', '');

    synchronizeLayout();
  }

  function initializeSectionHighlighting() {
    const navigation = document.getElementById('primary-navigation');
    const sections = Array.from(document.querySelectorAll('main > section'));

    if (
      !navigation ||
      !sections.length ||
      navigation.hasAttribute('data-tracking-ready')
    ) {
      return;
    }

    const links = Array.from(navigation.querySelectorAll("a[href^='#']"));

    const header = document.querySelector('.site-header');

    let framePending = false;
    let previousSection;

    function updateCurrentSection() {
      framePending = false;

      const threshold = header ? header.offsetHeight + 24 : 24;

      let currentSection = sections[0];

      for (const section of sections) {
        if (section.getBoundingClientRect().top > threshold) {
          break;
        }

        currentSection = section;
      }

      if (currentSection === previousSection) return;

      previousSection = currentSection;

      for (const link of links) {
        if (currentSection.id && link.hash === `#${currentSection.id}`) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    }

    function scheduleUpdate() {
      if (framePending) return;

      framePending = true;
      window.requestAnimationFrame(updateCurrentSection);
    }

    window.addEventListener('scroll', scheduleUpdate, {
      passive: true,
    });

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);

    navigation.setAttribute('data-tracking-ready', '');

    updateCurrentSection();
  }

  function initializePlayground() {
    const form = document.getElementById('playground-form');

    if (!form || form.hasAttribute('data-playground-ready')) {
      return;
    }

    const controls = form.querySelector('[data-playground-controls]');
    const surface = document.getElementById('playground-surface');
    const surfaceStyle = document.getElementById('surface-style');
    const previewLabel = document.getElementById('surface-preview-label');

    const generatedCode = document.getElementById('generated-css');
    const notice = document.querySelector('[data-playground-notice]');
    const copyButton = document.querySelector('[data-copy-css]');
    const copyStatus = document.getElementById('copy-status');

    const rangeSettings = [
      {
        id: 'shadow-distance',
        property: '--preview-distance',
        fallback: 10,
      },
      {
        id: 'shadow-blur',
        property: '--preview-blur',
        fallback: 20,
      },
      {
        id: 'corner-radius',
        property: '--preview-radius',
        fallback: 32,
      },
    ].map((setting) => ({
      ...setting,
      input: document.getElementById(setting.id),
      output: document.getElementById(`${setting.id}-output`),
    }));

    if (
      !controls ||
      !surface ||
      !surfaceStyle ||
      !previewLabel ||
      !generatedCode
    ) {
      return;
    }

    if (rangeSettings.some(({ input, output }) => !input || !output)) {
      return;
    }

    // Use the stylesheet's colors so exported CSS matches the preview.
    const surfaceTokens = window.getComputedStyle(surface);

    const colors = {
      background:
        surfaceTokens.getPropertyValue('--color-surface').trim() || '#e6eaf0',
      dark: surfaceTokens.getPropertyValue('--shadow-dark').trim() || '#c4c7cc',
      light:
        surfaceTokens.getPropertyValue('--shadow-light').trim() || '#f8fbff',
    };

    let copyInProgress = false;

    function setCopyStatus(message, state = 'success') {
      if (!copyStatus) return;

      copyStatus.textContent = message;
      copyStatus.dataset.state = state;
    }

    function readRange({ input, fallback }) {
      const value = input.valueAsNumber;
      const minimum = Number(input.min);
      const maximum = Number(input.max);

      const bounded = Math.min(
        maximum,
        Math.max(minimum, Number.isFinite(value) ? value : fallback),
      );

      const normalized = Math.round(bounded);

      input.value = String(normalized);

      return normalized;
    }

    function renderSurface() {
      const [distance, blur, radius] = rangeSettings.map((setting) => {
        const value = readRange(setting);

        setting.output.value = `${value} px`;

        setting.input.setAttribute('aria-valuetext', `${value} pixels`);

        surface.style.setProperty(setting.property, `${value}px`);

        return value;
      });

      const style = surfaceStyle.value === 'inset' ? 'inset' : 'raised';

      const inset = style === 'inset' ? 'inset ' : '';

      surfaceStyle.value = style;
      surface.dataset.surfaceStyle = style;

      previewLabel.textContent =
        style === 'inset' ? 'Inset surface' : 'Raised surface';

      generatedCode.textContent = [
        `/* Use on a matching ${colors.background} background. */`,
        '.soft-surface {',
        `  background: ${colors.background};`,
        `  border-radius: ${radius}px;`,
        '  box-shadow:',
        `    ${inset}${distance}px ${distance}px ${blur}px ${colors.dark},`,
        `    ${inset}-${distance}px -${distance}px ${blur}px ${colors.light};`,
        '}',
      ].join('\n');

      setCopyStatus('');
    }

    function selectCodeForManualCopy() {
      // Never report success when automatic copying is unavailable.
      const selection = window.getSelection();

      if (!selection) {
        setCopyStatus(
          'Automatic copying is unavailable. Select the CSS and copy it manually.',
          'error',
        );

        return;
      }

      generatedCode.parentElement.focus({
        preventScroll: true,
      });

      const range = document.createRange();

      range.selectNodeContents(generatedCode);

      selection.removeAllRanges();
      selection.addRange(range);

      setCopyStatus(
        "CSS selected. Press Ctrl+C or Command+C, or use your device's Copy action.",
        'error',
      );
    }

    async function copyCss() {
      if (copyInProgress) return;

      const snapshot = generatedCode.textContent;

      if (!window.isSecureContext || !navigator.clipboard?.writeText) {
        selectCodeForManualCopy();
        return;
      }

      copyInProgress = true;

      copyButton.setAttribute('aria-disabled', 'true');
      copyButton.setAttribute('aria-busy', 'true');

      setCopyStatus('Copying CSS…');

      try {
        await navigator.clipboard.writeText(snapshot);

        setCopyStatus(
          snapshot === generatedCode.textContent
            ? 'CSS copied. Paste it into your stylesheet.'
            : 'Earlier settings copied. Copy again for your current settings.',
        );
      } catch {
        selectCodeForManualCopy();
      } finally {
        copyInProgress = false;

        copyButton.removeAttribute('aria-disabled');
        copyButton.removeAttribute('aria-busy');
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });

    form.addEventListener('input', renderSurface);

    surfaceStyle.addEventListener('change', renderSurface);

    form.addEventListener('reset', (event) => {
      // Restore controls and preview together without reset timing races.
      event.preventDefault();

      for (const { input } of rangeSettings) {
        input.value = input.defaultValue;
      }

      const defaultOption = Array.from(surfaceStyle.options).find(
        (option) => option.defaultSelected,
      );

      surfaceStyle.value = defaultOption?.value || 'raised';

      renderSurface();
    });

    renderSurface();

    controls.disabled = false;

    if (notice) {
      notice.hidden = true;
    }

    form.removeAttribute('aria-describedby');

    if (copyButton && copyStatus) {
      copyButton.addEventListener('click', copyCss);
      copyButton.hidden = false;
    }

    form.setAttribute('data-playground-ready', '');
  }

  function initialize() {
    initializeNavigation();
    initializeSectionHighlighting();
    initializePlayground();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, {
      once: true,
    });
  } else {
    initialize();
  }
})();
