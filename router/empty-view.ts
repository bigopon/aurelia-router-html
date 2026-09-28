import { CustomElementDefinition } from '@aurelia/runtime-html';

export const emptyRouteViewDefinition = CustomElementDefinition.create({
  name: 'au-empty-route-view',
  template: null,
  needsCompile: false,
});
