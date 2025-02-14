"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = exports.EMPTY_HARDHAT_CONFIG = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const constants_1 = require("../constants");
const errors_1 = require("../core/errors");
const errors_list_1 = require("../core/errors-list");
const project_structure_1 = require("../core/project-structure");
const fs_utils_1 = require("../util/fs-utils");
const global_dir_1 = require("../util/global-dir");
const lang_1 = require("../util/lang");
const packageInfo_1 = require("../util/packageInfo");
const strings_1 = require("../util/strings");
const prompt_1 = require("./prompt");
const emoji_1 = require("./emoji");
var Action;
(function (Action) {
    Action["CREATE_JAVASCRIPT_PROJECT_ACTION"] = "Create a JavaScript project";
    Action["CREATE_TYPESCRIPT_PROJECT_ACTION"] = "Create a TypeScript project";
    Action["CREATE_EMPTY_HARDHAT_CONFIG_ACTION"] = "Create an empty hardhat.config.js";
    Action["QUIT_ACTION"] = "Quit";
})(Action || (Action = {}));
const HARDHAT_PACKAGE_NAME = "hardhat";
const PROJECT_DEPENDENCIES = {
    "@nomicfoundation/hardhat-toolbox": "^3.0.0",
};
const PEER_DEPENDENCIES = {
    hardhat: "^2.14.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
    "@nomicfoundation/hardhat-ethers": "^3.0.0",
    "@nomicfoundation/hardhat-verify": "^1.0.0",
    chai: "^4.2.0",
    ethers: "^6.4.0",
    "hardhat-gas-reporter": "^1.0.8",
    "solidity-coverage": "^0.8.0",
    "@typechain/hardhat": "^8.0.0",
    typechain: "^8.1.0",
    "@typechain/ethers-v6": "^0.4.0",
};
const TYPESCRIPT_DEPENDENCIES = {};
const TYPESCRIPT_PEER_DEPENDENCIES = {
    "@types/chai": "^4.2.0",
    "@types/mocha": ">=9.1.0",
    "@types/node": ">=16.0.0",
    "ts-node": ">=8.0.0",
    typescript: ">=4.5.0",
};
// generated with the "colossal" font
function printAsciiLogo() {
    console.log(chalk_1.default.blue("888    888                      888 888               888"));
    console.log(chalk_1.default.blue("888    888                      888 888               888"));
    console.log(chalk_1.default.blue("888    888                      888 888               888"));
    console.log(chalk_1.default.blue("8888888888  8888b.  888d888 .d88888 88888b.   8888b.  888888"));
    console.log(chalk_1.default.blue('888    888     "88b 888P"  d88" 888 888 "88b     "88b 888'));
    console.log(chalk_1.default.blue("888    888 .d888888 888    888  888 888  888 .d888888 888"));
    console.log(chalk_1.default.blue("888    888 888  888 888    Y88b 888 888  888 888  888 Y88b."));
    console.log(chalk_1.default.blue('888    888 "Y888888 888     "Y88888 888  888 "Y888888  "Y888'));
    console.log("");
}
async function printWelcomeMessage() {
    const packageJson = await (0, packageInfo_1.getPackageJson)();
    console.log(chalk_1.default.cyan(`${(0, emoji_1.emoji)("👷 ")}Welcome to ${constants_1.HARDHAT_NAME} v${packageJson.version}${(0, emoji_1.emoji)(" 👷‍")}\n`));
}
async function copySampleProject(projectRoot, projectType, isEsm) {
    const packageRoot = (0, packageInfo_1.getPackageRoot)();
    let sampleProjectName;
    if (projectType === Action.CREATE_JAVASCRIPT_PROJECT_ACTION) {
        if (isEsm) {
            sampleProjectName = "javascript-esm";
        }
        else {
            sampleProjectName = "javascript";
        }
    }
    else {
        if (isEsm) {
            (0, errors_1.assertHardhatInvariant)(false, "Shouldn't try to create a TypeScript project in an ESM based project");
        }
        else {
            sampleProjectName = "typescript";
        }
    }
    await fs_extra_1.default.ensureDir(projectRoot);
    const sampleProjectPath = path_1.default.join(packageRoot, "sample-projects", sampleProjectName);
    // relative paths to all the sample project files
    const sampleProjectFiles = (await (0, fs_utils_1.getAllFilesMatching)(sampleProjectPath)).map((file) => path_1.default.relative(sampleProjectPath, file));
    // check if the target directory already has files that clash with the sample
    // project files
    const existingFiles = [];
    for (const file of sampleProjectFiles) {
        const targetProjectFile = path_1.default.resolve(projectRoot, file);
        // if the project already has a README.md file, we'll skip it when
        // we copy the files
        if (file !== "README.md" && fs_extra_1.default.existsSync(targetProjectFile)) {
            existingFiles.push(file);
        }
    }
    if (existingFiles.length > 0) {
        const errorMsg = `We couldn't initialize the sample project because ${(0, strings_1.pluralize)(existingFiles.length, "this file already exists", "these files already exist")}: ${existingFiles.join(", ")}

Please delete or rename ${(0, strings_1.pluralize)(existingFiles.length, "it", "them")} and try again.`;
        console.log(chalk_1.default.red(errorMsg));
        process.exit(1);
    }
    // copy the files
    for (const file of sampleProjectFiles) {
        const sampleProjectFile = path_1.default.resolve(sampleProjectPath, file);
        const targetProjectFile = path_1.default.resolve(projectRoot, file);
        if (file === "README.md" && fs_extra_1.default.existsSync(targetProjectFile)) {
            // we don't override the readme if it exists
            continue;
        }
        if (file === "LICENSE.md") {
            // we don't copy the license
            continue;
        }
        fs_extra_1.default.copySync(sampleProjectFile, targetProjectFile);
    }
}
async function addGitIgnore(projectRoot) {
    const gitIgnorePath = path_1.default.join(projectRoot, ".gitignore");
    let content = await (0, project_structure_1.getRecommendedGitIgnore)();
    if (await fs_extra_1.default.pathExists(gitIgnorePath)) {
        const existingContent = await fs_extra_1.default.readFile(gitIgnorePath, "utf-8");
        content = `${existingContent}
${content}`;
    }
    await fs_extra_1.default.writeFile(gitIgnorePath, content);
}
async function printRecommendedDepsInstallationInstructions(projectType) {
    console.log(`You need to install these dependencies to run the sample project:`);
    const cmd = await getRecommendedDependenciesInstallationCommand(await getDependencies(projectType));
    console.log(`  ${cmd.join(" ")}`);
}
// exported so we can test that it uses the latest supported version of solidity
exports.EMPTY_HARDHAT_CONFIG = `/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
};
`;
async function writeEmptyHardhatConfig(isEsm) {
    const hardhatConfigFilename = isEsm
        ? "hardhat.config.cjs"
        : "hardhat.config.js";
    return fs_extra_1.default.writeFile(hardhatConfigFilename, exports.EMPTY_HARDHAT_CONFIG, "utf-8");
}
async function getAction(isEsm) {
    if (process.env.HARDHAT_CREATE_JAVASCRIPT_PROJECT_WITH_DEFAULTS !== undefined) {
        return Action.CREATE_JAVASCRIPT_PROJECT_ACTION;
    }
    else if (process.env.HARDHAT_CREATE_TYPESCRIPT_PROJECT_WITH_DEFAULTS !== undefined) {
        return Action.CREATE_TYPESCRIPT_PROJECT_ACTION;
    }
    const { default: enquirer } = await Promise.resolve().then(() => __importStar(require("enquirer")));
    try {
        const actionResponse = await enquirer.prompt([
            {
                name: "action",
                type: "select",
                message: "What do you want to do?",
                initial: 0,
                choices: Object.values(Action).map((a) => {
                    let message;
                    if (isEsm) {
                        if (a === Action.CREATE_EMPTY_HARDHAT_CONFIG_ACTION) {
                            message = a.replace(".js", ".cjs");
                        }
                        else if (a === Action.CREATE_TYPESCRIPT_PROJECT_ACTION) {
                            message = `${a} (not available for ESM projects)`;
                        }
                        else {
                            message = a;
                        }
                    }
                    else {
                        message = a;
                    }
                    return {
                        name: a,
                        message,
                        value: a,
                    };
                }),
            },
        ]);
        if (Object.values(Action).includes(actionResponse.action)) {
            return actionResponse.action;
        }
        else {
            throw new errors_1.HardhatError(errors_list_1.ERRORS.GENERAL.UNSUPPORTED_OPERATION, {
                operation: `Responding with "${actionResponse.action}" to the project initialization wizard`,
            });
        }
    }
    catch (e) {
        if (e === "") {
            return Action.QUIT_ACTION;
        }
        // eslint-disable-next-line @nomicfoundation/hardhat-internal-rules/only-hardhat-error
        throw e;
    }
}
async function createPackageJson() {
    await fs_extra_1.default.writeJson("package.json", {
        name: "hardhat-project",
    }, { spaces: 2 });
}
function showStarOnGitHubMessage() {
    console.log(chalk_1.default.cyan("Give Hardhat a star on Github if you're enjoying it!") +
        (0, emoji_1.emoji)(" ⭐️✨"));
    console.log();
    console.log(chalk_1.default.cyan("     https://github.com/NomicFoundation/hardhat"));
}
async function createProject() {
    printAsciiLogo();
    await printWelcomeMessage();
    let packageJson;
    if (await fs_extra_1.default.pathExists("package.json")) {
        packageJson = await fs_extra_1.default.readJson("package.json");
    }
    const isEsm = packageJson?.type === "module";
    const action = await getAction(isEsm);
    if (action === Action.QUIT_ACTION) {
        return;
    }
    if (isEsm && action === Action.CREATE_TYPESCRIPT_PROJECT_ACTION) {
        throw new errors_1.HardhatError(errors_list_1.ERRORS.GENERAL.ESM_TYPESCRIPT_PROJECT_CREATION);
    }
    if (packageJson === undefined) {
        await createPackageJson();
    }
    if (action === Action.CREATE_EMPTY_HARDHAT_CONFIG_ACTION) {
        await writeEmptyHardhatConfig(isEsm);
        console.log(`${(0, emoji_1.emoji)("✨ ")}${chalk_1.default.cyan(`Config file created`)}${(0, emoji_1.emoji)(" ✨")}`);
        if (!isInstalled(HARDHAT_PACKAGE_NAME)) {
            console.log("");
            console.log(`You need to install hardhat locally to use it. Please run:`);
            const cmd = await getRecommendedDependenciesInstallationCommand({
                [HARDHAT_PACKAGE_NAME]: `^${(await (0, packageInfo_1.getPackageJson)()).version}`,
            });
            console.log("");
            console.log(cmd.join(" "));
            console.log("");
        }
        console.log();
        showStarOnGitHubMessage();
        return;
    }
    let responses;
    const useDefaultPromptResponses = process.env.HARDHAT_CREATE_JAVASCRIPT_PROJECT_WITH_DEFAULTS !== undefined ||
        process.env.HARDHAT_CREATE_TYPESCRIPT_PROJECT_WITH_DEFAULTS !== undefined;
    if (useDefaultPromptResponses) {
        responses = {
            projectRoot: process.cwd(),
            shouldAddGitIgnore: true,
        };
    }
    else {
        try {
            responses = await (0, prompt_1.confirmProjectCreation)();
        }
        catch (e) {
            if (e === "") {
                return;
            }
            // eslint-disable-next-line @nomicfoundation/hardhat-internal-rules/only-hardhat-error
            throw e;
        }
    }
    const { projectRoot, shouldAddGitIgnore } = responses;
    if (shouldAddGitIgnore) {
        await addGitIgnore(projectRoot);
    }
    if (process.env.HARDHAT_DISABLE_TELEMETRY_PROMPT !== "true" &&
        (0, global_dir_1.hasConsentedTelemetry)() === undefined) {
        const telemetryConsent = await (0, prompt_1.confirmTelemetryConsent)();
        if (telemetryConsent !== undefined) {
            (0, global_dir_1.writeTelemetryConsent)(telemetryConsent);
        }
    }
    await copySampleProject(projectRoot, action, isEsm);
    let shouldShowInstallationInstructions = true;
    if (await canInstallRecommendedDeps()) {
        const dependencies = await getDependencies(action);
        const recommendedDeps = Object.keys(dependencies);
        const dependenciesToInstall = (0, lang_1.fromEntries)(Object.entries(dependencies).filter(([name]) => !isInstalled(name)));
        const installedRecommendedDeps = recommendedDeps.filter(isInstalled);
        const installedExceptHardhat = installedRecommendedDeps.filter((name) => name !== HARDHAT_PACKAGE_NAME);
        if (installedRecommendedDeps.length === recommendedDeps.length) {
            shouldShowInstallationInstructions = false;
        }
        else if (installedExceptHardhat.length === 0) {
            const shouldInstall = useDefaultPromptResponses ||
                (await (0, prompt_1.confirmRecommendedDepsInstallation)(dependenciesToInstall, await getProjectPackageManager()));
            if (shouldInstall) {
                const installed = await installRecommendedDependencies(dependenciesToInstall);
                if (!installed) {
                    console.warn(chalk_1.default.red("Failed to install the sample project's dependencies"));
                }
                shouldShowInstallationInstructions = !installed;
            }
        }
    }
    if (shouldShowInstallationInstructions) {
        console.log(``);
        await printRecommendedDepsInstallationInstructions(action);
    }
    console.log(`\n${(0, emoji_1.emoji)("✨ ")}${chalk_1.default.cyan("Project created")}${(0, emoji_1.emoji)(" ✨")}`);
    console.log();
    console.log("See the README.md file for some example tasks you can run");
    console.log();
    showStarOnGitHubMessage();
}
exports.createProject = createProject;
async function canInstallRecommendedDeps() {
    return ((await fs_extra_1.default.pathExists("package.json")) &&
        // TODO: Figure out why this doesn't work on Win
        // cf. https://github.com/nomiclabs/hardhat/issues/1698
        os_1.default.type() !== "Windows_NT");
}
function isInstalled(dep) {
    const packageJson = fs_extra_1.default.readJSONSync("package.json");
    const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.optionalDependencies,
    };
    return dep in allDependencies;
}
async function isYarnProject() {
    return fs_extra_1.default.pathExists("yarn.lock");
}
async function isPnpmProject() {
    return fs_extra_1.default.pathExists("pnpm-lock.yaml");
}
async function getProjectPackageManager() {
    if (await isYarnProject())
        return "yarn";
    if (await isPnpmProject())
        return "pnpm";
    return "npm";
}
async function doesNpmAutoInstallPeerDependencies() {
    const { execSync } = require("child_process");
    try {
        const version = execSync("npm --version").toString();
        return parseInt(version.split(".")[0], 10) >= 7;
    }
    catch (_) {
        return false;
    }
}
async function installRecommendedDependencies(dependencies) {
    console.log("");
    // The reason we don't quote the dependencies here is because they are going
    // to be used in child_process.sapwn, which doesn't require escaping string,
    // and can actually fail if you do.
    const installCmd = await getRecommendedDependenciesInstallationCommand(dependencies, false);
    return installDependencies(installCmd[0], installCmd.slice(1));
}
async function installDependencies(packageManager, args) {
    const { spawn } = await Promise.resolve().then(() => __importStar(require("child_process")));
    console.log(`${packageManager} ${args.join(" ")}`);
    const childProcess = spawn(packageManager, args, {
        stdio: "inherit",
    });
    return new Promise((resolve, reject) => {
        childProcess.once("close", (status) => {
            childProcess.removeAllListeners("error");
            if (status === 0) {
                resolve(true);
                return;
            }
            reject(false);
        });
        childProcess.once("error", (_status) => {
            childProcess.removeAllListeners("close");
            reject(false);
        });
    });
}
async function getRecommendedDependenciesInstallationCommand(dependencies, quoteDependencies = true) {
    const deps = Object.entries(dependencies).map(([name, version]) => quoteDependencies ? `"${name}@${version}"` : `${name}@${version}`);
    if (await isYarnProject()) {
        return ["yarn", "add", "--dev", ...deps];
    }
    if (await isPnpmProject()) {
        return ["pnpm", "add", "-D", ...deps];
    }
    return ["npm", "install", "--save-dev", ...deps];
}
async function getDependencies(projectType) {
    const shouldInstallPeerDependencies = (await isYarnProject()) ||
        (await isPnpmProject()) ||
        !(await doesNpmAutoInstallPeerDependencies());
    const shouldInstallTypescriptDependencies = projectType === Action.CREATE_TYPESCRIPT_PROJECT_ACTION;
    const shouldInstallTypescriptPeerDependencies = shouldInstallTypescriptDependencies && shouldInstallPeerDependencies;
    return {
        [HARDHAT_PACKAGE_NAME]: `^${(await (0, packageInfo_1.getPackageJson)()).version}`,
        ...PROJECT_DEPENDENCIES,
        ...(shouldInstallPeerDependencies ? PEER_DEPENDENCIES : {}),
        ...(shouldInstallTypescriptDependencies ? TYPESCRIPT_DEPENDENCIES : {}),
        ...(shouldInstallTypescriptPeerDependencies
            ? TYPESCRIPT_PEER_DEPENDENCIES
            : {}),
    };
}
