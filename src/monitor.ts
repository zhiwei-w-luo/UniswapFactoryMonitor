import { Logger } from "tslog";
import axios, { AxiosResponse } from "axios";
import { BigNumber, ethers, Event, Contract } from "ethers";
import { WebSocketProvider } from "@ethersproject/providers";
import uniswapABI from "./contracts/uniswapABI.json";
import erc20ABI from "./contracts/ERC20ABI.json";
import {
  EventListenerFunction,
  DiscordAlertFunction,
} from "./types/monitor.interfaces";
import { tryAndCatch } from "./helpers";

export default class UniswapV2FactoryMonitor {
  log: Logger;

  provider: WebSocketProvider;

  factory: Contract;

  disordURL: string;

  constructor(
    providerEndpoint: string,
    contractAddress: string,
    discordURL: string
  ) {
    this.log = new Logger();
    this.provider = new ethers.providers.WebSocketProvider(providerEndpoint);
    this.factory = new Contract(contractAddress, uniswapABI);
    this.disordURL = discordURL;
  }

  sendDiscordNotification: DiscordAlertFunction = async (
    token0: string,
    token1: string,
    pairAddress: string,
    transactionHash: string
  ): Promise<void> => {
    const token0Contract: Contract = new Contract(
      token0,
      erc20ABI,
      this.provider
    );
    const token1Contract: Contract = new Contract(
      token1,
      erc20ABI,
      this.provider
    );
    const [error1, tokenSymbols] = await tryAndCatch(
      token0Contract.symbol,
      token1Contract.symbol
    );
    if (error1) this.log.error("Error fetching token symbols");
    const [error2, tokenNames] = await tryAndCatch(
      token0Contract.name,
      token1Contract.name
    );
    if (error2) this.log.error("Error fetching token names");
    const embed = {
      title: `:scales: New Pair created: ${tokenSymbols[0]}/${tokenSymbols[1]}`,
      description: `New pair created between ${tokenNames[0]} and ${tokenNames[1]}
                          [View Transaction](https://ftmscan.com/tx/${transactionHash})
                    `,
      url: `https://ftmscan.com/address/${pairAddress}#writeContract`,
      color: 15418782,
    };
    try {
      const response: AxiosResponse = await axios.post(this.disordURL, {
        embeds: [embed],
      });
    } catch (error) {
      this.log.error(error);
    }
  };

  run: EventListenerFunction = async (): Promise<void> => {
    const filter: ethers.EventFilter = this.factory.filters.PairCreated();
    this.factory.on(
      filter,
      (
        token0: string,
        token1: string,
        contractAddress: string,
        id: BigNumber,
        event: Event
      ) => {
        this.log.info(`New pair created at ${Date.now()}`);
        this.sendDiscordNotification(
          token0,
          token1,
          contractAddress,
          event.transactionHash
        );
      }
    );
  };
}