import { PlaygroundPage } from './pages/playground-page';
import { createDocsApp } from './bootstrap';

const app = createDocsApp(document.querySelector<HTMLElement>('docs-app')!, { resources: [PlaygroundPage] });
void app.start();
