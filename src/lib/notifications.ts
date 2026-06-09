import { invoke } from "@tauri-apps/api/core";

/** Send a native OS notification (notify-rust on macOS). */
export async function showNativeNotification(
  title: string,
  body: string
): Promise<void> {
  await invoke("plugin:notification|notify", {
    options: { title, body },
  });
}
