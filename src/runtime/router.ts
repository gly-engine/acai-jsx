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
export type AcaiRouterPageUnmount<P = any> = (this: void, props: P, std: GlyStd) => Generator<AcaiRouterPageStep, void, void>;
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
  std?: GlyStd;
  unload_images?: boolean;
  focus_seek?: FocusOption;
  focus_back?: FocusMemoOption;
  focus_home?: FocusMemoOption;
  focus_error?: FocusOption;
  same_page?: 'block' | 'reload' | 'refocus';
  interrupt?: 'block';
  lock?: boolean;
};

type State<T extends PagesMap> = {
  std?: GlyStd;
  unload_images?: boolean;
  focus_seek: FocusTarget[];
  focus_back: FocusTargetMemo[];
  focus_home: FocusTargetMemo[];
  focus_error: FocusTarget[];
  same_page: 'block' | 'reload' | 'refocus';
  interrupt?: 'block';
  lock: boolean;
  busy: boolean;
  userPages: Partial<T>;
  userUnmounts: Partial<Record<string, AcaiRouterPageUnmount>>;
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
  register<K extends PagePath<T>, P extends PageProps<T, K>>(path: K, fn: AcaiRouterPage<P>, unmount?: AcaiRouterPageUnmount<P>): void;
  registerAll(
    pages: { [K in PagePath<T>]?: AcaiRouterPage<PageProps<T, K>> },
    unmounts?: { [K in PagePath<T>]?: AcaiRouterPageUnmount<PageProps<T, K>> },
  ): void;
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
    const focused = target === 'last'
      ? (entry.focusedId ? s.std.ui.focus(`#${entry.focusedId}`) : undefined)
      : s.std.ui.focus(target);
    if (focused !== undefined) return;
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
  // Spawned under rootApp (never under engine.current): a page-relative parent
  // would die together with the page and leave stale refs in internalApps.
  for (const route of ERROR_ROUTES) {
    if (!s.internalApps[route] && s.internalPages[route]) {
      const pageFn = s.internalPages[route]!;
      const app = spawnInRoot(s, await resolve(pageFn({ getMessage: s.getErrorText }, s.std!)));
      s.std!.node.pause(app);
      s.internalApps[route] = app;
    }
  }
  if (!s.internalApps['@splash'] && s.internalPages['@splash']) {
    const pageFn = s.internalPages['@splash']!;
    s.internalApps['@splash'] = spawnInRoot(s, await resolve(pageFn({}, s.std!)));
  }

  if (s.internalApps['@splash']) s.std!.node.resume(s.internalApps['@splash']!);
  for (const route of ERROR_ROUTES) {
    if (s.internalApps[route]) s.std!.node.pause(s.internalApps[route]!);
  }

  const result = fn(entry.params, s.std!);

  if (isPageGenerator(result)) {
    let firstMount = true;
    let unloaded = false;
    const unloadOnce = (): void => {
      if (unloaded) return;
      unloaded = true;
      if (s.unload_images) s.std!.image.unload_all();
    };

    const mountStep = (el: JSX.Element): void => {
      if (firstMount) unloadOnce();
      const prev = s.currentApp;
      s.currentApp = spawnInRoot(s, el);
      if (prev) s.std!.node.kill(prev);
      if (firstMount) {
        if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
        firstMount = false;
      }
    };

    while (true) {
      const step = result.next();
      if (step.done) {
        if (step.value) mountStep(step.value as JSX.Element);
        break;
      }
      const value = step.value;
      if (typeof value === 'function') {
        if (firstMount) {
          unloadOnce();
          killCurrent(s);
        }
        const ret = await value();
        if (ret) mountStep(ret as JSX.Element);
      } else if (value) {
        mountStep(value as JSX.Element);
      }
    }
  } else if (isThenable(result)) {
    if (s.unload_images) s.std!.image.unload_all();
    killCurrent(s);
    const el = await result;
    s.currentApp = spawnInRoot(s, el as JSX.Element);
    if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
  } else {
    const el = result as JSX.Element;
    if (s.unload_images) s.std!.image.unload_all();
    const prev = s.currentApp;
    s.currentApp = spawnInRoot(s, el);
    if (prev) s.std!.node.kill(prev);
    if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
  }

  applyFocus(s, entry, focus);
}

async function runUnmount<T extends PagesMap>(
  s: State<T>,
  unmount: AcaiRouterPageUnmount,
  props: PageParams,
): Promise<void> {
  const gen = unmount(props, s.std!);
  const swap = (el: JSX.Element): void => {
    const prev = s.currentApp;
    s.currentApp = spawnInRoot(s, el);
    if (prev) s.std!.node.kill(prev);
  };
  while (true) {
    const step = gen.next();
    if (step.done) break;
    const value = step.value;
    if (typeof value === 'function') {
      const ret = await value();
      if (ret) swap(ret as JSX.Element);
    } else if (value) {
      swap(value as JSX.Element);
    }
  }
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

  if (app && s.focus_error.length > 0) {
    const errorEntry: Entry<T> = { path: '' as PagePath<T>, params: {} };
    applyFocus(s, errorEntry, s.focus_error);
  }
}

