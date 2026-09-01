import {
  spaceAppPackageRegistryAudience,
  verifySpaceRuntimeCredential,
} from "@vibechat/space-runtime-auth";

export async function authorizeSpaceAppPackagePublisher(request: Request) {
  const secret = process.env.SPACE_APP_PACKAGE_PUBLISHING_TOKEN?.trim();
  const credential = bearerCredential(request.headers.get("authorization"));
  if (!secret || !credential) return false;
  const url = new URL(request.url);
  const claims = await verifySpaceRuntimeCredential(credential, {
    secret,
    audience: spaceAppPackageRegistryAudience,
    subject: "space-app-package-publisher",
    method: request.method,
    path: url.pathname,
  });
  return Boolean(claims);
}

function bearerCredential(value: string | null) {
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}
