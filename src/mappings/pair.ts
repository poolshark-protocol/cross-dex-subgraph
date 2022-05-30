/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import { findEthPerExchangeToken, findEthPerToken, findUsdPerExchangeToken, getEthPriceInUSD, getExchangeTrackedLiquidityUSD, getExchangeTrackedVolumeUSD } from '../utils/pricing'
import {
  Pair,
  Token,
  Exchange,
  Transaction,
  Bundle,
  ExchangePair,
  Swap as SwapEvent,
  ExchangeToken
} from '../../generated/schema'
import { 
  Pair as PairContract, 
  Mint, 
  Burn, 
  Swap, 
  Transfer, 
  Sync 
} from '../../generated/templates/UniswapV2Pair/Pair'
import {
  convertTokenToDecimal,
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  BIGINT_ONE,
  BIGDECIMAL_ZERO,
  BIGINT_18,
  BIGDECIMAL_ONE_PERCENT,
} from '../utils/helpers'
import { safeLoadBundle, safeLoadExchange, safeLoadExchangePair, safeLoadExchangeToken, safeLoadPair, safeLoadToken } from '../utils/loads'


export function handleSync(event: Sync): void {
  //TODO: somehow get all the pairs that have been updated in the last x days
  //      and watch these contracts in the subgraph.yaml
  //NOTE: scraping through all the blocks to get every pair created is a bad idea
  
  let loadExchangePair = safeLoadExchangePair(event.address.toHex())
  let loadPair = safeLoadPair(loadExchangePair.entity.token0, loadExchangePair.entity.token1)
  let loadExchange = safeLoadExchange(loadExchangePair.entity.exchange)
  let loadToken0 = safeLoadToken(loadExchangePair.entity.token0)
  let loadToken1 = safeLoadToken(loadExchangePair.entity.token1)
  let loadExchangeToken0 = safeLoadExchangeToken(loadExchangePair.entity.token0, loadExchange.entity.id)
  let loadExchangeToken1 = safeLoadExchangeToken(loadExchangePair.entity.token1, loadExchange.entity.id)
  //TODO: update Token entity for cross-exchange pricing

  if(!loadExchangePair.exists || !loadExchange.exists || !loadExchangeToken0
    .exists || !loadExchangeToken1.exists){
    //throw some error/warning
  }

  let exchange = loadExchange.entity
  let pair = loadPair.entity
  let token0 = loadToken0.entity
  let token1 = loadToken1.entity
  let exPair = loadExchangePair.entity
  let exToken0 = loadExchangeToken0.entity
  let exToken1 = loadExchangeToken1.entity

  // Bundle update
  let ethUsdPrice = updateEthUsdPrice(exchange.id)
  
  // reset token total liquidity amounts
  // Exchange
  exchange.totalLiquidityETH = exchange.totalLiquidityETH.minus(exPair.trackedReserveETH as BigDecimal)
  exchange.totalLiquidityUSD = exchange.totalLiquidityUSD.minus(exPair.trackedReserveETH.times(ethUsdPrice))
  // Token
  token0.totalLiquidity = token0.totalLiquidity.minus(exPair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.minus(exPair.reserve1)
  // ExchangeToken
  exToken0.totalLiquidity = exToken0.totalLiquidity.minus(exPair.reserve0)
  exToken1.totalLiquidity = exToken1.totalLiquidity.minus(exPair.reserve1)
  // Pair
  pair.reserve0 = pair.reserve0.minus(exPair.reserve0)
  pair.reserve1 = pair.reserve1.minus(exPair.reserve1)
  pair.reserveETH = pair.reserveETH.minus(exPair.reserveETH)
  pair.reserveUSD = pair.reserveUSD.minus(exPair.reserveUSD)
  // TODO: calculate without this liquidity and add it back in
  // Token
  // - ethPrice
  // - usdPrice
  // Pair
  // - token0Price
  // - token1Price

  exPair.reserve0 = convertTokenToDecimal(event.params.reserve0, exToken0.decimals)
  exPair.reserve1 = convertTokenToDecimal(event.params.reserve1, exToken1.decimals)
  exPair.updatedAtTimestamp = event.block.timestamp
  exPair.updatedAtBlockNumber = event.block.number

  if (exPair.reserve1.notEqual(BIGDECIMAL_ZERO)) exPair.token0Price = exPair.reserve0.div(exPair.reserve1)
  else exPair.token0Price = BIGDECIMAL_ZERO
  if (exPair.reserve0.notEqual(BIGDECIMAL_ZERO)) exPair.token1Price = exPair.reserve1.div(exPair.reserve0)
  else exPair.token1Price = BIGDECIMAL_ZERO

  //update weighted average price for cross-exchange token entity
  exPair.save()

  exToken0 = updateExchangeTokenPrices(exToken0, ethUsdPrice)
  exToken1 = updateExchangeTokenPrices(exToken1, ethUsdPrice)

  exToken0.save()
  exToken1.save()

  token0.ethPrice = findEthPerToken(token0)
  token1.ethPrice = findEthPerToken(token1)

  exPair = updateTwoPercentMarketDepth(exPair, exToken1, ethUsdPrice)

  let exchangePairTrackedLiquidityETH = getExchangePairTrackedLiquidityETH(ethUsdPrice, exPair, exToken0, exToken1)

  // add new liquidity values
  
  // Exchange
  exchange.totalLiquidityETH = exchange.totalLiquidityETH.plus(exchangePairTrackedLiquidityETH)
  exchange.totalLiquidityUSD = exchange.totalLiquidityETH.times(ethUsdPrice)
  // ExchangeToken
  exToken0.totalLiquidity = exToken0.totalLiquidity.plus(exPair.reserve0)
  exToken1.totalLiquidity = exToken1.totalLiquidity.plus(exPair.reserve1)
  // Token using exPair.reserve0/1
  // - ethPrice
  // - usdPrice
  // ExchangePair
  exPair.trackedReserveETH = exchangePairTrackedLiquidityETH
  exPair.reserveETH = exPair.reserve0
    .times(exToken0.ethPrice as BigDecimal)
    .plus(exPair.reserve1.times(exToken1.ethPrice as BigDecimal))
  exPair.reserveUSD = exPair.reserveETH.times(ethUsdPrice)
  // Pair using exPair.reserveETH/USD
  // - token0Price
  // - token1Price

  // save entities
  exchange.save()
  exPair.save()
  pair.save()
  exToken0.save()
  exToken1.save()
  token0.save()
  token1.save()
}

export function updateEthUsdPrice(factoryAddress: string): BigDecimal {
  let loadBundle = safeLoadBundle('ethUsdPrice', factoryAddress)
  if(!loadBundle.exists){
    //throw some error
  }
  let ethUsdPrice = loadBundle.entity
  // @dev reserves must be updated for token0/token1..otherwise DIVIDE BY 0 error
  ethUsdPrice.value = getEthPriceInUSD()
  ethUsdPrice.save()

  return ethUsdPrice.value
}

export function updateExchangeTokenPrices(exToken: ExchangeToken, ethUsdPrice: BigDecimal): ExchangeToken {
  exToken.ethPrice = findEthPerExchangeToken(exToken)
  ///get exchange tokens and update prices
  exToken.usdPrice = findUsdPerExchangeToken(exToken, ethUsdPrice)

  return exToken
}

export function updateTwoPercentMarketDepth(exPair: ExchangePair, exToken1: ExchangeToken, ethUsdPrice: BigDecimal): ExchangePair {
  exPair.twoPercentMarketDepthETH = exPair.reserve1.times(BIGDECIMAL_ONE_PERCENT).times(exToken1.ethPrice)
  exPair.twoPercentMarketDepthUSD = exPair.twoPercentMarketDepthETH.times(ethUsdPrice)
  return exPair
}

export function getExchangePairTrackedLiquidityETH(ethUsdPrice: BigDecimal, exPair: ExchangePair, exToken0: ExchangeToken, exToken1: ExchangeToken): BigDecimal {
    // get tracked liquidity - will be 0 if neither is in whitelist
    let trackedLiquidityETH: BigDecimal
    if (ethUsdPrice.notEqual(BIGDECIMAL_ZERO)) {
      trackedLiquidityETH = getExchangeTrackedLiquidityUSD(exPair.reserve0, exToken0, exPair.reserve1, exToken1).div(
        ethUsdPrice
      )
    } else {
      trackedLiquidityETH = BIGDECIMAL_ZERO
    }
    return trackedLiquidityETH
}
