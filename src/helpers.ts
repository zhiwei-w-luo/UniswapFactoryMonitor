export const tryAndCatch = async (...args: Function[]): Promise<any[]> => {
  try {
    const promises: Function[] = [];
    args.forEach((fn) => promises.push(fn()));
    return [null, await Promise.all(promises)];
  } catch (error) {
    return [error];
  }
};
