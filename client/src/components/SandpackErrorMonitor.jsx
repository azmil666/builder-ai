import { useSandpack } from "@codesandbox/sandpack-react";
import React, { useEffect } from "react";

const SandpackErrorMonitor = ({ onErrorChange, onDetailedErrorChange }) => {
  const { sandpack } = useSandpack();
  const { error, status } = sandpack;

  useEffect(() => {
    if (error) {
      const msg = error.message || "";
      const isNetworkError =
        msg.includes("Failed to fetch") ||
        msg.includes("col.csbops.io") ||
        msg.includes("ERR_CONNECTION_TIMED_OUT") ||
        msg.includes("net::ERR") ||
        msg.includes("NetworkError");

      const isDependencyError =
        msg.includes("Could not fetch dependencies") ||
        msg.includes("Dependency") ||
        msg.includes("Cannot find module") ||
        msg.includes("packager") ||
        status === "error";

      let affectedPkg = null;
      const pkgMatch =
        msg.match(/Dependency\s+['"]?(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)['"]?\s+not found/i) ||
        msg.match(/Cannot find module\s+['"]([^'"]+)['"]/i) ||
        msg.match(/package\s+['"]?([a-z0-9_.-]+)['"]?/i);

      if (pkgMatch && pkgMatch[1]) {
        affectedPkg = pkgMatch[1].trim();
      }

      if (onDetailedErrorChange) {
        onDetailedErrorChange({
          hasError: true,
          isDependencyError,
          isNetwork: isNetworkError,
          package: affectedPkg,
          reason: msg,
          rawError: error,
        });
      }

      // Hide default overlay for network/dependency errors if custom banner will handle it
      if (isNetworkError) {
        onErrorChange(false);
        return;
      }
    } else {
      if (onDetailedErrorChange) {
        onDetailedErrorChange(null);
      }
    }

    onErrorChange(true);
  }, [error, status, onErrorChange, onDetailedErrorChange]);

  return null;
};

export default SandpackErrorMonitor;
