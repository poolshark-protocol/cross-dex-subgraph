/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import { findEthPerToken, getEthPriceInUSD, getTrackedLiquidityUSD, getTrackedVolumeUSD } from '../utils/pricing'
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
} from '../../generated/templates/Pair/Pair'
import {
  convertTokenToDecimal,
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  BIGINT_ONE,
  BIGDECIMAL_ZERO,
  BIGINT_18,
} from '../utils/helpers'
import { safeLoadBundle, safeLoadExchange, safeLoadExchangePair, safeLoadToken } from '../utils/loads'

// function isCompleteMint(mintId: string): boolean {
//   return MintEvent.load(mintId).sender !== null // sufficient checks
// }

export function handleSync(event: Sync): void {
  //load pair data
  let loadPair = safeLoadExchangePair(event.address.toHex())
  let loadExchange = safeLoadExchange(loadPair.entity.exchange)
  let loadToken0 = safeLoadToken(loadPair.entity.token0)
  let loadToken1 = safeLoadToken(loadPair.entity.token1)

  if(!loadPair.exists || !loadExchange.exists || !loadToken0
    .exists || !loadToken1.exists){
    //throw some error/warning
  }

  let pair = loadPair.entity
  let exchange = loadExchange.entity
  let token0 = loadToken0.entity
  let token1 = loadToken1.entity
  
  // reset token total liquidity amounts
  let totalLiquidityETH = exchange.totalLiquidityETH.minus(pair.trackedReserveETH as BigDecimal)
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1)

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals)
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals)
  pair.updatedAtTimestamp = event.block.timestamp
  pair.updatedAtBlockNumber = event.block.number

  if (pair.reserve1.notEqual(BIGDECIMAL_ZERO)) pair.token0Price = pair.reserve0.div(pair.reserve1)
  else pair.token0Price = BIGDECIMAL_ZERO
  if (pair.reserve0.notEqual(BIGDECIMAL_ZERO)) pair.token1Price = pair.reserve1.div(pair.reserve0)
  else pair.token1Price = BIGDECIMAL_ZERO

  pair.save()

  let loadBundle = safeLoadBundle('ethUsdPrice')
  if(!loadBundle.exists){
    //throw some error
  }
  let ethUsdPrice = loadBundle.entity
  // @dev reserves must be updated for token0/token1..otherwise DIVIDE BY 0 error
  ethUsdPrice.value = getEthPriceInUSD()
  ethUsdPrice.save()

  token0.ethPrice = findEthPerToken(token0 as Token)
  token1.ethPrice = findEthPerToken(token1 as Token)
  token0.save()
  token1.save()

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityETH: BigDecimal
  if (ethUsdPrice.value.notEqual(BIGDECIMAL_ZERO)) {
    trackedLiquidityETH = getTrackedLiquidityUSD(pair.reserve0, token0 as Token, pair.reserve1, token1 as Token).div(
      ethUsdPrice.value
    )
  } else {
    trackedLiquidityETH = BIGDECIMAL_ZERO
  }

  // add new liquidity values
  totalLiquidityETH = totalLiquidityETH.plus(trackedLiquidityETH)
  exchange.totalLiquidityETH = totalLiquidityETH
  exchange.totalLiquidityUSD = exchange.totalLiquidityETH.times(ethUsdPrice.value)

  pair.trackedReserveETH = trackedLiquidityETH
  pair.reserveETH = pair.reserve0
    .times(token0.ethPrice as BigDecimal)
    .plus(pair.reserve1.times(token1.ethPrice as BigDecimal))
  pair.reserveUSD = pair.reserveETH.times(ethUsdPrice.value)

  // now correctly set liquidity amounts for each token
  token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0)
  token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1)

  // save entities
  pair.save()
  exchange.save()
  token0.save()
  token1.save()
}
