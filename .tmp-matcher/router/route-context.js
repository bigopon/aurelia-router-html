"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteContext = exports.IRouteContext = void 0;
const kernel_1 = require("@aurelia/kernel");
exports.IRouteContext = kernel_1.DI.createInterface('IRouteContext');
class RouteContext {
    constructor(parent, pattern = '*') {
        this.parent = parent;
        this.children = [];
        this.active = false;
        this.residue = '/';
        this.$path = '/';
        this.$params = Object.freeze({});
        this.pattern = '*';
        this._matcher = /^(?<rest__>\/.*|\/)?$/;
        this._subscriptions = new Set();
        this._disposed = false;
        this.usePattern(pattern);
    }
    usePattern(pattern) {
        this.pattern = normalizePattern(pattern);
        this._matcher = compilePattern(this.pattern);
    }
    apply(path) {
        if (this._disposed) {
            return;
        }
        const normalizedPath = normalizePath(path);
        this.$path = normalizedPath;
        this._matcher.lastIndex = 0;
        const match = this._matcher.exec(normalizedPath);
        if (match === null) {
            this._deactivateBranch(normalizedPath);
            return;
        }
        const groups = match.groups ?? {};
        const nextResidue = normalizeResidue(groups.rest__);
        const nextParams = freezeParams(extractParams(groups));
        const stateChanged = !this.active
            || this.residue !== nextResidue
            || !shallowEqual(this.$params, nextParams)
            || this.$path !== normalizedPath;
        this.active = true;
        this.residue = nextResidue;
        this.$params = nextParams;
        if (stateChanged) {
            this._notify();
        }
        for (const child of this.children) {
            child.apply(nextResidue);
        }
    }
    createChild(pattern) {
        const child = new RouteContext(this, pattern);
        this.children.push(child);
        child.apply(this.active ? this.residue : '/__inactive__');
        return child;
    }
    subscribe(callback) {
        this._subscriptions.add(callback);
        callback(this._currentState());
        return () => {
            this._subscriptions.delete(callback);
        };
    }
    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        while (this.children.length > 0) {
            this.children.pop().dispose();
        }
        this._subscriptions.clear();
        const parent = this.parent;
        if (parent instanceof RouteContext) {
            const index = parent.children.indexOf(this);
            if (index >= 0) {
                parent.children.splice(index, 1);
            }
        }
    }
    _deactivateBranch(path) {
        const stateChanged = this.active || this.residue !== '/' || Object.keys(this.$params).length > 0 || this.$path !== path;
        this.active = false;
        this.$path = path;
        this.residue = '/';
        this.$params = Object.freeze({});
        if (stateChanged) {
            this._notify();
        }
        for (const child of this.children) {
            child._deactivateBranch('/__inactive__');
        }
    }
    _notify() {
        const state = this._currentState();
        for (const callback of this._subscriptions) {
            callback(state);
        }
    }
    _currentState() {
        return {
            active: this.active,
            params: this.$params,
            residue: this.residue,
            path: this.$path,
        };
    }
}
exports.RouteContext = RouteContext;
function compilePattern(pattern) {
    if (pattern === '*') {
        return /^(?<rest__>\/.*|\/)?$/;
    }
    if (pattern === '/') {
        return /^\/$/;
    }
    const parts = pattern.split('/').filter(Boolean);
    const compiled = parts.map(part => {
        if (part.startsWith(':')) {
            const name = part.slice(1);
            return `(?<${escapeGroupName(name)}>[^/]+)`;
        }
        return escapeRegex(part);
    });
    return new RegExp(`^/${compiled.join('/')}(?<rest__>/.*)?$`);
}
function extractParams(groups) {
    const params = Object.create(null);
    for (const [key, value] of Object.entries(groups)) {
        if (key === 'rest__' || value == null) {
            continue;
        }
        params[key] = decodeURIComponent(value);
    }
    return params;
}
function freezeParams(params) {
    return Object.freeze(params);
}
function normalizePattern(pattern) {
    if (pattern === '*' || pattern === '/') {
        return pattern;
    }
    const trimmed = pattern.trim();
    if (trimmed === '') {
        return '/';
    }
    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
        ? withLeadingSlash.slice(0, -1)
        : withLeadingSlash;
}
function normalizePath(path) {
    if (path === '') {
        return '/';
    }
    let value = path.trim();
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(value)) {
        value = new URL(value).pathname;
    }
    if (!value.startsWith('/')) {
        value = `/${value}`;
    }
    value = value.replace(/\/{2,}/g, '/');
    return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
}
function normalizeResidue(value) {
    if (value == null || value === '') {
        return '/';
    }
    return normalizePath(value);
}
function shallowEqual(a, b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (const key of aKeys) {
        if (a[key] !== b[key]) {
            return false;
        }
    }
    return true;
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function escapeGroupName(value) {
    return value.replace(/[^A-Za-z0-9_]/g, '_');
}
