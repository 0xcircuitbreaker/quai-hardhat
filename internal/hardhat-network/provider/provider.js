"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardhatNetworkProvider = exports.DEFAULT_COINBASE = void 0;
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const events_1 = require("events");
const fs_extra_1 = __importDefault(require("fs-extra"));
const semver_1 = __importDefault(require("semver"));
const constants_1 = require("../../constants");
const errors_1 = require("../../core/providers/errors");
const await_semaphore_1 = require("../../vendor/await-semaphore");
const constants_2 = require("../stack-traces/constants");
const MiningTimer_1 = require("./MiningTimer");
const debug_2 = require("./modules/debug");
const eth_1 = require("./modules/eth");
const evm_1 = require("./modules/evm");
const hardhat_1 = require("./modules/hardhat");
const personal_1 = require("./modules/personal");
const net_1 = require("./modules/net");
const web3_1 = require("./modules/web3");
const node_1 = require("./node");
const log = (0, debug_1.default)("hardhat:core:hardhat-network:provider");
// Set of methods that are never logged
const PRIVATE_RPC_METHODS = new Set([
    "hardhat_getStackTraceFailuresCount",
    "hardhat_setLoggingEnabled",
]);
/* eslint-disable @nomicfoundation/hardhat-internal-rules/only-hardhat-error */
exports.DEFAULT_COINBASE = "0xc014ba5ec014ba5ec014ba5ec014ba5ec014ba5e";
class HardhatNetworkProvider extends events_1.EventEmitter {
    constructor(_config, _logger, _artifacts) {
        super();
        this._config = _config;
        this._logger = _logger;
        this._artifacts = _artifacts;
        this._mutex = new await_semaphore_1.Mutex();
        this._ethEventListener = (payload) => {
            const subscription = `0x${payload.filterId.toString(16)}`;
            const result = payload.result;
            this._emitLegacySubscriptionEvent(subscription, result);
            this._emitEip1193SubscriptionEvent(subscription, result);
        };
    }
    async request(args) {
        const release = await this._mutex.acquire();
        if (args.params !== undefined && !Array.isArray(args.params)) {
            throw new errors_1.InvalidInputError("Hardhat Network doesn't support JSON-RPC params sent as an object");
        }
        try {
            let result;
            if (this._logger.isEnabled() && !PRIVATE_RPC_METHODS.has(args.method)) {
                result = await this._sendWithLogging(args.method, args.params);
            }
            else {
                result = await this._send(args.method, args.params);
            }
            if (args.method === "hardhat_reset") {
                this.emit(constants_1.HARDHAT_NETWORK_RESET_EVENT);
            }
            if (args.method === "evm_revert") {
                this.emit(constants_1.HARDHAT_NETWORK_REVERT_SNAPSHOT_EVENT);
            }
            return result;
        }
        finally {
            release();
        }
    }
    async _sendWithLogging(method, params = []) {
        try {
            const result = await this._send(method, params);
            // We log after running the method, because we want to use different
            // colors depending on whether it failed or not
            // TODO: If an eth_call, eth_sendTransaction, or eth_sendRawTransaction
            //  fails without throwing, this will be displayed in green. It's unclear
            //  if this is correct. See Eth module's TODOs for more info.
            if (method !== "hardhat_intervalMine") {
                this._logger.printMethod(method);
                const printedSomething = this._logger.printLogs();
                if (printedSomething) {
                    this._logger.printEmptyLine();
                }
            }
            return result;
        }
        catch (err) {
            if (err instanceof errors_1.MethodNotFoundError ||
                err instanceof errors_1.MethodNotSupportedError) {
                this._logger.printMethodNotSupported(method);
                throw err;
            }
            this._logger.printFailedMethod(method);
            this._logger.printLogs();
            if (err instanceof Error && !this._logger.isLoggedError(err)) {
                if (errors_1.ProviderError.isProviderError(err)) {
                    this._logger.printEmptyLine();
                    this._logger.printErrorMessage(err.message);
                    const isEIP155Error = err instanceof errors_1.InvalidInputError && err.message.includes("EIP155");
                    if (isEIP155Error) {
                        this._logger.printMetaMaskWarning();
                    }
                }
                else {
                    this._logger.printUnknownError(err);
                }
            }
            this._logger.printEmptyLine();
            throw err;
        }
    }
    async _send(method, params = []) {
        await this._init();
        if (method.startsWith("eth_")) {
            return this._ethModule.processRequest(method, params);
        }
        if (method.startsWith("net_")) {
            return this._netModule.processRequest(method, params);
        }
        if (method.startsWith("web3_")) {
            return this._web3Module.processRequest(method, params);
        }
        if (method.startsWith("evm_")) {
            return this._evmModule.processRequest(method, params);
        }
        if (method.startsWith("hardhat_")) {
            return this._hardhatModule.processRequest(method, params);
        }
        if (method.startsWith("debug_")) {
            return this._debugModule.processRequest(method, params);
        }
        if (method.startsWith("personal_")) {
            return this._personalModule.processRequest(method, params);
        }
        throw new errors_1.MethodNotFoundError(`Method ${method} not found`);
    }
    async _init() {
        if (this._node !== undefined) {
            return;
        }
        const config = {
            automine: this._config.automine,
            blockGasLimit: this._config.blockGasLimit,
            minGasPrice: this._config.minGasPrice,
            genesisAccounts: this._config.genesisAccounts,
            allowUnlimitedContractSize: this._config.allowUnlimitedContractSize,
            tracingConfig: await this._makeTracingConfig(),
            initialBaseFeePerGas: this._config.initialBaseFeePerGas,
            mempoolOrder: this._config.mempoolOrder,
            hardfork: this._config.hardfork,
            chainId: this._config.chainId,
            networkId: this._config.networkId,
            initialDate: this._config.initialDate,
            forkConfig: this._config.forkConfig,
            forkCachePath: this._config.forkConfig !== undefined
                ? this._config.forkCachePath
                : undefined,
            coinbase: this._config.coinbase ?? exports.DEFAULT_COINBASE,
            chains: this._config.chains,
            allowBlocksWithSameTimestamp: this._config.allowBlocksWithSameTimestamp,
            enableTransientStorage: this._config.enableTransientStorage,
        };
        const [common, node] = await node_1.HardhatNode.create(config);
        this._common = common;
        this._node = node;
        this._ethModule = new eth_1.EthModule(common, node, this._config.throwOnTransactionFailures, this._config.throwOnCallFailures, this._logger, this._config.experimentalHardhatNetworkMessageTraceHooks);
        const miningTimer = this._makeMiningTimer();
        this._netModule = new net_1.NetModule(common);
        this._web3Module = new web3_1.Web3Module(node);
        this._evmModule = new evm_1.EvmModule(node, miningTimer, this._logger, this._config.allowBlocksWithSameTimestamp, this._config.experimentalHardhatNetworkMessageTraceHooks);
        this._hardhatModule = new hardhat_1.HardhatModule(node, (forkConfig) => this._reset(miningTimer, forkConfig), (loggingEnabled) => {
            this._logger.setEnabled(loggingEnabled);
        }, this._logger, this._config.experimentalHardhatNetworkMessageTraceHooks);
        this._debugModule = new debug_2.DebugModule(node);
        this._personalModule = new personal_1.PersonalModule(node);
        this._forwardNodeEvents(node);
    }
    async _makeTracingConfig() {
        if (this._artifacts !== undefined) {
            const buildInfos = [];
            const buildInfoFiles = await this._artifacts.getBuildInfoPaths();
            try {
                for (const buildInfoFile of buildInfoFiles) {
                    const buildInfo = await fs_extra_1.default.readJson(buildInfoFile);
                    if (semver_1.default.gte(buildInfo.solcVersion, constants_2.FIRST_SOLC_VERSION_SUPPORTED)) {
                        buildInfos.push(buildInfo);
                    }
                }
                return {
                    buildInfos,
                };
            }
            catch (error) {
                console.warn(chalk_1.default.yellow("Stack traces engine could not be initialized. Run Hardhat with --verbose to learn more."));
                log("Solidity stack traces disabled: Failed to read solc's input and output files. Please report this to help us improve Hardhat.\n", error);
            }
        }
    }
    _makeMiningTimer() {
        const miningTimer = new MiningTimer_1.MiningTimer(this._config.intervalMining, async () => {
            try {
                await this.request({ method: "hardhat_intervalMine" });
            }
            catch (e) {
                console.error("Unexpected error calling hardhat_intervalMine:", e);
            }
        });
        miningTimer.start();
        return miningTimer;
    }
    async _reset(miningTimer, forkConfig) {
        this._config.forkConfig = forkConfig;
        if (this._node !== undefined) {
            this._stopForwardingNodeEvents(this._node);
        }
        this._node = undefined;
        miningTimer.stop();
        await this._init();
    }
    _forwardNodeEvents(node) {
        node.addListener("ethEvent", this._ethEventListener);
    }
    _stopForwardingNodeEvents(node) {
        node.removeListener("ethEvent", this._ethEventListener);
    }
    _emitLegacySubscriptionEvent(subscription, result) {
        this.emit("notification", {
            subscription,
            result,
        });
    }
    _emitEip1193SubscriptionEvent(subscription, result) {
        const message = {
            type: "eth_subscription",
            data: {
                subscription,
                result,
            },
        };
        this.emit("message", message);
    }
}
exports.HardhatNetworkProvider = HardhatNetworkProvider;
