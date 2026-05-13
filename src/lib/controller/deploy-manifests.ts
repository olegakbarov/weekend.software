import type { DeployChoice, PresetManifest } from "./types";

type ConcreteDeploy = Exclude<DeployChoice, "none">;

export const DEPLOY_MANIFESTS: Record<ConcreteDeploy, PresetManifest> = {
  vercel: {
    id: "_deploy.vercel",
    name: "Vercel",
    description: "Vercel deploy credentials",
    fields: [
      {
        key: "VERCEL_TOKEN",
        label: "Vercel token",
        placeholder: "Vercel token — vercel.com/account/tokens",
        helpUrl: "https://vercel.com/account/tokens",
        required: true,
        secret: true,
        writesTo: { type: "env.local" },
      },
    ],
  },
  cloudflare: {
    id: "_deploy.cloudflare",
    name: "Cloudflare",
    description: "Cloudflare deploy credentials",
    fields: [
      {
        key: "CLOUDFLARE_API_TOKEN",
        label: "Cloudflare API token",
        placeholder: "Cloudflare API token — Workers/Pages scope",
        helpUrl: "https://dash.cloudflare.com/profile/api-tokens",
        required: true,
        secret: true,
        writesTo: { type: "env.local" },
      },
      {
        key: "CLOUDFLARE_ACCOUNT_ID",
        label: "Cloudflare account ID",
        placeholder: "Cloudflare account ID — sidebar of dashboard",
        helpUrl: "https://dash.cloudflare.com",
        required: true,
        secret: false,
        writesTo: { type: "env.local" },
      },
    ],
  },
};

export function deployManifestFor(
  deploy: DeployChoice,
): PresetManifest | null {
  if (deploy === "none") return null;
  return DEPLOY_MANIFESTS[deploy];
}
