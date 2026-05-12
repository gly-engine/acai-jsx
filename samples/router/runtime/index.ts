import { createRouter } from "../../../src";
import { AcaiRouterEndpoints } from "../../../src/runtime/router";

// qualquer prop e qualquer rota
const [router, setRouterConfig] = createRouter()

declare const Pages: {
    '/foo': () => JSX.Element
};

// o register tem q receber paginas que sao especifico chave endpoint valor props do pages
const [router2] = createRouter<typeof Pages>()

// register aceita qualquer / mas as pages tem que ter someProp, assim como o .go params respeitar


router2.register('@error', (props: {getMessage: () => string}) => ({} as any as JSX.Element)) // nao ta dando erro
router2.register('@error/not-found', (props: {getMessage: () => string}) => ({} as any as JSX.Element)) // nao ta dando erro
router2.register('@splash', () => ({} as any as JSX.Element))

router.go('/', {})
router.register('/foo', () => ({} as any as JSX.Element))

router2.go('/foo', {})
router2.register('/foo', () => ({} as any as JSX.Element))

const [router3] = createRouter<AcaiRouterEndpoints<{someProp: number}>>()

router3.go('/foo', {someProp: 5})
router3.register('/bar', (props: {}) => ({} as any as JSX.Element)) // permite?