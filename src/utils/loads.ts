
import { Bytes, BigInt, BigDecimal, Address} from "@graphprotocol/graph-ts"
import { ERC20 } from '../../generated/Factory/ERC20'
import { ERC20SymbolBytes } from "../../generated/Factory/ERC20SymbolBytes";
import {
    Bundle,
  Exchange,
  ExchangePair,
  Pair,
  Token
} from "../../generated/schema"
import { ADDRESS_ZERO, fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from "./helpers";

class LoadBundleRet {
    entity: Bundle;
    exists: boolean;
}
export function safeLoadBundle(id: string): LoadBundleRet {
    let exists = true;

    let bundleEntity = Bundle.load(id);

    if (!bundleEntity) {
        bundleEntity = new Bundle(id);

        bundleEntity.value = BigDecimal.fromString("0.0");
        
        exists = false;
    }

    return {
        entity: bundleEntity,
        exists: exists
    }
}

class LoadExchangeRet {
    entity: Exchange;
    exists: boolean;
  };

export function safeLoadExchange(id: string): LoadExchangeRet {
    let exists = true;

    let exchangeEntity = Exchange.load(id);

    if (!exchangeEntity) {
        exchangeEntity = new Exchange(id);

        exchangeEntity.totalLiquidityETH = BigDecimal.fromString("0.0");
        exchangeEntity.totalLiquidityUSD = BigDecimal.fromString("0.0");
        exchangeEntity.totalVolumeETH = BigDecimal.fromString("0.0");
        exchangeEntity.totalLiquidityUSD = BigDecimal.fromString("0.0");
        exchangeEntity.pairCount = 0;
        exchangeEntity.pairs = new Array<string>();

        exists = false;
    }

    return {
        entity: exchangeEntity,
        exists: exists
    }
}

class LoadExchangePairRet {
    entity: ExchangePair;
    exists: boolean;
  };

export function safeLoadExchangePair(id: string): LoadExchangePairRet {
    let exists = true;

    let exchangePairEntity = ExchangePair.load(id);

    if (!exchangePairEntity) {
        exchangePairEntity = new ExchangePair(id);

        exchangePairEntity.exchange = ADDRESS_ZERO;

        exchangePairEntity.token0 = ADDRESS_ZERO;
        exchangePairEntity.token1 = ADDRESS_ZERO;
        exchangePairEntity.token0Price = BigDecimal.fromString("0.0");
        exchangePairEntity.token1Price = BigDecimal.fromString("0.0");
        exchangePairEntity.token0Volume = BigDecimal.fromString("0.0");
        exchangePairEntity.token1Volume = BigDecimal.fromString("0.0");

        exchangePairEntity.reserve0 = BigDecimal.fromString("0.0");
        exchangePairEntity.reserve1 = BigDecimal.fromString("0.0");
        exchangePairEntity.reserveETH = BigDecimal.fromString("0.0");
        exchangePairEntity.reserveUSD = BigDecimal.fromString("0.0");

        exchangePairEntity.volumeUSD = BigDecimal.fromString("0.0");
        exchangePairEntity.txCount = BigInt.fromI32(0);

        exchangePairEntity.createdAtTimestamp = BigInt.fromI32(0);
        exchangePairEntity.createdAtBlockNumber = BigInt.fromI32(0);

        exists = false;
    }

    return {
        entity: exchangePairEntity,
        exists: exists
    }
}

class LoadTokenRet {
    entity: Token;
    exists: boolean;
  };

export function safeLoadToken(id: string): LoadTokenRet {
    let exists = true;

    let tokenEntity = Token.load(id);

    if (!tokenEntity) {
        tokenEntity = new Token(id);

        let tokenAddress = Address.fromString(id)
        tokenEntity.symbol = fetchTokenSymbol(tokenAddress)
        tokenEntity.name = fetchTokenName(tokenAddress)
        tokenEntity.decimals = fetchTokenDecimals(tokenAddress)

        tokenEntity.ethPrice = BigDecimal.fromString("0.0");
        tokenEntity.pairs = new Array<string>();

        tokenEntity.tradeVolume = BigDecimal.fromString("0.0");
        tokenEntity.txCount = BigInt.fromI32(0);

        tokenEntity.totalLiquidity = BigDecimal.fromString("0.0");

        exists = false;
    }

    return {
        entity: tokenEntity,
        exists: exists
    }
}

