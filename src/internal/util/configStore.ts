import { HardhatConfig } from "../../types/config";

// This will hold the externally provided configuration
let externalConfig: HardhatConfig | null = null;

// Function to set the configuration from an external source
export function setConfig(resolvedConfig: HardhatConfig): void {
  externalConfig = resolvedConfig;
}

// Function to get a specific config value
export function getCustomCompilerPath(): string {
  if (externalConfig === null) {
    throw new Error('Config has not been set. Please call setConfig with a valid HardhatConfig object first.');
  }
  return externalConfig.customCompilerPath;
}
