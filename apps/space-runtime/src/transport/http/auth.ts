import {
  spaceRuntimeAudience,
  verifySpaceRuntimeCredential,
} from "@vibechat/space-runtime-auth";

export async function authorizeRuntimeRequest(
  request: Request,
  signingSecret: string,
) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const credential = authorization.slice("Bearer ".length).trim();
  if (!credential) return false;
  const url = new URL(request.url);
  const claims = await verifySpaceRuntimeCredential(credential, {
    secret: signingSecret,
    audience: spaceRuntimeAudience,
    subject: "vibechat-backend",
    method: request.method,
    path: url.pathname,
  });
  return Boolean(claims);
}
