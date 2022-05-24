/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import { findEthPerExchangeToken, findEthPerToken, getEthPriceInUSD, getTrackedLiquidityUSD, getTrackedVolumeUSD } from '../utils/pricing'
import {
  Pair,
  Token,
  Exchange,
  Transaction,
  Bundle,
  ExchangePair,
  Swap as SwapEvent
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
  
  // reset token total liquidity amounts
  exchange.totalLiquidityETH = exchange.totalLiquidityETH.minus(exPair.trackedReserveETH as BigDecimal)
  token0.totalLiquidity = token0.totalLiquidity.minus(exPair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.minus(exPair.reserve1)
  exToken0.totalLiquidity = exToken0.totalLiquidity.minus(exPair.reserve0)
  exToken1.totalLiquidity = exToken1.totalLiquidity.minus(exPair.reserve1)

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

  let ethUsdPrice = updateEthUsdPrice()

  updateEthBasedPrices(token0 as Token, token1 as Token, exPair as ExchangePair, exchange, ethUsdPrice)

}

export function updateEthUsdPrice(): BigDecimal {
  let loadBundle = safeLoadBundle('ethUsdPrice')
  if(!loadBundle.exists){
    //throw some error
  }
  let ethUsdPrice = loadBundle.entity
  // @dev reserves must be updated for token0/token1..otherwise DIVIDE BY 0 error
  ethUsdPrice.value = getEthPriceInUSD()
  ethUsdPrice.save()

  return ethUsdPrice.value
}

export function updateEthBasedPrices(token0: Token, token1: Token, pair: ExchangePair, exchange: Exchange, ethUsdPrice: BigDecimal): void {
  token0.ethPrice = findEthPerExchangeToken(token0 as Token)
  token1.ethPrice = findEthPerExchangeToken(token1 as Token)
  ///get exchange tokens and update prices
  token0.usdPrice = token0.ethPrice.times(ethUsdPrice)
  token1.usdPrice = token1.usdPrice.times(ethUsdPrice)
  //also update weighted average prices
  token0.save()
  token1.save()

  pair.twoPercentMarketDepthETH = pair.reserve1.times(BIGDECIMAL_ONE_PERCENT).times(token1.ethPrice)
  pair.twoPercentMarketDepthUSD = pair.twoPercentMarketDepthETH.times(ethUsdPrice)

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityETH: BigDecimal
  if (ethUsdPrice.notEqual(BIGDECIMAL_ZERO)) {
    trackedLiquidityETH = getTrackedLiquidityUSD(pair.reserve0, token0 as Token, pair.reserve1, token1 as Token).div(
      ethUsdPrice
    )
  } else {
    trackedLiquidityETH = BIGDECIMAL_ZERO
  }

  // add new liquidity values
  exchange.totalLiquidityETH = exchange.totalLiquidityETH.plus(trackedLiquidityETH)
  exchange.totalLiquidityUSD = exchange.totalLiquidityETH.times(ethUsdPrice)

  pair.trackedReserveETH = trackedLiquidityETH
  pair.reserveETH = pair.reserve0
    .times(token0.ethPrice as BigDecimal)
    .plus(pair.reserve1.times(token1.ethPrice as BigDecimal))
  pair.reserveUSD = pair.reserveETH.times(ethUsdPrice)

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1)

  // save entities
  pair.save()
  exchange.save()
  token0.save()
  token1.save()
}
