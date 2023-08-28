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
exports.TxPool = exports.deserializeTransaction = exports.serializeTransaction = void 0;
const ethereumjs_tx_1 = require("@nomicfoundation/ethereumjs-tx");
const ethereumjs_util_1 = require("@nomicfoundation/ethereumjs-util");
const immutable_1 = require("immutable");
const errors_1 = require("../../core/providers/errors");
const BigIntUtils = __importStar(require("../../util/bigint"));
const PoolState_1 = require("./PoolState");
const FakeSenderAccessListEIP2930Transaction_1 = require("./transactions/FakeSenderAccessListEIP2930Transaction");
const FakeSenderTransaction_1 = require("./transactions/FakeSenderTransaction");
const reorganizeTransactionsLists_1 = require("./utils/reorganizeTransactionsLists");
const FakeSenderEIP1559Transaction_1 = require("./transactions/FakeSenderEIP1559Transaction");
/* eslint-disable @nomicfoundation/hardhat-internal-rules/only-hardhat-error */
function serializeTransaction(tx) {
    const rlpSerialization = (0, ethereumjs_util_1.bufferToHex)(tx.data.serialize());
    const isFake = tx.data instanceof FakeSenderTransaction_1.FakeSenderTransaction ||
        tx.data instanceof FakeSenderAccessListEIP2930Transaction_1.FakeSenderAccessListEIP2930Transaction ||
        tx.data instanceof FakeSenderEIP1559Transaction_1.FakeSenderEIP1559Transaction;
    return (0, PoolState_1.makeSerializedTransaction)({
        orderId: tx.orderId,
        fakeFrom: isFake ? tx.data.getSenderAddress().toString() : undefined,
        data: rlpSerialization,
        txType: tx.data.type,
    });
}
exports.serializeTransaction = serializeTransaction;
function deserializeTransaction(tx, common) {
    const rlpSerialization = tx.get("data");
    const fakeFrom = tx.get("fakeFrom");
    let data;
    if (fakeFrom !== undefined) {
        const sender = ethereumjs_util_1.Address.fromString(fakeFrom);
        const serialization = (0, ethereumjs_util_1.toBuffer)(rlpSerialization);
        if (tx.get("txType") === 1) {
            data =
                FakeSenderAccessListEIP2930Transaction_1.FakeSenderAccessListEIP2930Transaction.fromSenderAndRlpSerializedTx(sender, serialization, { common });
        }
        else if (tx.get("txType") === 2) {
            data = FakeSenderEIP1559Transaction_1.FakeSenderEIP1559Transaction.fromSenderAndRlpSerializedTx(sender, serialization, { common });
        }
        else {
            data = FakeSenderTransaction_1.FakeSenderTransaction.fromSenderAndRlpSerializedTx(sender, serialization, { common });
        }
    }
    else {
        data = ethereumjs_tx_1.TransactionFactory.fromSerializedData((0, ethereumjs_util_1.toBuffer)(rlpSerialization), {
            common,
            disableMaxInitCodeSizeCheck: true,
        });
    }
    return {
        orderId: tx.get("orderId"),
        data,
    };
}
exports.deserializeTransaction = deserializeTransaction;
class TxPool {
    constructor(_stateManager, blockGasLimit, common) {
        this._stateManager = _stateManager;
        this._snapshotIdToState = new Map();
        this._nextSnapshotId = 0;
        this._nextOrderId = 0;
        this._state = (0, PoolState_1.makePoolState)({
            blockGasLimit: BigIntUtils.toHex(blockGasLimit),
        });
        this._deserializeTransaction = (tx) => deserializeTransaction(tx, common);
    }
    async addTransaction(tx) {
        const senderAddress = this._getSenderAddress(tx);
        const nextConfirmedNonce = await this._getNextConfirmedNonce(senderAddress);
        const nextPendingNonce = await this.getNextPendingNonce(senderAddress);
        await this._validateTransaction(tx, senderAddress, nextConfirmedNonce);
        const txNonce = tx.nonce;
        if (txNonce > nextPendingNonce) {
            this._addQueuedTransaction(tx);
        }
        else {
            this._addPendingTransaction(tx);
        }
    }
    /**
     * Remove transaction with the given hash from the mempool. Returns true
     * if a transaction was removed, false otherwise.
     */
    removeTransaction(txHash) {
        const tx = this.getTransactionByHash(txHash);
        if (tx === undefined) {
            // transaction doesn't exist in the mempool
            return false;
        }
        this._deleteTransactionByHash(txHash);
        const serializedTx = serializeTransaction(tx);
        const senderAddress = this._getSenderAddress(tx.data).toString();
        const pendingForAddress = this._getPendingForAddress(senderAddress) ??
            (0, immutable_1.List)();
        const queuedForAddress = this._getQueuedForAddress(senderAddress) ??
            (0, immutable_1.List)();
        // if the tx to remove is in the pending state, remove it
        // and move the following transactions to the queued list
        const indexOfPendingTx = pendingForAddress.indexOf(serializedTx);
        if (indexOfPendingTx !== -1) {
            const newPendingForAddress = pendingForAddress.splice(indexOfPendingTx, pendingForAddress.size);
            const newQueuedForAddress = queuedForAddress.concat(pendingForAddress.slice(indexOfPendingTx + 1));
            this._setPendingForAddress(senderAddress, newPendingForAddress);
            this._setQueuedForAddress(senderAddress, newQueuedForAddress);
            return true;
        }
        // if the tx is in the queued state, we just remove it
        const indexOfQueuedTx = queuedForAddress.indexOf(serializedTx);
        if (indexOfQueuedTx !== -1) {
            const newQueuedForAddress = queuedForAddress.splice(indexOfQueuedTx, 1);
            this._setQueuedForAddress(senderAddress, newQueuedForAddress);
            return true;
        }
        throw new Error("Tx should have existed in the pending or queued lists");
    }
    snapshot() {
        const id = this._nextSnapshotId++;
        this._snapshotIdToState.set(id, this._state);
        return id;
    }
    revert(snapshotId) {
        const state = this._snapshotIdToState.get(snapshotId);
        if (state === undefined) {
            throw new Error("There's no snapshot with such ID");
        }
        this._state = state;
        this._removeSnapshotsAfter(snapshotId);
    }
    getTransactionByHash(hash) {
        const tx = this._getTransactionsByHash().get((0, ethereumjs_util_1.bufferToHex)(hash));
        if (tx !== undefined) {
            return this._deserializeTransaction(tx);
        }
        return undefined;
    }
    hasPendingTransactions() {
        const pendingMap = this._getPending();
        return pendingMap.some((senderPendingTxs) => !senderPendingTxs.isEmpty());
    }
    hasQueuedTransactions() {
        const queuedMap = this._getQueued();
        return queuedMap.some((senderQueuedTxs) => !senderQueuedTxs.isEmpty());
    }
    isEmpty() {
        return !(this.hasPendingTransactions() || this.hasQueuedTransactions());
    }
    getPendingTransactions() {
        const deserializedImmutableMap = this._getPending()
            .filter((txs) => txs.size > 0)
            .map((txs) => txs.map(this._deserializeTransaction).toJS());
        return new Map(deserializedImmutableMap.entries());
    }
    getQueuedTransactions() {
        const deserializedImmutableMap = this._getQueued()
            .filter((txs) => txs.size > 0)
            .map((txs) => txs.map(this._deserializeTransaction).toJS());
        return new Map(deserializedImmutableMap.entries());
    }
    /**
     * Returns the next available nonce for an address, taking into account
     * its pending transactions.
     */
    async getNextPendingNonce(accountAddress) {
        const pendingTxs = this._getPendingForAddress(accountAddress.toString());
        const lastPendingTx = pendingTxs?.last(undefined);
        if (lastPendingTx === undefined) {
            return this._getNextConfirmedNonce(accountAddress);
        }
        const lastPendingTxNonce = this._deserializeTransaction(lastPendingTx).data.nonce;
        return lastPendingTxNonce + 1n;
    }
    getBlockGasLimit() {
        return BigInt(this._state.get("blockGasLimit"));
    }
    setBlockGasLimit(newLimit) {
        if (typeof newLimit === "number") {
            newLimit = BigInt(newLimit);
        }
        this._setBlockGasLimit(newLimit);
    }
    /**
     * Updates the pending and queued list of all addresses
     */
    async updatePendingAndQueued() {
        let newPending = this._getPending();
        // update pending transactions
        for (const [address, txs] of newPending) {
            const senderAccount = await this._stateManager.getAccount(ethereumjs_util_1.Address.fromString(address));
            const senderNonce = senderAccount.nonce;
            const senderBalance = senderAccount.balance;
            let moveToQueued = false;
            for (const tx of txs) {
                const deserializedTx = this._deserializeTransaction(tx);
                if (moveToQueued) {
                    newPending = this._removeTx(newPending, address, deserializedTx);
                    const queued = this._getQueuedForAddress(address) ?? (0, immutable_1.List)();
                    this._setQueuedForAddress(address, queued.push(tx));
                    continue;
                }
                const txNonce = deserializedTx.data.nonce;
                if (!this._isTxValid(deserializedTx, txNonce, senderNonce, senderBalance)) {
                    newPending = this._removeTx(newPending, address, deserializedTx);
                    // if we are dropping a pending transaction with a valid nonce,
                    // then we move all the following txs to the queued list
                    if (txNonce >= senderNonce) {
                        moveToQueued = true;
                    }
                }
            }
        }
        this._setPending(newPending);
        // update queued addresses
        let newQueued = this._getQueued();
        for (const [address, txs] of newQueued) {
            const senderAccount = await this._stateManager.getAccount(ethereumjs_util_1.Address.fromString(address));
            const senderNonce = senderAccount.nonce;
            const senderBalance = senderAccount.balance;
            for (const tx of txs) {
                const deserializedTx = this._deserializeTransaction(tx);
                const txNonce = deserializedTx.data.nonce;
                if (!this._isTxValid(deserializedTx, txNonce, senderNonce, senderBalance)) {
                    newQueued = this._removeTx(newQueued, address, deserializedTx);
                }
            }
        }
        this._setQueued(newQueued);
    }
    _getSenderAddress(tx) {
        try {
            return tx.getSenderAddress(); // verifies signature
        }
        catch (e) {
            if (!tx.isSigned()) {
                throw new errors_1.InvalidInputError("Invalid Signature");
            }
            throw new errors_1.InvalidInputError(e.message);
        }
    }
    _removeSnapshotsAfter(snapshotId) {
        const snapshotIds = [...this._snapshotIdToState.keys()].filter((x) => x >= snapshotId);
        for (const id of snapshotIds) {
            this._snapshotIdToState.delete(id);
        }
    }
    _removeTx(map, address, deserializedTX) {
        const accountTxs = map.get(address);
        if (accountTxs === undefined) {
            throw new Error("Trying to remove a transaction from list that doesn't exist, this should never happen");
        }
        this._deleteTransactionByHash(deserializedTX.data.hash());
        const indexOfTx = accountTxs.indexOf(serializeTransaction(deserializedTX));
        return map.set(address, accountTxs.remove(indexOfTx));
    }
    _addPendingTransaction(tx) {
        const orderedTx = {
            orderId: this._nextOrderId++,
            data: tx,
        };
        const serializedTx = serializeTransaction(orderedTx);
        const hexSenderAddress = tx.getSenderAddress().toString();
        const accountTransactions = this._getPendingForAddress(hexSenderAddress) ?? (0, immutable_1.List)();
        const replaced = this._replacePendingTx(hexSenderAddress, orderedTx);
        if (!replaced) {
            const { newPending, newQueued } = (0, reorganizeTransactionsLists_1.reorganizeTransactionsLists)(accountTransactions.push(serializedTx), this._getQueuedForAddress(hexSenderAddress) ?? (0, immutable_1.List)(), (stx) => this._deserializeTransaction(stx).data.nonce);
            this._setPendingForAddress(hexSenderAddress, newPending);
            this._setQueuedForAddress(hexSenderAddress, newQueued);
        }
        this._setTransactionByHash((0, ethereumjs_util_1.bufferToHex)(tx.hash()), serializedTx);
    }
    _addQueuedTransaction(tx) {
        const orderedTx = {
            orderId: this._nextOrderId++,
            data: tx,
        };
        const serializedTx = serializeTransaction(orderedTx);
        const hexSenderAddress = tx.getSenderAddress().toString();
        const accountTransactions = this._getQueuedForAddress(hexSenderAddress) ?? (0, immutable_1.List)();
        const replaced = this._replaceQueuedTx(hexSenderAddress, orderedTx);
        if (!replaced) {
            this._setQueuedForAddress(hexSenderAddress, accountTransactions.push(serializedTx));
        }
        this._setTransactionByHash((0, ethereumjs_util_1.bufferToHex)(tx.hash()), serializedTx);
    }
    async _validateTransaction(tx, senderAddress, senderNonce) {
        if (this._knownTransaction(tx)) {
            throw new errors_1.InvalidInputError(`Known transaction: ${(0, ethereumjs_util_1.bufferToHex)(tx.hash())}`);
        }
        const txNonce = tx.nonce;
        // Geth returns this error if trying to create a contract and no data is provided
        if (tx.to === undefined && tx.data.length === 0) {
            throw new errors_1.InvalidInputError("contract creation without any data provided");
        }
        const senderAccount = await this._stateManager.getAccount(senderAddress);
        const senderBalance = senderAccount.balance;
        const maxFee = "gasPrice" in tx ? tx.gasPrice : tx.maxFeePerGas;
        const txMaxUpfrontCost = tx.gasLimit * maxFee + tx.value;
        if (txMaxUpfrontCost > senderBalance) {
            throw new errors_1.InvalidInputError(`sender doesn't have enough funds to send tx. The max upfront cost is: ${txMaxUpfrontCost.toString()}` +
                ` and the sender's account only has: ${senderBalance.toString()}`);
        }
        if (txNonce < senderNonce) {
            throw new errors_1.InvalidInputError(`Nonce too low. Expected nonce to be at least ${senderNonce.toString()} but got ${txNonce.toString()}.`);
        }
        const gasLimit = tx.gasLimit;
        const baseFee = tx.getBaseFee();
        if (gasLimit < baseFee) {
            throw new errors_1.InvalidInputError(`Transaction requires at least ${baseFee.toString()} gas but got ${gasLimit.toString()}`);
        }
        const blockGasLimit = this.getBlockGasLimit();
        if (gasLimit > blockGasLimit) {
            throw new errors_1.InvalidInputError(`Transaction gas limit is ${gasLimit.toString()} and exceeds block gas limit of ${blockGasLimit.toString()}`);
        }
    }
    _knownTransaction(tx) {
        const senderAddress = tx.getSenderAddress().toString();
        return (this._transactionExists(tx, this._getPendingForAddress(senderAddress)) ||
            this._transactionExists(tx, this._getQueuedForAddress(senderAddress)));
    }
    _transactionExists(tx, txList) {
        const existingTx = txList?.find((etx) => this._deserializeTransaction(etx).data.hash().equals(tx.hash()));
        return existingTx !== undefined;
    }
    _getTransactionsByHash() {
        return this._state.get("hashToTransaction");
    }
    _getPending() {
        return this._state.get("pendingTransactions");
    }
    _getQueued() {
        return this._state.get("queuedTransactions");
    }
    _getPendingForAddress(address) {
        return this._getPending().get(address);
    }
    _getQueuedForAddress(address) {
        return this._getQueued().get(address);
    }
    _setTransactionByHash(hash, transaction) {
        this._state = this._state.set("hashToTransaction", this._getTransactionsByHash().set(hash, transaction));
    }
    _setPending(transactions) {
        this._state = this._state.set("pendingTransactions", transactions);
    }
    _setQueued(transactions) {
        this._state = this._state.set("queuedTransactions", transactions);
    }
    _setPendingForAddress(address, transactions) {
        this._state = this._state.set("pendingTransactions", this._getPending().set(address, transactions));
    }
    _setQueuedForAddress(address, transactions) {
        this._state = this._state.set("queuedTransactions", this._getQueued().set(address, transactions));
    }
    _setBlockGasLimit(newLimit) {
        this._state = this._state.set("blockGasLimit", BigIntUtils.toHex(newLimit));
    }
    _deleteTransactionByHash(hash) {
        this._state = this._state.set("hashToTransaction", this._getTransactionsByHash().delete((0, ethereumjs_util_1.bufferToHex)(hash)));
    }
    _isTxValid(tx, txNonce, senderNonce, senderBalance) {
        const txGasLimit = tx.data.gasLimit;
        return (txGasLimit <= this.getBlockGasLimit() &&
            txNonce >= senderNonce &&
            tx.data.getUpfrontCost() <= senderBalance);
    }
    /**
     * Returns the next available nonce for an address, ignoring its
     * pending transactions.
     */
    async _getNextConfirmedNonce(accountAddress) {
        const account = await this._stateManager.getAccount(accountAddress);
        return account.nonce;
    }
    /**
     * Checks if some pending tx with the same nonce as `newTx` exists.
     * If it exists, it replaces it with `newTx` and returns true.
     * Otherwise returns false.
     */
    _replacePendingTx(accountAddress, newTx) {
        const pendingTxs = this._getPendingForAddress(accountAddress);
        const newPendingTxs = this._replaceTx(pendingTxs, newTx);
        if (newPendingTxs !== undefined) {
            this._setPendingForAddress(accountAddress, newPendingTxs);
            return true;
        }
        return false;
    }
    /**
     * Checks if some queued tx with the same nonce as `newTx` exists.
     * If it exists, it replaces it with `newTx` and returns true.
     * Otherwise returns false.
     */
    _replaceQueuedTx(accountAddress, newTx) {
        const queuedTxs = this._getQueuedForAddress(accountAddress);
        const newQueuedTxs = this._replaceTx(queuedTxs, newTx);
        if (newQueuedTxs !== undefined) {
            this._setQueuedForAddress(accountAddress, newQueuedTxs);
            return true;
        }
        return false;
    }
    _replaceTx(txs, newTx) {
        if (txs === undefined) {
            return;
        }
        const existingTxEntry = txs.findEntry((tx) => this._deserializeTransaction(tx).data.nonce === newTx.data.nonce);
        if (existingTxEntry === undefined) {
            return;
        }
        const [existingTxIndex, existingTx] = existingTxEntry;
        const deserializedExistingTx = this._deserializeTransaction(existingTx);
        const currentMaxFeePerGas = "gasPrice" in deserializedExistingTx.data
            ? deserializedExistingTx.data.gasPrice
            : deserializedExistingTx.data.maxFeePerGas;
        const currentPriorityFeePerGas = "gasPrice" in deserializedExistingTx.data
            ? deserializedExistingTx.data.gasPrice
            : deserializedExistingTx.data.maxPriorityFeePerGas;
        const newMaxFeePerGas = "gasPrice" in newTx.data ? newTx.data.gasPrice : newTx.data.maxFeePerGas;
        const newPriorityFeePerGas = "gasPrice" in newTx.data
            ? newTx.data.gasPrice
            : newTx.data.maxPriorityFeePerGas;
        const minNewMaxFeePerGas = this._getMinNewFeePrice(currentMaxFeePerGas);
        const minNewPriorityFeePerGas = this._getMinNewFeePrice(currentPriorityFeePerGas);
        if (newMaxFeePerGas < minNewMaxFeePerGas) {
            throw new errors_1.InvalidInputError(`Replacement transaction underpriced. A gasPrice/maxFeePerGas of at least ${minNewMaxFeePerGas.toString()} is necessary to replace the existing transaction with nonce ${newTx.data.nonce.toString()}.`);
        }
        if (newPriorityFeePerGas < minNewPriorityFeePerGas) {
            throw new errors_1.InvalidInputError(`Replacement transaction underpriced. A gasPrice/maxPriorityFeePerGas of at least ${minNewPriorityFeePerGas.toString()} is necessary to replace the existing transaction with nonce ${newTx.data.nonce.toString()}.`);
        }
        const newTxs = txs.set(existingTxIndex, serializeTransaction(newTx));
        this._deleteTransactionByHash(deserializedExistingTx.data.hash());
        return newTxs;
    }
    _getMinNewFeePrice(feePrice) {
        let minNewPriorityFee = feePrice * 110n;
        if (minNewPriorityFee % 100n === 0n) {
            minNewPriorityFee = minNewPriorityFee / 100n;
        }
        else {
            minNewPriorityFee = minNewPriorityFee / 100n + 1n;
        }
        return minNewPriorityFee;
    }
}
exports.TxPool = TxPool;
//# sourceMappingURL=TxPool.js.map