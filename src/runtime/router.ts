import type { GlyApp, GlyStd } from "@gamely/gly-types";

export type AcaiRouterInternalString = '@error' | '@error/not-found' | '@splash';
export type AcaiRouterString = `/${string}`;
export type AcaiRouterPageStep = JSX.Element | ((this: void) => Promise<JSX.Element | void>);
export type AcaiRouterPage<T = {}> = (props: T, std: GlyStd) =>
  | JSX.Element
  | Promise<JSX.Element>
  | Generator<AcaiRouterPageStep, JSX.Element | void, void>;

export type AcaiRouterPageError = (this: void, props: {getMessage: (this: void) => string}, std: GlyStd) => JSX.Element
export type AcaiRouterPageSplash = (this: void, props: {}, std: GlyStd) => JSX.Element
export type AcaiRouterEndpoints<P = any> = Record<AcaiRouterString, AcaiRouterPage<P>>;

type Primitive = string | number | boolean | undefined;
type PageParams = Record<string, Primitive>;
type InternalPages = {
  '@error'?: AcaiRouterPageError;
  '@error/not-found'?: AcaiRouterPageError;
  '@splash'?: AcaiRouterPageSplash;
};
type PagesMap = Record<string, AcaiRouterPage<any>>;
type PagePath<T extends PagesMap> = keyof T & string;
type PageProps<T extends PagesMap, K extends keyof T> =
  T[K] extends (props: infer P, std: GlyStd) => unknown ? P : never;
type Entry<T extends PagesMap> = {
  path: PagePath<T>;
  params: PageParams;
  focusedId?: string;
};

type FocusTarget = 'first' | `#${string}` | `.${string}`;
type FocusTargetMemo = FocusTarget | 'last';
type FocusOption = FocusTarget | FocusTarget[];
type FocusMemoOption = FocusTargetMemo | FocusTargetMemo[];

type Nav<T extends PagesMap> = <K extends PagePath<T>>(
  this: void,
  path: K,
  params: PageProps<T, K>,
) => Promise<void>;

type RouterConfig = {
  std: GlyStd;
  unload_images?: boolean;
  focus_first?: FocusOption;
  focus_back?: FocusMemoOption;
  focus_home?: FocusMemoOption;
};

type State<T extends PagesMap> = {
  std?: GlyStd;
  unload_images?: boolean;
  focus_first: FocusTarget[];
  focus_back: FocusTargetMemo[];
  focus_home: FocusTargetMemo[];
  userPages: Partial<T>;
  internalPages: InternalPages;
  internalApps: Partial<Record<AcaiRouterInternalString, GlyApp>>;
  rootApp?: GlyApp;
  currentApp?: GlyApp;
  stack: Entry<T>[];
  getErrorText: (this: void) => string;
  errorText: string;
};

type Router<T extends PagesMap> = {
  go: Nav<T>;
  replace: Nav<T>;
  reset: Nav<T>;
  back: (this: void) => Promise<void>;
  home: (this: void) => Promise<void>;
  error: (this: void, err: unknown) => void;
  current: (this: void) => PagePath<T> | undefined;
  register(path: '@error' | '@error/not-found', fn: AcaiRouterPageError): void;
  register(path: '@splash', fn: AcaiRouterPageSplash): void;
  register<K extends PagePath<T>, P extends PageProps<T, K>>(path: K, fn: AcaiRouterPage<P>): void;
  registerAll(pages: { [K in PagePath<T>]?: AcaiRouterPage<PageProps<T, K>> }): void;
  unregister(path: AcaiRouterInternalString | PagePath<T>): void;
};

type SetRouter = (config: RouterConfig) => void;

const STACK_CAP = 32;
const ERROR_ROUTES = ['@error', '@error/not-found'] as const;
const ERROR_FALLBACK: Partial<Record<AcaiRouterInternalString, AcaiRouterInternalString>> = {
  '@error/not-found': '@error',
};
const INTERNAL_KEYS = new Set<string>(['@error', '@error/not-found', '@splash']);

class NotFoundError extends Error {
  constructor(path: string) {
    super(`Page not found: ${path}`);
    this.name = 'NotFoundError';
  }
}

const isThenable = (v: unknown): v is Promise<unknown> => {
  const maybe = v as { then?: unknown };
  return maybe != null && typeof maybe.then === 'function';
};

const resolve = async <X>(v: X | Promise<X>): Promise<X> =>
  isThenable(v) ? await v : v;

