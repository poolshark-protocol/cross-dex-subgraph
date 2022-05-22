/* eslint-disable prefer-const */
import { log } from '@graphprotocol/graph-ts'
import { PairCreated } from '../../generated/Factory/Factory'
import { Bundle, Pair, Token, Exchange } from '../../generated/schema'
import { UniswapV2Pair as UniswapV2PairTemplate } from '../../generated/templates'
import { safeLoadBundle, safeLoadExchange, safeLoadExchangePair, safeLoadToken } from '../utils/loads'
import { getEthPriceInUSD } from '../utils/pricing'
import {
  FACTORY_ADDRESS,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
  BIGDECIMAL_ZERO,
  BIGINT_ZERO,
} from './../utils/helpers'

export function handleNewUniswapV2Pair(event: PairCreated): void {
  // load event params
  let pairParam = event.params.pair.toHex()
  let token0Param = event.params.token0.toHex()
  let token1Param = event.params.token1.toHex()
  // load exchange (create if first exchange)
  let loadExchange = safeLoadExchange(event.address.toHex())
  let loadPair = safeLoadExchangePair(pairParam)
  let loadToken0 = safeLoadToken(token0Param)
  let loadToken1 = safeLoadToken(token1Param)

  let exchange = loadExchange.entity
  let pair = loadPair.entity
  let token0 = loadToken0.entity
  let token1 = loadToken1.entity

  if (!loadExchange.exists) {
    //TODO: fix for multi dex
    // create new bundle
    let loadBundle = safeLoadBundle('ethUsdPrice')
    let ethUsdPrice = loadBundle.entity
    ethUsdPrice.value = BIGDECIMAL_ZERO
    ethUsdPrice.save()
  }

  exchange.pairCount = exchange.pairCount + 1
  exchange.save()

  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.exchange = event.address.toHex()
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.updatedAtTimestamp = event.block.timestamp
  pair.updatedAtBlockNumber = event.block.number

  // create the tracked contract based on the template
  UniswapV2PairTemplate.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  exchange.save()
}
