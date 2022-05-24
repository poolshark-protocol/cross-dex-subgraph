/* eslint-disable prefer-const */
import { log } from '@graphprotocol/graph-ts'
import { PairCreated } from '../../generated/UniswapV2Factory/Factory'
import { Bundle, Pair, Token, Exchange } from '../../generated/schema'
import { UniswapV2Pair as UniswapV2PairTemplate } from '../../generated/templates'
import { safeLoadBundle, safeLoadExchange, safeLoadExchangePair, safeLoadExchangeToken, safeLoadPair, safeLoadToken } from '../utils/loads'
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
  let factoryAddress = event.address.toHex()

  // load entities; create if doesn't exist
  let loadExchange = safeLoadExchange(factoryAddress)
  let loadPair = safeLoadPair(token0Param, token1Param)
  let loadExPair = safeLoadExchangePair(pairParam)
  let loadToken0 = safeLoadToken(token0Param)
  let loadToken1 = safeLoadToken(token1Param)
  let loadExchangeToken0 = safeLoadExchangeToken(token0Param, factoryAddress)
  let loadExchangeToken1 = safeLoadExchangeToken(token1Param, factoryAddress)

  // set entities
  let exchange = loadExchange.entity
  let pair = loadPair.entity
  let exPair = loadExPair.entity
  let token0 = loadToken0.entity
  let token1 = loadToken1.entity
  let exToken0 = loadExchangeToken0.entity
  let exToken1 = loadExchangeToken1.entity

  // create ethUsdPrice data if doesn't exist
  if (!loadExchange.exists) {
    //TODO: fix for multi dex
    // create new bundle
    let loadBundle = safeLoadBundle('ethUsdPrice')
    if(!loadBundle.exists){
      let ethUsdPrice = loadBundle.entity
      ethUsdPrice.value = BIGDECIMAL_ZERO
      ethUsdPrice.save()
    }
  }
  
  // add exchange tokens to tokens list if not exist
  let token0Exchanges = token0.exchangeTokens;
  if(!token0Exchanges.includes(exToken0.id)){
    token0Exchanges.push(exToken0.id);
    token0.exchangeTokens = token0Exchanges;
  }

  let token1Exchanges = token1.exchangeTokens;
  if(!token1Exchanges.includes(exToken1.id)){
    token1Exchanges.push(exToken1.id);
    token1.exchangeTokens = token1Exchanges;
  }

  exchange.pairCount = exchange.pairCount + 1
  exchange.save()

  exPair.token0 = token0.id
  exPair.token1 = token1.id
  exPair.exchange = event.address.toHex()
  exPair.createdAtTimestamp = event.block.timestamp
  exPair.createdAtBlockNumber = event.block.number
  exPair.updatedAtTimestamp = event.block.timestamp
  exPair.updatedAtBlockNumber = event.block.number

  pair.token0 = token0.id
  pair.token1 = token1.id

  // first time this pair exists so we push every time
  let pairExchanges = pair.exchangePairs
  pairExchanges.push(exPair.id)
  pair.exchangePairs = pairExchanges

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
  exToken0.save()
  exToken1.save()
  exPair.save()
  exchange.save()
}
