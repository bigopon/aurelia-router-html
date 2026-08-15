import AureliaDefault, * as aurelia from 'aurelia';
import * as expressionParser from '@aurelia/expression-parser';
import * as kernel from '@aurelia/kernel';
import * as metadata from '@aurelia/metadata';
import * as runtime from '@aurelia/runtime';
import * as runtimeHtml from '@aurelia/runtime-html';
import * as templateCompiler from '@aurelia/template-compiler';
import * as router from '../../../router/index';
import { createPlaygroundRouting } from './memory-routing';

export const runtimePackages: Record<string, Record<string, unknown>> = {
  aurelia: { ...aurelia, default: AureliaDefault },
  '@aurelia/expression-parser': expressionParser,
  '@aurelia/kernel': kernel,
  '@aurelia/metadata': metadata,
  '@aurelia/runtime': runtime,
  '@aurelia/runtime-html': runtimeHtml,
  '@aurelia/template-compiler': templateCompiler,
  'aurelia-v2-router-html': { ...router, Routing: createPlaygroundRouting() },
};
