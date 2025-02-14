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
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldShowEffectiveGasPriceForHardfork = exports.shouldShowTransactionTypeForHardfork = exports.toRpcLogOutput = exports.remoteReceiptToRpcReceiptOutput = exports.getRpcReceiptOutputsFromLocalBlockExecution = exports.getRpcTransaction = exports.getRpcBlock = void 0;
const ethereumjs_util_1 = require("@nomicfoundation/ethereumjs-util");
const BigIntUtils = __importStar(require("../../util/bigint"));
const errors_1 = require("../../core/errors");
const base_types_1 = require("../../core/jsonrpc/types/base-types");
const assertions_1 = require("./utils/assertions");
const FIRST_HARDFORK_WITH_TRANSACTION_TYPE = "berlin";
const FIRST_HARDFORK_WITH_EIP1559 = "london";
/* eslint-disable @nomicfoundation/hardhat-internal-rules/only-hardhat-error */
function getRpcBlock(block, totalDifficulty, showTransactionType, includeTransactions = true, pending = false) {
    const transactions = includeTransactions
        ? block.transactions.map((tx, index) => getRpcTransaction(tx, showTransactionType, block, index))
        : block.transactions.map((tx) => (0, base_types_1.bufferToRpcData)(tx.hash()));
    const output = {
        number: pending ? null : (0, base_types_1.numberToRpcQuantity)(block.header.number),
        hash: pending ? null : (0, base_types_1.bufferToRpcData)(block.hash()),
        parentHash: (0, base_types_1.bufferToRpcData)(block.header.parentHash),
        // We pad this to 8 bytes because of a limitation in The Graph
        // See: https://github.com/nomiclabs/hardhat/issues/491
        nonce: pending ? null : (0, base_types_1.bufferToRpcData)(block.header.nonce, 8),
        mixHash: pending ? null : (0, base_types_1.bufferToRpcData)(block.header.mixHash, 32),
        sha3Uncles: (0, base_types_1.bufferToRpcData)(block.header.uncleHash),
        logsBloom: (0, base_types_1.bufferToRpcData)(block.header.logsBloom),
        transactionsRoot: (0, base_types_1.bufferToRpcData)(block.header.transactionsTrie),
        stateRoot: (0, base_types_1.bufferToRpcData)(block.header.stateRoot),
        receiptsRoot: (0, base_types_1.bufferToRpcData)(block.header.receiptTrie),
        miner: (0, base_types_1.bufferToRpcData)(block.header.coinbase.toBuffer()),
        difficulty: (0, base_types_1.numberToRpcQuantity)(block.header.difficulty),
        totalDifficulty: (0, base_types_1.numberToRpcQuantity)(totalDifficulty),
        extraData: (0, base_types_1.bufferToRpcData)(block.header.extraData),
        size: (0, base_types_1.numberToRpcQuantity)(block.serialize().length),
        gasLimit: (0, base_types_1.numberToRpcQuantity)(block.header.gasLimit),
        gasUsed: (0, base_types_1.numberToRpcQuantity)(block.header.gasUsed),
        timestamp: (0, base_types_1.numberToRpcQuantity)(block.header.timestamp),
        transactions,
        uncles: block.uncleHeaders.map((uh) => (0, base_types_1.bufferToRpcData)(uh.hash())),
    };
    if (block.header.baseFeePerGas !== undefined) {
        output.baseFeePerGas = (0, base_types_1.numberToRpcQuantity)(block.header.baseFeePerGas);
    }
    if (block.header.withdrawalsRoot !== undefined) {
        output.withdrawals = block.withdrawals?.map((withdrawal) => ({
            index: (0, base_types_1.numberToRpcQuantity)(withdrawal.index),
            validatorIndex: (0, base_types_1.numberToRpcQuantity)(withdrawal.validatorIndex),
            address: (0, base_types_1.bufferToRpcData)(withdrawal.address.toBuffer()),
            amount: (0, base_types_1.numberToRpcQuantity)(withdrawal.amount),
        }));
        output.withdrawalsRoot = (0, base_types_1.bufferToRpcData)(block.header.withdrawalsRoot);
    }
    return output;
}
exports.getRpcBlock = getRpcBlock;
function getRpcTransaction(tx, showTransactionType, block, index) {
    // only already signed transactions should be used here,
    // but there is no type in ethereumjs for that
    (0, errors_1.assertHardhatInvariant)(tx.v !== undefined, "tx should be signed");
    (0, errors_1.assertHardhatInvariant)(tx.r !== undefined, "tx should be signed");
    (0, errors_1.assertHardhatInvariant)(tx.s !== undefined, "tx should be signed");
    const isTypedTransaction = tx.type !== 0;
    const baseOutput = {
        blockHash: block === "pending" ? null : (0, base_types_1.bufferToRpcData)(block.hash()),
        blockNumber: block === "pending" ? null : (0, base_types_1.numberToRpcQuantity)(block.header.number),
        from: (0, base_types_1.bufferToRpcData)(tx.getSenderAddress().toBuffer()),
        gas: (0, base_types_1.numberToRpcQuantity)(tx.gasLimit),
        hash: (0, base_types_1.bufferToRpcData)(tx.hash()),
        input: (0, base_types_1.bufferToRpcData)(tx.data),
        nonce: (0, base_types_1.numberToRpcQuantity)(tx.nonce),
        to: tx.to === undefined ? null : (0, base_types_1.bufferToRpcData)(tx.to.toBuffer()),
        transactionIndex: index !== undefined ? (0, base_types_1.numberToRpcQuantity)(index) : null,
        value: (0, base_types_1.numberToRpcQuantity)(tx.value),
        v: (0, base_types_1.numberToRpcQuantity)(tx.v),
        r: (0, base_types_1.numberToRpcQuantity)(tx.r),
        s: (0, base_types_1.numberToRpcQuantity)(tx.s),
        type: showTransactionType || isTypedTransaction
            ? (0, base_types_1.numberToRpcQuantity)(tx.type)
            : undefined,
        accessList: "accessList" in tx
            ? tx.accessList.map(([address, storageKeys]) => ({
                address: (0, ethereumjs_util_1.bufferToHex)(address),
                storageKeys: storageKeys.map(ethereumjs_util_1.bufferToHex),
            }))
            : undefined,
        chainId: "chainId" in tx ? (0, base_types_1.numberToRpcQuantity)(tx.chainId) : undefined,
    };
    if ("maxFeePerGas" in tx) {
        const effectiveGasPrice = block === "pending"
            ? tx.maxFeePerGas
            : getEffectiveGasPrice(tx, block.header.baseFeePerGas);
        // EIP-1559
        return {
            ...baseOutput,
            gasPrice: (0, base_types_1.numberToRpcQuantity)(effectiveGasPrice),
            chainId: (0, base_types_1.numberToRpcQuantity)(tx.chainId),
            maxFeePerGas: (0, base_types_1.numberToRpcQuantity)(tx.maxFeePerGas),
            maxPriorityFeePerGas: (0, base_types_1.numberToRpcQuantity)(tx.maxPriorityFeePerGas),
        };
    }
    // Not EIP-1559
    return {
        ...baseOutput,
        gasPrice: (0, base_types_1.numberToRpcQuantity)(tx.gasPrice),
    };
}
exports.getRpcTransaction = getRpcTransaction;
function getEffectiveGasPrice(tx, baseFeePerGas) {
    const maxFeePerGas = "maxFeePerGas" in tx ? tx.maxFeePerGas : tx.gasPrice;
    const maxPriorityFeePerGas = "maxPriorityFeePerGas" in tx ? tx.maxPriorityFeePerGas : tx.gasPrice;
    return (baseFeePerGas +
        BigIntUtils.min(maxFeePerGas - baseFeePerGas, maxPriorityFeePerGas));
}
function getRpcReceiptOutputsFromLocalBlockExecution(block, runBlockResult, showTransactionType) {
    const receipts = [];
    let blockLogIndex = 0;
    for (let i = 0; i < runBlockResult.results.length; i += 1) {
        const tx = block.transactions[i];
        const { createdAddress, totalGasSpent } = runBlockResult.results[i];
        const receipt = runBlockResult.receipts[i];
        const logs = receipt.logs.map((log) => {
            const result = getRpcLogOutput(log, tx, block, i, blockLogIndex);
            blockLogIndex += 1;
            return result;
        });
        const rpcReceipt = {
            transactionHash: (0, base_types_1.bufferToRpcData)(tx.hash()),
            transactionIndex: (0, base_types_1.numberToRpcQuantity)(i),
            blockHash: (0, base_types_1.bufferToRpcData)(block.hash()),
            blockNumber: (0, base_types_1.numberToRpcQuantity)(block.header.number),
            from: (0, base_types_1.bufferToRpcData)(tx.getSenderAddress().toBuffer()),
            to: tx.to === undefined ? null : (0, base_types_1.bufferToRpcData)(tx.to.toBuffer()),
            cumulativeGasUsed: (0, base_types_1.numberToRpcQuantity)(receipt.cumulativeBlockGasUsed),
            gasUsed: (0, base_types_1.numberToRpcQuantity)(totalGasSpent),
            contractAddress: createdAddress !== undefined
                ? (0, base_types_1.bufferToRpcData)(createdAddress.toBuffer())
                : null,
            logs,
            logsBloom: (0, base_types_1.bufferToRpcData)(receipt.bitvector),
            // There's no way to execute an EIP-2718 tx locally if we aren't in
            // an HF >= Berlin, so this check is enough
            type: showTransactionType ? (0, base_types_1.numberToRpcQuantity)(tx.type) : undefined,
        };
        if ("stateRoot" in receipt) {
            rpcReceipt.root = (0, base_types_1.bufferToRpcData)(receipt.stateRoot);
        }
        else {
            rpcReceipt.status = (0, base_types_1.numberToRpcQuantity)(receipt.status);
        }
        if (block.header.baseFeePerGas !== undefined) {
            const effectiveGasPrice = getEffectiveGasPrice(tx, block.header.baseFeePerGas);
            rpcReceipt.effectiveGasPrice = (0, base_types_1.numberToRpcQuantity)(effectiveGasPrice);
        }
        receipts.push(rpcReceipt);
    }
    return receipts;
}
exports.getRpcReceiptOutputsFromLocalBlockExecution = getRpcReceiptOutputsFromLocalBlockExecution;
function remoteReceiptToRpcReceiptOutput(receipt, tx, showTransactionType, showEffectiveGasPrice) {
    const isTypedTransaction = tx.type !== 0;
    const effectiveGasPrice = receipt.effectiveGasPrice ?? ("gasPrice" in tx ? tx.gasPrice : undefined);
    (0, assertions_1.assertHardhatNetworkInvariant)(effectiveGasPrice !== undefined, "Receipt without effectiveGasPrice nor gasPrice in its tx");
    return {
        blockHash: (0, base_types_1.bufferToRpcData)(receipt.blockHash),
        blockNumber: (0, base_types_1.numberToRpcQuantity)(receipt.blockNumber),
        contractAddress: receipt.contractAddress !== null
            ? (0, base_types_1.bufferToRpcData)(receipt.contractAddress)
            : null,
        cumulativeGasUsed: (0, base_types_1.numberToRpcQuantity)(receipt.cumulativeGasUsed),
        from: (0, base_types_1.bufferToRpcData)(receipt.from),
        gasUsed: (0, base_types_1.numberToRpcQuantity)(receipt.gasUsed),
        logs: receipt.logs.map(toRpcLogOutput),
        logsBloom: (0, base_types_1.bufferToRpcData)(receipt.logsBloom),
        status: receipt.status !== undefined && receipt.status !== null
            ? (0, base_types_1.numberToRpcQuantity)(receipt.status)
            : undefined,
        root: receipt.root !== undefined ? (0, base_types_1.bufferToRpcData)(receipt.root) : undefined,
        to: receipt.to !== null ? (0, base_types_1.bufferToRpcData)(receipt.to) : null,
        transactionHash: (0, base_types_1.bufferToRpcData)(receipt.transactionHash),
        transactionIndex: (0, base_types_1.numberToRpcQuantity)(receipt.transactionIndex),
        type: showTransactionType || isTypedTransaction
            ? (0, base_types_1.numberToRpcQuantity)(tx.type)
            : undefined,
        effectiveGasPrice: showEffectiveGasPrice || tx.type === 2
            ? (0, base_types_1.numberToRpcQuantity)(effectiveGasPrice)
            : undefined,
    };
}
exports.remoteReceiptToRpcReceiptOutput = remoteReceiptToRpcReceiptOutput;
function toRpcLogOutput(log) {
    return {
        removed: false,
        address: (0, base_types_1.bufferToRpcData)(log.address),
        blockHash: log.blockHash !== null ? (0, base_types_1.bufferToRpcData)(log.blockHash) : null,
        blockNumber: log.blockNumber !== null ? (0, base_types_1.numberToRpcQuantity)(log.blockNumber) : null,
        data: (0, base_types_1.bufferToRpcData)(log.data),
        logIndex: log.logIndex !== null ? (0, base_types_1.numberToRpcQuantity)(log.logIndex) : null,
        transactionIndex: log.transactionIndex !== null
            ? (0, base_types_1.numberToRpcQuantity)(log.transactionIndex)
            : null,
        transactionHash: log.transactionHash !== null
            ? (0, base_types_1.bufferToRpcData)(log.transactionHash)
            : null,
        topics: log.topics.map((topic) => (0, base_types_1.bufferToRpcData)(topic)),
    };
}
exports.toRpcLogOutput = toRpcLogOutput;
function getRpcLogOutput(log, tx, block, transactionIndex, logIndex) {
    return {
        removed: false,
        logIndex: logIndex !== undefined ? (0, base_types_1.numberToRpcQuantity)(logIndex) : null,
        transactionIndex: transactionIndex !== undefined
            ? (0, base_types_1.numberToRpcQuantity)(transactionIndex)
            : null,
        transactionHash: block !== undefined ? (0, base_types_1.bufferToRpcData)(tx.hash()) : null,
        blockHash: block !== undefined ? (0, base_types_1.bufferToRpcData)(block.hash()) : null,
        blockNumber: block !== undefined ? (0, base_types_1.numberToRpcQuantity)(block.header.number) : null,
        address: (0, base_types_1.bufferToRpcData)(log[0]),
        data: (0, base_types_1.bufferToRpcData)(log[2]),
        topics: log[1].map((topic) => (0, base_types_1.bufferToRpcData)(topic)),
    };
}
function shouldShowTransactionTypeForHardfork(common) {
    return common.gteHardfork(FIRST_HARDFORK_WITH_TRANSACTION_TYPE);
}
exports.shouldShowTransactionTypeForHardfork = shouldShowTransactionTypeForHardfork;
function shouldShowEffectiveGasPriceForHardfork(common) {
    return common.gteHardfork(FIRST_HARDFORK_WITH_EIP1559);
}
exports.shouldShowEffectiveGasPriceForHardfork = shouldShowEffectiveGasPriceForHardfork;
