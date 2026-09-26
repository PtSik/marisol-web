// A form post answers with a 303 back to the page it came from, carrying its outcome in one param.
export function redirectWithParam(
  request: Request,
  path: string,
  key: string,
  value: string,
): Response {
  const url = new URL(path, request.url);
  url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 303);
}
