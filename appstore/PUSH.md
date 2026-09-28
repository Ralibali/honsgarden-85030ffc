# Remote push — release checklist

The implementation below is local work. The new migration and functions have not been deployed, credentials have not been verified, and no real remote notification has been demonstrated on either platform.

## Implemented locally

- One notification lifecycle throughout the signed-in app, including notification taps and token rotation. Permission is requested only after the user enables notifications.
- iOS AppDelegate passes registration results to Capacitor. Android uses Firebase Messaging, a named notification channel and a monochrome egg icon. Foreground presentation is configured on both platforms.
- `register_native_push` binds the device to the authenticated, active Supabase session. Account ownership cannot be supplied in the request. The same phone can move between accounts; token rotation replaces that session's old token without deleting other devices.
- `active_native_push_tokens` is callable only by the server. It excludes missing, revoked and expired sessions and registrations from older app versions that lack session binding. The client cannot directly write session metadata.
- Disable/logout suspends registration callbacks, removes delivered notifications, unregisters the device and deletes only that registration. A late cleanup cannot delete a newer registration. Online session revocation independently excludes stale registrations from subsequent server sends. Notifications already delivered or in flight, and offline logout, still require device testing.
- Native test notifications target the current device. Scheduled egg reminders also call the native sender. Success feedback requires a positive provider-accepted count; this is not proof that the device displayed a notification.
- The server supports APNs and FCM HTTP v1. APNs learns the sandbox/production host only after an explicit `BadDeviceToken` response. Expired tokens are pruned without deleting a concurrently renewed registration.

## Configuration verified on 8 September 2026

- Firebase project `honsgarden-c4e22` exists on the free Spark plan with Analytics disabled. Android package `se.honsgarden.app` is registered and FCM HTTP v1 is enabled.
- Its configuration is present locally at `android/app/google-services.json` and is ignored by Git. The last debug APK predates this file and must be rebuilt.
- The server secret names visible in Lovable do not include APNs credentials or `FCM_SERVICE_ACCOUNT_JSON`.
- The dedicated service-account form for `honsgarden-push` is prepared only. Account creation, the Firebase Cloud Messaging API Admin role and the private server key await the specific security approval. No such account, grant or key has been created.

## Required configuration and deployment

1. Verify the existing Apple push key and app entitlement. Server secrets: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID=se.honsgarden.app`, and `APNS_PRIVATE_KEY`. `APNS_ENV` defaults to production. Never put private keys into the app bundle or Git.
2. Register the Android package `se.honsgarden.app` in the intended Firebase project. Supply its `android/app/google-services.json` locally; it is ignored by Git. Verify the FCM API is enabled and configure `FCM_SERVICE_ACCOUNT_JSON` as a server secret with permission to send messages for that Firebase project. A Play Billing account/service credential does not automatically configure Firebase.
3. Apply `20260908113721_native_push_session_binding.sql` and deploy `send-push-notification` and `send-push` together with the updated native app. The migration removes direct client insert/update access to device tokens; older native builds must update to register through the new RPC. No journal or other farm records are changed.
4. Build the current web bundle, sync Capacitor, and build/install both native applications. Test the actual installed binaries, including a TestFlight build using production APNs.

## Required end-to-end proof

For each platform, record build, device, test account and timestamp. Test permission denial and later enabling; a server-originated test while the app is foregrounded, backgrounded and terminated; notification tap to the correct page; token rotation; app restart; disabling on one of two devices; online and offline logout; account switching on the same phone; and a real scheduled reminder. Confirm the old account receives nothing on the switched device. Do not send tests to unrelated users.

Local tests cover RPC privileges, account rebinding, stale-account cleanup, revoked/expired sessions, multiple devices, token rotation, registration failure, late callbacks during logout, notification destinations and APNs host selection. Run `npm run test:native-push-db` for the isolated Postgres checks and the native push Vitest tests for the app and delivery logic. These tests use fixtures and do not connect to production.

References: [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions).
