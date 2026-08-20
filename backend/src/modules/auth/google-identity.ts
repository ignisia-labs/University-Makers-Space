import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const googleClient = new OAuth2Client({ clientId: env.GOOGLE_CLIENT_ID });

export type InstitutionalGoogleIdentity = {
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export async function verifyMitWpuCredential(
  credential: string,
): Promise<InstitutionalGoogleIdentity> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email?.trim().toLowerCase();
    const hostedDomain = payload?.hd?.trim().toLowerCase();

    if (
      !payload?.sub ||
      !email ||
      payload.email_verified !== true ||
      hostedDomain !== env.GOOGLE_HOSTED_DOMAIN ||
      !email.endsWith(`@${env.GOOGLE_HOSTED_DOMAIN}`)
    ) {
      throw new ApiError(
        403,
        "INSTITUTIONAL_ACCOUNT_REQUIRED",
        `Sign in with a verified @${env.GOOGLE_HOSTED_DOMAIN} Google Workspace account`,
      );
    }

    return {
      subject: payload.sub,
      email,
      name: payload.name?.trim() || email.split("@")[0]!,
      ...(payload.picture ? { avatarUrl: payload.picture } : {}),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "INVALID_GOOGLE_CREDENTIAL", "Google credential is invalid or expired");
  }
}
