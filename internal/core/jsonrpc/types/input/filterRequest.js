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
exports.optionalRpcFilterRequest = exports.rpcFilterRequest = void 0;
const t = __importStar(require("io-ts"));
const io_ts_1 = require("../../../../util/io-ts");
const base_types_1 = require("../base-types");
const blockTag_1 = require("./blockTag");
const logAddress_1 = require("./logAddress");
const logTopics_1 = require("./logTopics");
exports.rpcFilterRequest = t.type({
    fromBlock: blockTag_1.optionalRpcOldBlockTag,
    toBlock: blockTag_1.optionalRpcOldBlockTag,
    address: logAddress_1.optionalRpcLogAddress,
    topics: logTopics_1.optionalRpcLogTopics,
    blockHash: (0, io_ts_1.optionalOrNullable)(base_types_1.rpcHash),
}, "RpcFilterRequest");
exports.optionalRpcFilterRequest = (0, io_ts_1.optionalOrNullable)(exports.rpcFilterRequest);