async function navigate<T extends PagesMap>(
  s: State<T>,
  peek: () => Entry<T> | undefined,
  commit: (entry: Entry<T>) => Entry<T>,
  focus: FocusTargetMemo[],
  targetPath?: string,
): Promise<void> {
  if (s.lock) return;
  if (s.interrupt === 'block' && s.busy) return;
  if (targetPath !== undefined) {
    const top = s.stack[s.stack.length - 1];
    if (top && top.path === targetPath) {
      if (s.same_page === 'block') return;
      if (s.same_page === 'refocus') {
        applyFocus(s, top, focus);
        return;
      }
      // 'reload' falls through to a full unmount/mount cycle below.
    }
  }
  s.busy = true;
  try {
    rememberFocus(s);
    const currentEntry = s.stack[s.stack.length - 1];
    // Validate the destination BEFORE touching the stack or running the
    // outgoing page's unmount — an invalid target must not destroy anything.
    const candidate = peek();
    if (candidate) {
      if (!s.userPages[candidate.path]) throw new NotFoundError(candidate.path);
      const next = commit(candidate);
      if (currentEntry) {
        const unmountFn = s.userUnmounts[currentEntry.path];
        if (unmountFn) await runUnmount(s, unmountFn, currentEntry.params);
      }
      await mount(s, next, focus);
    }
    s.busy = false;
  } catch (e) {
    handleError(s, e);
    s.busy = false;
  }
}

function go<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => ({ path, params: params as PageParams }), (entry) => {
    const i = s.stack.findIndex(e => e.path === entry.path);
    if (i >= 0) {
      entry.focusedId = s.stack[i].focusedId;
      s.stack.splice(i + 1);
      s.stack[i] = entry;
    } else {
      s.stack.push(entry);
      if (s.stack.length > STACK_CAP) s.stack.splice(1, 1);
    }
    return entry;
  }, s.focus_seek, path);
}

function back<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    return s.stack[s.stack.length - 2];
  }, () => {
    s.stack.pop();
    return s.stack[s.stack.length - 1];
  }, s.focus_back);
}

function home<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    return s.stack[0];
  }, () => {
    s.stack.splice(1);
    return s.stack[0];
  }, s.focus_home);
}

function replace<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => ({ path, params: params as PageParams }), (entry) => {
    if (s.stack.length === 0) s.stack.push(entry);
    else s.stack[s.stack.length - 1] = entry;
    return entry;
  }, s.focus_seek, path);
}

function reset<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => ({ path, params: params as PageParams }), (entry) => {
    s.stack.length = 0;
    s.stack.push(entry);
    return entry;
  }, s.focus_seek, path);
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
  unmount?: AcaiRouterPageUnmount,
): void {
  s.userPages[path] = fn;
  if (unmount !== undefined) {
    s.userUnmounts[path] = unmount;
  } else {
    delete s.userUnmounts[path];
  }
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
    delete s.userUnmounts[path];
  }
}

function configure<T extends PagesMap>(s: State<T>, config: RouterConfig): void {
  if (config.std !== undefined) {
    for (const key of Object.keys(s.internalApps) as AcaiRouterInternalString[]) {
      if (s.internalApps[key]) s.std?.node.kill(s.internalApps[key]!);
    }
    if (s.currentApp) s.std?.node.kill(s.currentApp);
    if (s.rootApp) s.std?.node.kill(s.rootApp);

    s.std = config.std;
    s.rootApp = config.std.node.spawn(config.std.node.load({}));
    s.internalApps = {};
    s.currentApp = undefined;
    s.busy = false;
    s.stack.length = 0;
  }

  if (config.unload_images !== undefined) s.unload_images = config.unload_images;
  if (config.focus_seek !== undefined) s.focus_seek = toFocusArray(config.focus_seek);
  if (config.focus_back !== undefined) s.focus_back = toFocusArray(config.focus_back);
  if (config.focus_home !== undefined) s.focus_home = toFocusArray(config.focus_home);
  if (config.focus_error !== undefined) s.focus_error = toFocusArray(config.focus_error);
  if (config.same_page !== undefined) s.same_page = config.same_page;
  if (config.interrupt !== undefined) s.interrupt = config.interrupt;
  if (config.lock !== undefined) s.lock = config.lock;
}

export function createRouter<
  T extends { [K in keyof T]: K extends `/${string}` ? AcaiRouterPage<any> : never } = AcaiRouterEndpoints
>(): [Router<T>, SetRouter] {
  const s: State<T> = {
    stack: [],
    userPages: {} as Partial<T>,
    userUnmounts: {},
    internalPages: {},
    internalApps: {},
    focus_seek: [],
    focus_back: [],
    focus_home: [],
    focus_error: [],
    same_page: 'reload',
    interrupt: 'block',
    lock: false,
    busy: false,
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
    register: ((
      path: AcaiRouterInternalString | PagePath<T>,
      fn: AcaiRouterPageError | AcaiRouterPageSplash | T[PagePath<T>],
      unmount?: AcaiRouterPageUnmount,
    ) => {
      if (INTERNAL_KEYS.has(path)) {
        registerInternalPage(s, path as AcaiRouterInternalString, fn as AcaiRouterPageError | AcaiRouterPageSplash);
      } else {
        registerUserPage(s, path as PagePath<T>, fn as T[PagePath<T>], unmount);
      }
    }) as Router<T>['register'],
    registerAll: (pages, unmounts) => {
      Object.assign(s.userPages, pages);
      if (unmounts) Object.assign(s.userUnmounts, unmounts);
    },
    unregister: (path) => unregisterPage(s, path),
  };

  return [instance, (config) => configure(s, config)];
}
