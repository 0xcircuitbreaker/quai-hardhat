"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
require("source-map-support/register");
const task_names_1 = require("../../builtin-tasks/task-names");
const constants_1 = require("../constants");
const context_1 = require("../context");
const config_loading_1 = require("../core/config/config-loading");
const errors_1 = require("../core/errors");
const errors_list_1 = require("../core/errors-list");
const execution_mode_1 = require("../core/execution-mode");
const env_variables_1 = require("../core/params/env-variables");
const hardhat_params_1 = require("../core/params/hardhat-params");
const project_structure_1 = require("../core/project-structure");
const runtime_environment_1 = require("../core/runtime-environment");
const typescript_support_1 = require("../core/typescript-support");
const reporter_1 = require("../sentry/reporter");
const ci_detection_1 = require("../util/ci-detection");
const global_dir_1 = require("../util/global-dir");
const packageInfo_1 = require("../util/packageInfo");
const flamegraph_1 = require("../core/flamegraph");
const configStore_1 = require("../util/configStore");
const analytics_1 = require("./analytics");
const ArgumentsParser_1 = require("./ArgumentsParser");
const emoji_1 = require("./emoji");
const project_creation_1 = require("./project-creation");
const prompt_1 = require("./prompt");
const hardhat_vscode_installation_1 = require("./hardhat-vscode-installation");
const log = (0, debug_1.default)("hardhat:core:cli");
const ANALYTICS_SLOW_TASK_THRESHOLD = 300;
const SHOULD_SHOW_STACK_TRACES_BY_DEFAULT = (0, ci_detection_1.isRunningOnCiServer)();
async function printVersionMessage() {
    const packageJson = await (0, packageInfo_1.getPackageJson)();
    console.log(packageJson.version);
}
async function suggestInstallingHardhatVscode() {
    const alreadyPrompted = (0, global_dir_1.hasPromptedForHHVSCode)();
    if (alreadyPrompted) {
        return;
    }
    const isInstalled = (0, hardhat_vscode_installation_1.isHardhatVSCodeInstalled)();
    (0, global_dir_1.writePromptedForHHVSCode)();
    if (isInstalled !== hardhat_vscode_installation_1.InstallationState.EXTENSION_NOT_INSTALLED) {
        return;
    }
    const installationConsent = await (0, prompt_1.confirmHHVSCodeInstallation)();
    if (installationConsent === true) {
        console.log("Installing Hardhat for Visual Studio Code...");
        const installed = (0, hardhat_vscode_installation_1.installHardhatVSCode)();
        if (installed) {
            console.log("Hardhat for Visual Studio Code was successfully installed");
        }
        else {
            console.log("Hardhat for Visual Studio Code couldn't be installed. To learn more about it, go to https://hardhat.org/hardhat-vscode");
        }
    }
    else {
        console.log("To learn more about Hardhat for Visual Studio Code, go to https://hardhat.org/hardhat-vscode");
    }
}
function showViaIRWarning(resolvedConfig) {
    const configuredCompilers = (0, config_loading_1.getConfiguredCompilers)(resolvedConfig.solidity);
    const viaIREnabled = configuredCompilers.some((compiler) => compiler.settings?.viaIR === true);
    if (viaIREnabled) {
        console.warn();
        console.warn(chalk_1.default.yellow(`Your solidity settings have viaIR enabled, which is not fully supported yet. You can still use Hardhat, but some features, like stack traces, might not work correctly.

Learn more at https://hardhat.org/solc-viair`));
    }
}
async function main() {
    // We first accept this argument anywhere, so we know if the user wants
    // stack traces before really parsing the arguments.
    let showStackTraces = process.argv.includes("--show-stack-traces") ||
        SHOULD_SHOW_STACK_TRACES_BY_DEFAULT;
    try {
        const envVariableArguments = (0, env_variables_1.getEnvHardhatArguments)(hardhat_params_1.HARDHAT_PARAM_DEFINITIONS, process.env);
        const argumentsParser = new ArgumentsParser_1.ArgumentsParser();
        const { hardhatArguments, taskName: parsedTaskName, unparsedCLAs, } = argumentsParser.parseHardhatArguments(hardhat_params_1.HARDHAT_PARAM_DEFINITIONS, envVariableArguments, process.argv.slice(2));
        if (hardhatArguments.verbose) {
            reporter_1.Reporter.setVerbose(true);
            debug_1.default.enable("hardhat*");
        }
        if (hardhatArguments.emoji) {
            (0, emoji_1.enableEmoji)();
        }
        showStackTraces = hardhatArguments.showStackTraces;
        // --version is a special case
        if (hardhatArguments.version) {
            await printVersionMessage();
            return;
        }
        if (hardhatArguments.config === undefined && !(0, project_structure_1.isCwdInsideProject)()) {
            if (process.stdout.isTTY === true ||
                process.env.HARDHAT_CREATE_JAVASCRIPT_PROJECT_WITH_DEFAULTS !==
                    undefined ||
                process.env.HARDHAT_CREATE_TYPESCRIPT_PROJECT_WITH_DEFAULTS !==
                    undefined) {
                await (0, project_creation_1.createProject)();
                return;
            }
            // Many terminal emulators in windows fail to run the createProject()
            // workflow, and don't present themselves as TTYs. If we are in this
            // situation we throw a special error instructing the user to use WSL or
            // powershell to initialize the project.
            if (process.platform === "win32") {
                throw new errors_1.HardhatError(errors_list_1.ERRORS.GENERAL.NOT_INSIDE_PROJECT_ON_WINDOWS);
            }
        }
        if (process.env.HARDHAT_EXPERIMENTAL_ALLOW_NON_LOCAL_INSTALLATION !==
            "true" &&
            !(0, execution_mode_1.isHardhatInstalledLocallyOrLinked)()) {
            throw new errors_1.HardhatError(errors_list_1.ERRORS.GENERAL.NON_LOCAL_INSTALLATION);
        }
        if ((0, typescript_support_1.willRunWithTypescript)(hardhatArguments.config)) {
            (0, typescript_support_1.loadTsNode)(hardhatArguments.tsconfig, hardhatArguments.typecheck);
        }
        else {
            if (hardhatArguments.typecheck === true) {
                throw new errors_1.HardhatError(errors_list_1.ERRORS.ARGUMENTS.TYPECHECK_USED_IN_JAVASCRIPT_PROJECT);
            }
        }
        let taskName = parsedTaskName ?? task_names_1.TASK_HELP;
        const showEmptyConfigWarning = true;
        const showSolidityConfigWarnings = taskName === task_names_1.TASK_COMPILE;
        const ctx = context_1.HardhatContext.createHardhatContext();
        const { resolvedConfig, userConfig } = (0, config_loading_1.loadConfigAndTasks)(hardhatArguments, {
            showEmptyConfigWarning,
            showSolidityConfigWarnings,
        });
        (0, configStore_1.setConfig)(resolvedConfig);
        let telemetryConsent = (0, global_dir_1.hasConsentedTelemetry)();
        const isHelpCommand = hardhatArguments.help || taskName === task_names_1.TASK_HELP;
        if (telemetryConsent === undefined &&
            !isHelpCommand &&
            !(0, ci_detection_1.isRunningOnCiServer)() &&
            process.stdout.isTTY === true &&
            process.env.HARDHAT_DISABLE_TELEMETRY_PROMPT !== "true") {
            telemetryConsent = await (0, prompt_1.confirmTelemetryConsent)();
            if (telemetryConsent !== undefined) {
                (0, global_dir_1.writeTelemetryConsent)(telemetryConsent);
            }
        }
        const analytics = await analytics_1.Analytics.getInstance(telemetryConsent);
        reporter_1.Reporter.setConfigPath(resolvedConfig.paths.configFile);
        if (telemetryConsent === true) {
            reporter_1.Reporter.setEnabled(true);
        }
        const envExtenders = ctx.environmentExtenders;
        const providerExtenders = ctx.providerExtenders;
        const taskDefinitions = ctx.tasksDSL.getTaskDefinitions();
        const [abortAnalytics, hitPromise] = await analytics.sendTaskHit();
        let taskArguments;
        // --help is a also special case
        if (hardhatArguments.help && taskName !== task_names_1.TASK_HELP) {
            taskArguments = { task: taskName };
            taskName = task_names_1.TASK_HELP;
        }
        else {
            const taskDefinition = taskDefinitions[taskName];
            if (taskDefinition === undefined) {
                throw new errors_1.HardhatError(errors_list_1.ERRORS.ARGUMENTS.UNRECOGNIZED_TASK, {
                    task: taskName,
                });
            }
            if (taskDefinition.isSubtask) {
                throw new errors_1.HardhatError(errors_list_1.ERRORS.ARGUMENTS.RUNNING_SUBTASK_FROM_CLI, {
                    name: taskDefinition.name,
                });
            }
            taskArguments = argumentsParser.parseTaskArguments(taskDefinition, unparsedCLAs);
        }
        const env = new runtime_environment_1.Environment(resolvedConfig, hardhatArguments, taskDefinitions, envExtenders, ctx.experimentalHardhatNetworkMessageTraceHooks, userConfig, providerExtenders);
        ctx.setHardhatRuntimeEnvironment(env);
        try {
            const timestampBeforeRun = new Date().getTime();
            await env.run(taskName, taskArguments);
            const timestampAfterRun = new Date().getTime();
            if (timestampAfterRun - timestampBeforeRun >
                ANALYTICS_SLOW_TASK_THRESHOLD &&
                taskName !== task_names_1.TASK_COMPILE) {
                await hitPromise;
            }
            else {
                abortAnalytics();
            }
        }
        finally {
            if (hardhatArguments.flamegraph === true) {
                (0, errors_1.assertHardhatInvariant)(env.entryTaskProfile !== undefined, "--flamegraph was set but entryTaskProfile is not defined");
                const flamegraphPath = (0, flamegraph_1.saveFlamegraph)(env.entryTaskProfile);
                console.log("Created flamegraph file", flamegraphPath);
            }
        }
        // VSCode extension prompt for installation
        if (taskName === task_names_1.TASK_TEST &&
            !(0, ci_detection_1.isRunningOnCiServer)() &&
            process.stdout.isTTY === true) {
            await suggestInstallingHardhatVscode();
            // we show the viaIR warning only if the tests failed
            if (process.exitCode !== 0) {
                showViaIRWarning(resolvedConfig);
            }
        }
        log(`Killing Hardhat after successfully running task ${taskName}`);
    }
    catch (error) {
        let isHardhatError = false;
        if (errors_1.HardhatError.isHardhatError(error)) {
            isHardhatError = true;
            console.error(chalk_1.default.red.bold("Error"), error.message.replace(/^\w+:/, (t) => chalk_1.default.red.bold(t)));
        }
        else if (errors_1.HardhatPluginError.isHardhatPluginError(error)) {
            isHardhatError = true;
            console.error(chalk_1.default.red.bold(`Error in plugin ${error.pluginName}:`), error.message);
        }
        else if (error instanceof Error) {
            console.error(chalk_1.default.red("An unexpected error occurred:"));
            showStackTraces = true;
        }
        else {
            console.error(chalk_1.default.red("An unexpected error occurred."));
            showStackTraces = true;
        }
        console.log("");
        try {
            reporter_1.Reporter.reportError(error);
        }
        catch (e) {
            log("Couldn't report error to sentry: %O", e);
        }
        if (showStackTraces || SHOULD_SHOW_STACK_TRACES_BY_DEFAULT) {
            console.error(error);
        }
        else {
            if (!isHardhatError) {
                console.error(`If you think this is a bug in Hardhat, please report it here: https://hardhat.org/report-bug`);
            }
            if (errors_1.HardhatError.isHardhatError(error)) {
                const link = `https://hardhat.org/${(0, errors_list_1.getErrorCode)(error.errorDescriptor)}`;
                console.error(`For more info go to ${link} or run ${constants_1.HARDHAT_NAME} with --show-stack-traces`);
            }
            else {
                console.error(`For more info run ${constants_1.HARDHAT_NAME} with --show-stack-traces`);
            }
        }
        await reporter_1.Reporter.close(1000);
        process.exit(1);
    }
}
main()
    .then(() => process.exit(process.exitCode))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
