
import { Bytes, BigInt, BigDecimal, Address} from "@graphprotocol/graph-ts"
import { ERC20 } from '../../generated/UniswapV2Factory/ERC20'
import { ERC20SymbolBytes } from "../../generated/UniswapV2Factory/ERC20SymbolBytes";
import {
    Bundle,
  Exchange,
  ExchangePair,
  ExchangeToken,
  Pair,
  Token
} from "../../generated/schema"
import { ADDRESS_ZERO, BIGDECIMAL_ZERO, BIGINT_ZERO, fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from "./helpers";

class LoadBundleRet {
    entity: Bundle;
    exists: boolean;
}
export function safeLoadBundle(id: string): LoadBundleRet {
    let exists = true;

    let bundleEntity = Bundle.load(id);

    if (!bundleEntity) {
        bundleEntity = new Bundle(id);

        bundleEntity.value = BIGDECIMAL_ZERO;
        
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

        exchangeEntity.totalLiquidityETH = BIGDECIMAL_ZERO;
        exchangeEntity.totalLiquidityUSD = BIGDECIMAL_ZERO;
        //exchangeEntity.totalVolumeETH = BIGDECIMAL_ZERO;
        exchangeEntity.totalLiquidityUSD = BIGDECIMAL_ZERO;
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
        exchangePairEntity.token0Price = BIGDECIMAL_ZERO;
        exchangePairEntity.token1Price = BIGDECIMAL_ZERO;
        // exchangePairEntity.token0Volume = BIGDECIMAL_ZERO;
        // exchangePairEntity.token1Volume = BIGDECIMAL_ZERO;

        exchangePairEntity.reserve0 = BIGDECIMAL_ZERO;
        exchangePairEntity.reserve1 = BIGDECIMAL_ZERO;
        exchangePairEntity.reserveETH = BIGDECIMAL_ZERO;
        exchangePairEntity.reserveUSD = BIGDECIMAL_ZERO;
        exchangePairEntity.trackedReserveETH = BIGDECIMAL_ZERO;
        //exchangePairEntity.volumeUSD = BIGDECIMAL_ZERO;

        exchangePairEntity.createdAtTimestamp = BIGINT_ZERO;
        exchangePairEntity.createdAtBlockNumber = BIGINT_ZERO;

        exchangePairEntity.updatedAtTimestamp = BIGINT_ZERO;
        exchangePairEntity.updatedAtBlockNumber = BIGINT_ZERO;

        exists = false;
    }

    return {
        entity: exchangePairEntity,
        exists: exists
    }
}

class LoadPairRet {
    entity: Pair
    exists: boolean
}
export function safeLoadPair(token0: string, token1: string): LoadPairRet {
    let exists = true;

    let id = token0.concat(token1)

    let pairEntity = Pair.load(id);

    if (!pairEntity) {
        pairEntity = new Pair(id);

        pairEntity.exchangePairs = new Array<string>();

        //TODO: set these values based on the contract
        pairEntity.token0 = ADDRESS_ZERO;
        pairEntity.token1 = ADDRESS_ZERO;
        pairEntity.token0Price = BIGDECIMAL_ZERO;
        pairEntity.token1Price = BIGDECIMAL_ZERO;
        // pairEntity.token0Volume = BIGDECIMAL_ZERO;
        // pairEntity.token1Volume = BIGDECIMAL_ZERO;

        pairEntity.reserve0 = BIGDECIMAL_ZERO;
        pairEntity.reserve1 = BIGDECIMAL_ZERO;
        pairEntity.reserveETH = BIGDECIMAL_ZERO;
        pairEntity.reserveUSD = BIGDECIMAL_ZERO;
        //pairEntity.volumeUSD = BIGDECIMAL_ZERO;

        pairEntity.createdAtTimestamp = BIGINT_ZERO;
        pairEntity.createdAtBlockNumber = BIGINT_ZERO;

        pairEntity.updatedAtTimestamp = BIGINT_ZERO;
        pairEntity.updatedAtBlockNumber = BIGINT_ZERO;

        exists = false;
    }

    return {
        entity: pairEntity,
        exists: exists
    }
}

class LoadExchangeTokenRet {
    entity: ExchangeToken;
    exists: boolean;
}
export function safeLoadExchangeToken(tokenAddress: string, factory: string): LoadExchangeTokenRet {
    let exists = true;

    let id = tokenAddress.concat(factory)

    let exchangeTokenEntity = ExchangeToken.load(id);

    if (!exchangeTokenEntity) {
        exchangeTokenEntity = new ExchangeToken(id);

        let exchangeTokenAddress = Address.fromString(tokenAddress)

        let token = safeLoadToken(tokenAddress)

        if(!token.exists){
            //throw an error
        }
        //TODO: copy these values from the Token entity by loading it
        exchangeTokenEntity.symbol = token.entity.symbol
        exchangeTokenEntity.name = token.entity.name
        exchangeTokenEntity.decimals = token.entity.decimals

        if (exchangeTokenEntity.decimals.equals(BIGINT_ZERO)) {
            //TODO: throw an error
        }

        exchangeTokenEntity.ethPrice = BIGDECIMAL_ZERO;
        exchangeTokenEntity.exchangePairs = new Array<string>()

        //exchangeTokenEntity.tradeVolume = BIGDECIMAL_ZERO;

        exchangeTokenEntity.totalLiquidity = BIGDECIMAL_ZERO;

        exists = false;
    }

    return {
        entity: exchangeTokenEntity,
        exists: exists
    }
}

class LoadTokenRet {
    entity: Token;
    exists: boolean;
}
export function safeLoadToken(address: string): LoadTokenRet {
    let exists = true;

    let tokenEntity = Token.load(address);

    if (!tokenEntity) {
        tokenEntity = new Token(address);

        let tokenAddress = Address.fromString(address)
        tokenEntity.symbol = fetchTokenSymbol(tokenAddress)
        tokenEntity.name = fetchTokenName(tokenAddress)
        tokenEntity.decimals = fetchTokenDecimals(tokenAddress)

        if (tokenEntity.decimals.equals(BIGINT_ZERO)) {
            //TODO: throw an error
        }

        tokenEntity.ethPrice = BIGDECIMAL_ZERO;
        tokenEntity.pairs = new Array<string>();
        tokenEntity.exchangeTokens = new Array<string>();

        //tokenEntity.tradeVolume = BIGDECIMAL_ZERO;

        tokenEntity.totalLiquidity = BIGDECIMAL_ZERO;

        exists = false;
    }

    return {
        entity: tokenEntity,
        exists: exists
    }
}

