// vinext aliases "next/navigation" to its shim at build time but ships no types for it.
declare module "next/navigation" {
  export function redirect(url: string): never;
  export function notFound(): never;
  export function usePathname(): string;
}
