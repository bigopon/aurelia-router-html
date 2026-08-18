interface PagefindWindow extends Window {
  PagefindUI?: new (options: { element: string; showImages: boolean; showSubResults: boolean }) => unknown;
}

export function enableSearch(): void {
  const element = document.querySelector<HTMLElement>('#pagefind-search');
  if (element == null) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/pagefind/pagefind-ui.css';
  document.head.append(stylesheet);

  const script = document.createElement('script');
  script.src = '/pagefind/pagefind-ui.js';
  script.onload = () => {
    const PagefindUI = (window as PagefindWindow).PagefindUI;
    if (PagefindUI != null) {
      new PagefindUI({ element, showImages: false, showSubResults: false });
      enableResultKeyboardNavigation(element);
    }
  };
  document.head.append(script);
}

function enableResultKeyboardNavigation(element: HTMLElement): void {
  const getInput = () => element.querySelector<HTMLInputElement>('.pagefind-ui__search-input');
  const getResults = () => Array.from(element.querySelectorAll<HTMLAnchorElement>('.pagefind-ui__result-link'));

  element.addEventListener('keydown', event => {
    const input = getInput();
    const results = getResults();
    const activeResult = document.activeElement instanceof HTMLAnchorElement
      ? results.indexOf(document.activeElement)
      : -1;

    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      results[Math.min(activeResult + 1, results.length - 1)].focus();
      return;
    }

    if (event.key === 'ArrowUp' && activeResult >= 0) {
      event.preventDefault();
      (activeResult === 0 ? input : results[activeResult - 1])?.focus();
      return;
    }

    if (event.key === 'Enter' && document.activeElement === input && results.length > 0) {
      event.preventDefault();
      results[0].click();
    }
  }, true);
}