const isPageGenerator = (
  v: unknown,
): v is Generator<AcaiRouterPageStep, JSX.Element | void, void> =>
  v != null
  && typeof v === "object"
  && typeof (v as { next?: unknown }).next === "function"
  && typeof (v as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";

const spawnTop = <T extends PagesMap>(s: State<T>, el: JSX.Element): GlyApp =>
  s.std!.node.spawn(el);

const spawnInRoot = <T extends PagesMap>(s: State<T>, el: any): GlyApp =>
  (s.std!.node.spawn as any)(el, s.rootApp) as GlyApp;

function toFocusArray<X extends string>(v: X | X[] | undefined): X[] {
  if (v === undefined) return [];
  return typeof v === 'string' ? [v] : v;
}

const killCurrent = <T extends PagesMap>(s: State<T>): void => {
  if (s.currentApp) {
    s.std!.node.kill(s.currentApp);
    s.currentApp = undefined;
  }
};

function resolveInternalRoute<T extends PagesMap>(
  s: State<T>,
  route: AcaiRouterInternalString,
): AcaiRouterInternalString | undefined {
  if (s.internalPages[route]) return route;
  const fallback = ERROR_FALLBACK[route];
  if (fallback && s.internalPages[fallback]) return fallback;
  return undefined;
}

function applyFocus<T extends PagesMap>(
  s: State<T>,
  entry: Entry<T>,
  targets: FocusTargetMemo[],
): void {
  if (!s.std) return;
  for (const target of targets) {
    if (target === 'last') {
      if (!entry.focusedId) continue;
      s.std.ui.focus(`#${entry.focusedId}`);
    } else {
      s.std.ui.focus(target);
    }
    if (s.std.ui.queryOne('focused')) return;
  }
}

function rememberFocus<T extends PagesMap>(s: State<T>): void {
  if (!s.std || s.stack.length === 0) return;
  const top = s.stack[s.stack.length - 1];
  top.focusedId = s.std.ui.queryOne('focused')?.getId();
}

async function mount<T extends PagesMap>(
  s: State<T>,
  entry: Entry<T>,
  focus: FocusTargetMemo[],
): Promise<void> {
  const fn = s.userPages[entry.path] as AcaiRouterPage<any> | undefined;
  if (!fn) throw new NotFoundError(entry.path);

  // Pre-create error apps (paused) and splash app before running the page function,
  // so handleError can resume them synchronously without any async work.
  for (const route of ERROR_ROUTES) {
    if (!s.internalApps[route] && s.internalPages[route]) {
      const pageFn = s.internalPages[route]!;
      const app = spawnTop(s, await resolve(pageFn({ getMessage: s.getErrorText }, s.std!)));
      s.std!.node.pause(app);
      s.internalApps[route] = app;
    }
  }
  if (!s.internalApps['@splash'] && s.internalPages['@splash']) {
    const pageFn = s.internalPages['@splash']!;
    s.internalApps['@splash'] = spawnTop(s, await resolve(pageFn({}, s.std!)));
  }

  if (s.internalApps['@splash']) s.std!.node.resume(s.internalApps['@splash']!);
  for (const route of ERROR_ROUTES) {
    if (s.internalApps[route]) s.std!.node.pause(s.internalApps[route]!);
  }

  const result = fn(entry.params, s.std!);

  if (isPageGenerator(result)) {
    let firstMount = true;
    const mountStep = (el: JSX.Element): void => {
      if (firstMount) {
        killCurrent(s);
        s.currentApp = spawnInRoot(s, el);
        if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
        firstMount = false;
      } else {
        const prev = s.currentApp;
        s.currentApp = spawnInRoot(s, el);
        if (prev) s.std!.node.kill(prev);
      }
    };

    while (true) {
      const step = result.next();
      if (step.done) {
        if (step.value !== undefined) mountStep(step.value);
        break;
      }
      const value = step.value;
      if (typeof value === 'function') {
        const ret = await value();
        if (ret !== undefined) mountStep(ret);
      } else {
        mountStep(value);
      }
    }
  } else {
    killCurrent(s);
    s.currentApp = spawnInRoot(s, await resolve(result));
    if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
  }

  applyFocus(s, entry, focus);
}

function handleError<T extends PagesMap>(s: State<T>, err: unknown): void {
  s.errorText = String(err);

  const route: AcaiRouterInternalString =
    err instanceof NotFoundError ? '@error/not-found' : '@error';

  if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);

  const resolved = resolveInternalRoute(s, route);
  const app = resolved ? s.internalApps[resolved] : undefined;
  if (app) s.std!.node.resume(app);
  killCurrent(s);
}

async function navigate<T extends PagesMap>(
  s: State<T>,
  op: () => Entry<T> | undefined,
  focus: FocusTargetMemo[],
): Promise<void> {
  try {
    rememberFocus(s);
    const next = op();
    if (next) await mount(s, next, focus);
  } catch (e) {
    handleError(s, e);
  }
}

