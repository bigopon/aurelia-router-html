import { type PartialBindableDefinition } from '@aurelia/runtime-html';
interface IStrippedHtml {
    html: string;
    deps: string[];
    depsAliases: AliasedModule;
    shadowMode: 'open' | 'closed' | null;
    containerless: boolean;
    hasSlot: boolean;
    bindables: Record<string, PartialBindableDefinition>;
    aliases: string[];
    capture: boolean;
}
type AliasedImports = Record<string, string | null> & {
    __MAIN__: string | null;
};
type AliasedModule = Record<string, AliasedImports>;
export declare function stripMetaData(rawHtml: string): IStrippedHtml;
export {};
//# sourceMappingURL=strip-meta-data.d.ts.map