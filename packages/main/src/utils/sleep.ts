export const sleep = async (seconds: number) =>
  new Promise<void>(resolve =>
    setTimeout(() => {
      resolve();
    }, seconds * 1000),
  );
