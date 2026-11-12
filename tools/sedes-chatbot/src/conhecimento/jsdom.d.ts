// O jsdom (devDependency da raiz) não traz tipos; só o que o gerador usa.
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string);
    window: Window & typeof globalThis;
  }
}
