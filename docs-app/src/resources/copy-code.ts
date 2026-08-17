export function addCopyButton(element: HTMLElement, source: string): void {
  const sourceLayer = element.ownerDocument.createElement('code');
  sourceLayer.className = 'copy-code-source';
  while (element.firstChild != null) {
    sourceLayer.append(element.firstChild);
  }
  element.append(sourceLayer);

  const button = element.ownerDocument.createElement('button');
  const window = element.ownerDocument.defaultView;
  let resetTimer: number | undefined;
  button.type = 'button';
  button.className = 'copy-code-button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code');
  button.setAttribute('aria-live', 'polite');
  button.addEventListener('click', () => {
    void copyText(element.ownerDocument, source.trim()).then(
      () => showResult('Copied', 'Code copied', 'is-copy-confirmed'),
      () => showResult('Could not copy', 'Could not copy code', 'is-copy-failed'),
    );
  });

  const showResult = (text: string, label: string, className: string): void => {
    if (resetTimer !== undefined && window != null) {
      window.clearTimeout(resetTimer);
    }
    button.classList.remove('is-copy-confirmed', 'is-copy-failed');
    void button.offsetWidth;
    button.classList.add(className);
    button.textContent = text;
    button.setAttribute('aria-label', label);
    if (window != null) {
      resetTimer = window.setTimeout(() => {
        button.classList.remove('is-copy-confirmed', 'is-copy-failed');
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code');
        resetTimer = undefined;
      }, 3_000);
    }
  };

  if (window == null) {
    button.addEventListener('blur', () => {
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code');
    });
  }
  element.classList.add('has-copy-button');
  element.append(button);
}

async function copyText(document: Document, value: string): Promise<void> {
  const clipboard = document.defaultView?.navigator.clipboard;
  if (clipboard != null) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Fall through for hosts where Clipboard exists but is not permitted.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('The browser did not copy the code.');
  }
}

function showResult(button: HTMLButtonElement, text: string, label: string): void {
  button.textContent = text;
  button.setAttribute('aria-label', label);
}
