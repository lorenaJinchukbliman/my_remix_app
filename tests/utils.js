// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-console */

/**
 * @description Wait until the Root loader is refreshed after a Form action
 * @param page Page
 * @param action Fn
 */
export async function waitForLoaders(page, action) {
  return waitForNetworkSettled(
    page,
    action,
    (request) => /\?_data=root/.test(request.url()),
    1
  );
}

// Based on https://gist.github.com/dgozman/d1c46f966eb9854ee1fe24960b603b28
const DEBUG = false;
export async function waitForNetworkSettled(
  page,
  action,
  requestFilter,
  minimumRequests = 0
) {
  const skipRequest = (request) => !!requestFilter && !requestFilter(request);

  let networkSettledCallback;
  const networkSettledPromise = new Promise(
    (f) => (networkSettledCallback = f)
  );

  let requestCounter = 0;
  let actionDone = false;
  const pending = new Set();

  const maybeSettle = () => {
    if (actionDone && requestCounter <= 0 && minimumRequests <= 0)
      networkSettledCallback();
  };

  const onRequest = (request) => {
    if (skipRequest(request)) return;

    ++requestCounter;
    DEBUG && pending.add(request);
    DEBUG &&
      console.log(`+[${requestCounter}]: ${request.method()} ${request.url()}`);
  };
  const onRequestDone = (request) => {
    if (skipRequest(request)) return;

    // Let the page handle responses asynchronously (via setTimeout(0)).
    //
    // Note: this might be changed to use delay, e.g. setTimeout(f, 100),
    // when the page uses delay itself.
    const evaluate = page.evaluate(() => new Promise((f) => setTimeout(f, 0)));
    evaluate
      .catch((e) => null)
      .then(() => {
        --requestCounter;
        --minimumRequests;
        maybeSettle();
        DEBUG && pending.delete(request);
        DEBUG &&
          console.log(
            `-[${requestCounter}]: ${request.method()} ${request.url()}`
          );
      });
  };

  page.on("request", onRequest);
  page.on("requestfinished", onRequestDone);
  page.on("requestfailed", onRequestDone);

  let timeoutId;
  DEBUG &&
    (timeoutId = setInterval(() => {
      console.log(`${requestCounter} requests pending:`);
      for (const request of pending) console.log(`  ${request.url()}`);
    }, 5000));

  const result = await action();
  actionDone = true;
  maybeSettle();
  DEBUG && console.log(`action done, ${requestCounter} requests pending`);
  await networkSettledPromise;
  DEBUG && console.log(`action done, network settled`);

  page.removeListener("request", onRequest);
  page.removeListener("requestfinished", onRequestDone);
  page.removeListener("requestfailed", onRequestDone);

  DEBUG && clearTimeout(timeoutId);

  return result;
}
