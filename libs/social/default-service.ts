import { DatabaseSocialRepository } from "./database-repository";
import { SocialService } from "./service";

export function createDefaultSocialService() {
  return new SocialService(new DatabaseSocialRepository());
}
