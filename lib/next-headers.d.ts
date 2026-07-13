// vinext aliases "next/headers" to its shim at build time but ships no types for it.
declare module "next/headers" {
  export interface RequestCookie {
    name: string;
    value: string;
  }
  export function cookies(): Promise<{
    get(name: string): RequestCookie | undefined;
  }>;
  export function headers(): Promise<Headers>;
}
