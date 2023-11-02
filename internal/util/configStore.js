"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomCompilerPath = exports.setConfig = void 0;
// This will hold the externally provided configuration
let externalConfig = null;
// Function to set the configuration from an external source
function setConfig(resolvedConfig) {
    externalConfig = resolvedConfig;
}
exports.setConfig = setConfig;
// Function to get a specific config value
function getCustomCompilerPath() {
    if (externalConfig === null) {
        throw new Error('Config has not been set. Please call setConfig with a valid HardhatConfig object first.');
    }
    return externalConfig.customCompilerPath;
}
exports.getCustomCompilerPath = getCustomCompilerPath;
