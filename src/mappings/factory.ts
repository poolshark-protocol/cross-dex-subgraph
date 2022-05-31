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
  // token0 and token1 must be lexographically sorted already
  // true for Uniswap v2/v3 and Sushiswap
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

  // Exchange updates
  exchange.pairCount = exchange.pairCount + 1

  // Bundle create
  if (!loadExchange.exists) {
    //TODO: fix for multi dex
    // create new bundle for each
    let loadBundle = safeLoadBundle('ethUsdPrice',factoryAddress)
    if(!loadBundle.exists){
      let ethUsdPrice = loadBundle.entity
      ethUsdPrice.value = BIGDECIMAL_ZERO
      ethUsdPrice.save()
    }
  }
  
  // Token updates

  // pairs
  let token0Pairs = token0.pairs;
  token0Pairs.push(pair.id)
  token0.pairs = token0Pairs
  let token1Pairs = token1.pairs;
  token1Pairs.push(pair.id)
  token1.pairs = token1Pairs
  // exchanges
  let token0Exchanges = token0.exchanges;
  if(!token0Exchanges.includes(exToken0.exchange)){
    token0Exchanges.push(exchange.id);
    token0.exchanges = token0Exchanges;
  }
  let token1Exchanges = token1.exchanges;
  if(!token1Exchanges.includes(exToken1.exchange)){
    token1Exchanges.push(exToken1.exchange);
    token1.exchanges = token1Exchanges;
  }

  // ExchangeToken updates
  exToken0.exchange = exchange.id
  exToken1.exchange = exchange.id
  exToken0.token = token0.id
  exToken1.token = token1.id
  // exchangePairs
  let exToken0Pairs = exToken0.exchangePairs;
  exToken0Pairs.push(exPair.id);
  exToken0.exchangePairs = exToken0Pairs;
  let exToken1Pairs = exToken1.exchangePairs;
  exToken1Pairs.push(exPair.id);
  exToken1.exchangePairs = exToken1Pairs;

  // Pair updates
  pair.token0 = token0.id
  pair.token1 = token1.id
  // exchhanges
  let pairExchanges = pair.exchanges
  pairExchanges.push(exchange.id)
  pair.exchanges = pairExchanges
  // exchangePairs
  let pairExchangePairs = pair.exchangePairs
  pairExchangePairs.push(exPair.id)
  pair.exchangePairs = pairExchangePairs
  // timestamps
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.updatedAtTimestamp = event.block.timestamp
  pair.updatedAtBlockNumber = event.block.number

  // ExchangePair updates
  exPair.exchange = event.address.toHex()
  exPair.token0 = token0.id
  exPair.token1 = token1.id
  exPair.createdAtTimestamp = event.block.timestamp
  exPair.createdAtBlockNumber = event.block.number
  exPair.updatedAtTimestamp = event.block.timestamp
  exPair.updatedAtBlockNumber = event.block.number

  // launch template to track Sync events
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
