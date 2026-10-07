import { LinkedAppsCard } from "../../packages/app-foundation/src/LinkedAppsCard";
import {
  APP_ID,
  linkedAppAction,
  linkedAppsEnabled,
  openLinkedDestination,
} from "@/lib/linkedApps";
import { isNativePlatform as isNative } from "@/lib/nativePlatform";
export default function LinkedApps() {
  return linkedAppsEnabled && !isNative()
    ? (
      <LinkedAppsCard
        app={APP_ID}
        native={isNative()}
        action={linkedAppAction}
        open={openLinkedDestination}
      />
    )
    : null;
}
