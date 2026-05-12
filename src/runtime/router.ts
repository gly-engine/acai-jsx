import type { GlyApp, GlyStd } from "@gamely/gly-types";
import { createState } from "../hooks/state";

export type AcaiRouterInternalString = '@error' | '@error/not-found' | '@splash';
export type AcaiRouterString = `/${string}`;
export type AcaiRouterPage<T = {}> = (props: T, std: GlyStd) =>
  | JSX.Element
  | Promise<JSX.Element>
  | AsyncGenerator<JSX.Element, JSX.Element | void, unknown>;

export type AcaiRouterPageError = (props: {getMessage: () => string}, std: GlyStd) => JSX.Element
export type AcaiRouterPageSplash = (props: {}, std: GlyStd) => JSX.Element
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
type Entry<T extends PagesMap> = { path: PagePath<T>; params: PageParams };

type Nav<T extends PagesMap> = <K extends PagePath<T>>(
  this: void,
  path: K,
  params: PageProps<T, K>,
) => Promise<void>;

type RouterConfig = {
  std: GlyStd;
  unload_images?: boolean;
};

type State<T extends PagesMap> = {
  std?: GlyStd;
  unload_images?: boolean;
  userPages: Partial<T>;
  internalPages: InternalPages;
  internalApps: Partial<Record<AcaiRouterInternalString, GlyApp>>;
  rootApp?: GlyApp;
  currentApp?: GlyApp;
  stack: Entry<T>[];
  getErrorText: (this: void) => string;
  setErrorText: (this: void, s: string) => void;
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

const isAsyncGenerator = (
  v: unknown,
): v is AsyncGenerator<JSX.Element, JSX.Element | void, unknown> =>
  v != null && typeof v === "object" && typeof (v as { next?: unknown }).next === "function";

const spawnTop = <T extends PagesMap>(s: State<T>, el: JSX.Element): GlyApp =>
  s.std!.node.spawn(el);

const spawnInRoot = <T extends PagesMap>(s: State<T>, el: any): GlyApp =>
  (s.std!.node.spawn as any)(el, s.rootApp) as GlyApp;

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

async function mount<T extends PagesMap>(s: State<T>, entry: Entry<T>): Promise<void> {
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

  if (isAsyncGenerator(result)) {
    const first = await result.next();
    if (first.done) return;

    killCurrent(s);
    s.currentApp = spawnInRoot(s, first.value);
    if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);

    for await (const element of result) {
      const prev = s.currentApp;
      s.currentApp = spawnInRoot(s, element);
      if (prev != undefined) s.std!.node.kill(prev);
    }
  } else {
    killCurrent(s);
    s.currentApp = spawnInRoot(s, await resolve(result));
    if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);
  }
}

function handleError<T extends PagesMap>(s: State<T>, err: unknown): void {
  s.setErrorText(String(err));

  const route: AcaiRouterInternalString =
    err instanceof NotFoundError ? '@error/not-found' : '@error';

  if (s.internalApps['@splash']) s.std!.node.pause(s.internalApps['@splash']!);

  const resolved = resolveInternalRoute(s, route);
  const app = resolved ? s.internalApps[resolved] : undefined;
  if (app) s.std!.node.resume(app);
}

async function navigate<T extends PagesMap>(
  s: State<T>,
  op: () => Entry<T> | undefined,
): Promise<void> {
  try {
    const next = op();
    if (next) await mount(s, next);
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
      s.stack.splice(i + 1);
      s.stack[i] = entry;
    } else {
      s.stack.push(entry);
      if (s.stack.length > STACK_CAP) s.stack.shift();
    }
    return entry;
  });
}

function back<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    s.stack.pop();
    return s.stack[s.stack.length - 1];
  });
}

function home<T extends PagesMap>(s: State<T>): Promise<void> {
  return navigate(s, () => {
    if (s.stack.length <= 1) return undefined;
    s.stack.splice(1);
    return s.stack[0];
  });
}

function replace<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => {
    const entry: Entry<T> = { path, params: params as PageParams };
    if (s.stack.length === 0) s.stack.push(entry);
    else s.stack[s.stack.length - 1] = entry;
    return entry;
  });
}

function reset<T extends PagesMap, K extends PagePath<T>>(
  s: State<T>, path: K, params: PageProps<T, K>,
): Promise<void> {
  return navigate(s, () => {
    const entry: Entry<T> = { path, params: params as PageParams };
    s.stack.length = 0;
    s.stack.push(entry);
    return entry;
  });
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
  const [_getErrorText, _setErrorText] = createState("Error!");
  const getErrorText = () => _getErrorText();
  const setErrorText = (v: string) => _setErrorText(v);
  const s: State<T> = {
    stack: [],
    userPages: {} as Partial<T>,
    internalPages: {},
    internalApps: {},
    getErrorText,
    setErrorText,
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
