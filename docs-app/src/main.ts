import { PlaygroundPage } from './pages/playground-page';
import { createDocsApp } from './bootstrap';
import { enableSearch } from './search';

const app = createDocsApp(document.querySelector<HTMLElement>('docs-app')!, { resources: [PlaygroundPage] });
void Promise.resolve(app.start()).then(enableSearch);
