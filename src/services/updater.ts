import { relaunch } from "@tauri-apps/plugin-process";
import { Update, check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

/**
 * Checks for application updates on startup.
 * If an update is available, notifies the user with options to install or ignore.
 */
export async function checkForUpdates(): Promise<void> {
  try {
    const update: Update | null = await check();

    if (update) {
      const releaseDateString = update.date ? new Date(update.date).toLocaleDateString() : "Date unknown";
      const releaseNotes = update.body ? `${update.body.substring(0, 100)}...` : "No details provided.";

      toast(`New version ${update.version} available!`, {
        description: `Released on: ${releaseDateString}. Notes: ${releaseNotes}`,
        action: {
          label: "Update & Restart",
          onClick: async (): Promise<void> => {
            const installingToastId = toast.loading("Installing update...");
            try {
              // Note: On Windows, the app will exit immediately after this call.
              await update.downloadAndInstall((progress) => {
                switch (progress.event) {
                  case "Started":
                    toast.loading(`Downloading update... ${((progress.data?.contentLength ?? 0) / (1024 * 1024)).toFixed(1)} MB`);
                    break;
                  // case "Progress":
                  //   toast.loading(`Downloading update: ${progress.data.percent}%`);
                  //   break;
                  case "Finished":
                    toast.success("Download finished. Installing Update...");
                    break;
                }
              });
              // Relaunch is necessary for macOS and Linux to apply the update.
              // On Windows, this line might not be reached if the installer exits the app.
              await relaunch();
              // We may not reach this point if relaunch is immediate,
              // but keep it in case of delays or future API changes.
              toast.dismiss(installingToastId);
            } catch (installError) {
              console.error("Failed to install update:", installError);
              toast.error("Update installation failed. Please try again later.", {
                id: installingToastId,
              });
            }
          },
        },
        cancel: {
          label: "Later",
          onClick: () => {
            toast.info("Update postponed. You can check again later.");
          },
        },
        duration: Number.POSITIVE_INFINITY, // Keep the toast open until the user interacts
      });
    } else {
      console.info("No updates available.");
      // Optionally notify the user they are up-to-date, but usually not necessary
      // toast.info("Your application is up-to-date.");
    }
  } catch (error) {
    console.error("Failed to check for updates:", error);
    // Avoid bothering the user if the update check fails silently
    // toast.error("Failed to check for updates.");
  }
}