function go<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => {
    const i = s.stack.findIndex(e => e.path === path);
    const entry: Entry<T> = { path, params: params as PageParams };
    if (i >= 0) {
      entry.focusedId = s.stack[i].focusedId;
      s.stack.splice(i + 1);
      s.stack[i] = entry;
    } else {
      s.stack.push(entry);
      if (s.stack.length > STACK_CAP) s.stack.shift();
    }
    return entry;
  }, s.focus_first);
}

function back<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    s.stack.pop();
    return s.stack[s.stack.length - 1];
  }, s.focus_back);
}

function home<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    s.stack.splice(1);
    return s.stack[0];
  }, s.focus_home);
}

function replace<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => {
    const entry: Entry<T> = { path, params: params as PageParams };
    if (s.stack.length === 0) s.stack.push(entry);
    else s.stack[s.stack.length - 1] = entry;
    return entry;
  }, s.focus_first);
}

function reset<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => {
    const entry: Entry<T> = { path, params: params as PageParams };
    s.stack.length = 0;
    s.stack.push(entry);
    return entry;
  }, s.focus_first);
}

function registerInternalPage<T extends PagesMap>(
  s: State<T>,
  path: AcaiRouterInternalString,
  fn: AcaiRouterPageError | AcaiRouterPageSplash,
): void {
  (s.internalPages as Record<AcaiRouterInternalString, AcaiRouterPageError | AcaiRouterPageSplash>)[path] = fn;
  if (s.internalApps[path]) {
    s.std?.node.kill(s.internalApps[path]!);
    s.internalApps[path] = undefined;
  }
}

function registerUserPage<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>,
  path: K,
  fn: T[K],
): void {
  s.userPages[path] = fn;
}

function unregisterPage<T extends PagesMap>(
  s: State<T>,
  path: AcaiRouterInternalString | PagePath<T>,
): void {
  if (INTERNAL_KEYS.has(path)) {
    const key = path as AcaiRouterInternalString;
    delete s.internalPages[key];
    if (s.internalApps[key]) {
      s.std?.node.kill(s.internalApps[key]!);
      delete s.internalApps[key];
    }
  } else {
    delete (s.userPages as Partial<Record<string, AcaiRouterPage<any>>>)[path];
  }
}

function configure<T extends PagesMap>(s: State<T>, config: RouterConfig): void {
  for (const key of Object.keys(s.internalApps) as AcaiRouterInternalString[]) {
    if (s.internalApps[key]) s.std?.node.kill(s.internalApps[key]!);
  }
  if (s.currentApp) s.std?.node.kill(s.currentApp);

  s.std = config.std;
  s.unload_images = config.unload_images;
  s.focus_first = toFocusArray(config.focus_first);
  s.focus_back = toFocusArray(config.focus_back);
  s.focus_home = toFocusArray(config.focus_home);
  s.rootApp = config.std.node.spawn(config.std.node.load({}));
  s.internalPages = {};
  s.internalApps = {};
  s.userPages = {} as Partial<T>;
  s.currentApp = undefined;
  s.stack.length = 0;
}

export function createRouter<
  T extends { [K in keyof T]: K extends `/${string}` ? AcaiRouterPage<any> : never } = AcaiRouterEndpoints
>(): [Router<T>, SetRouter] {
  const s: State<T> = {
    stack: [],
    userPages: {} as Partial<T>,
    internalPages: {},
    internalApps: {},
    focus_first: [],
    focus_back: [],
    focus_home: [],
    errorText: '',
    getErrorText: () => s.errorText
  };

  const instance: Router<T> = {
    go: (path, params) => go(s, path, params),
    replace: (path, params) => replace(s, path, params),
    reset: (path, params) => reset(s, path, params),
    back: () => back(s),
    home: () => home(s),
    error: (err) => handleError(s, err),
    current: () => s.stack[s.stack.length - 1]?.path,
    register: ((path: AcaiRouterInternalString | PagePath<T>, fn: AcaiRouterPageError | AcaiRouterPageSplash | T[PagePath<T>]) => {
      if (INTERNAL_KEYS.has(path)) {
        registerInternalPage(s, path as AcaiRouterInternalString, fn as AcaiRouterPageError | AcaiRouterPageSplash);
      } else {
        registerUserPage(s, path as PagePath<T>, fn as T[PagePath<T>]);
      }
    }) as Router<T>['register'],
    registerAll: (pages) => { Object.assign(s.userPages, pages); },
    unregister: (path) => unregisterPage(s, path),
  };

  return [instance, (config) => configure(s, config)];
}
