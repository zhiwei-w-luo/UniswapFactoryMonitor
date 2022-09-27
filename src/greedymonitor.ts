import ethers from "ethers";
import { Logger } from "tslog";
import erc20ABI from "./contracts/ERC20ABI.json";
import { tryAndCatch } from "./helpers";
import axios, { AxiosResponse } from "axios";

export class GreedyV2FactoryMonitor {
  log: Logger;

  provider: ethers.providers.WebSocketProvider;

  factoryAddress: string;

  discordURL: string;

  static CREATEPAIR_SELECTOR = "0xc9c65396";

  constructor(nodeURL: string, discordURL: string, address: string) {
    this.log = new Logger();
    this.discordURL = discordURL;
    this.factoryAddress = address;
    this.provider = new ethers.providers.WebSocketProvider(nodeURL);
  }
  //TODO:destructure in more digestable functions and find a better way to do the if checks
  run = (): void => {
    this.provider.on("pending", async (tx) => {
      try {
        const transaction = await this.provider.getTransaction(tx);
        if (transaction !== null && transaction.data) {
          if (transaction.to === this.factoryAddress) {
            if (
              transaction.data.substring(0, 10) ===
              GreedyV2FactoryMonitor.CREATEPAIR_SELECTOR
            ) {
              //TODO: Confirm the string manipulation checks out
              const token0Address: string = `0x${transaction.data.substring(
                34,
                75
              )}`;
              const token1Address: string = `0x${transaction.data.substring(
                98,
                139
              )}`;
              const token0: ethers.Contract = new ethers.Contract(
                token0Address,
                erc20ABI,
                this.provider
              );
              const token1: ethers.Contract = new ethers.Contract(
                token1Address,
                erc20ABI,
                this.provider
              );
              const [error1, tokenSymbols] = await tryAndCatch(
                token0.symbol,
                token1.symbol
              );
              if (error1) this.log.error("Error fetching token symbols");
              const [error2, tokenNames] = await tryAndCatch(
                token0.name,
                token1.name
              );
              if (error2) this.log.error("Error fetching token names");
              const embed = {
                title: `:scales: New Pair being created: ${tokenSymbols[0]}/${tokenSymbols[1]}`,
                description: `New pair created between ${tokenNames[0]} and ${tokenNames[1]}
                              transaction hash: ${transaction.hash}
                              `,

                color: 15418782,
              };
              try {
                const response: AxiosResponse = await axios.post(
                  this.discordURL,
                  {
                    embeds: [embed],
                  }
                );
              } catch (error) {
                this.log.error(error);
              }

              this.provider._websocket.on("error", async () => {
                this.log.error(
                  "Unable to connect to provided websocket endpoint...attemping to reconnect"
                );
                setTimeout(this.run, 3000);
              });

              this.provider._websocket.on("close", async (code: any) => {
                this.log.warn(
                  `Connection lost with code ${code} Attempting to reconnect...`
                );
                this.provider._websocket.terminate();
                setTimeout(this.run, 3000);
              });
            }
          }
        }
      } catch (error) {}
    });
  };
}
