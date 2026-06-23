import { createBus } from "../../src/hooks/bus";

declare function print(...args: any[]): void;

const [emitFoo, listenFoo] = createBus();
const [emitBar, listenBar] = createBus<[number]>();

listenBar(print)
listenFoo(() => print('foo'))

emitFoo();
emitFoo();
emitFoo();
emitBar(5);
