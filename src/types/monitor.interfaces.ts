export interface DiscordAlertFunction {
  (
    token0: string,
    token1: string,
    pairAddress: string,
    transactionHash: string
  ): void;
}

export interface EventListenerFunction {
  (): Promise<void>;
}

export interface ListenerFunction {
  (): void;
}
