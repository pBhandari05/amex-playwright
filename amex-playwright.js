const { chromium } = require('playwright');

const CDP_URL = 'http://127.0.0.1:9222';

const SELECTORS = [
  'button[data-testid="enrollPlusButton"]',
  'button[data-testid="merchantOfferListAddButton"]'
];

const MAX_OFFERS = 1000;

const AFTER_CLICK_DELAY = 1800;
const RETRY_DELAY = 2500;
const SCROLL_DELAY = 1400;
const BUTTON_TIMEOUT = 7000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findAmexPage(browser) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      try {
        if (
          !page.isClosed() &&
          /americanexpress\.com/i.test(page.url())
        ) {
          return page;
        }
      } catch {}
    }
  }

  return null;
}

async function getAddButtons(page) {
  if (!page || page.isClosed()) {
    return [];
  }

  const all = [];

  for (const selector of SELECTORS) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();

      for (let i = 0; i < count; i++) {
        const button = locator.nth(i);

        try {
          if (!(await button.isVisible())) continue;
          if (await button.isDisabled()) continue;

          all.push(button);
        } catch {}
      }
    } catch (err) {
      if (
        !/Target page.*closed/i.test(err.message) &&
        !/context.*closed/i.test(err.message) &&
        !/browser.*closed/i.test(err.message)
      ) {
        throw err;
      }
    }
  }

  return all;
}

async function waitForButtonToChange(button) {
  const deadline = Date.now() + BUTTON_TIMEOUT;

  while (Date.now() < deadline) {
    try {
      if (await button.isHidden()) {
        return true;
      }

      if (await button.isDisabled()) {
        return true;
      }

      return false;
    } catch {
      // React removed/replaced the element.
      return true;
    }

    await sleep(200);
  }

  return false;
}

async function scrollForMore(page) {
  try {
    await page.bringToFront();

    // Don't use page.evaluate() because Amex disables eval.
    await page.mouse.wheel(0, 900);

    await sleep(SCROLL_DELAY);

    return true;
  } catch (err) {
    console.warn('Scroll failed:', err.message);
    return false;
  }
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);

  console.log('Connected to Chrome.');

  let activated = 0;
  let noProgressRounds = 0;

  while (activated < MAX_OFFERS) {
    const page = await findAmexPage(browser);

    if (!page) {
      console.warn('No Amex page found. Retrying...');
      await sleep(RETRY_DELAY);
      continue;
    }

    try {
      await page.bringToFront();
    } catch {
      await sleep(1000);
      continue;
    }

    const buttons = await getAddButtons(page);

    console.log(
      `Currently available: ${buttons.length} | Activated: ${activated}`
    );

    if (buttons.length > 0) {
      noProgressRounds = 0;

      const button = buttons[0];

      try {
        await button.scrollIntoViewIfNeeded();
        await sleep(300);

        await button.click({
          timeout: 5000
        });

        activated++;

        console.log(`✓ Activated offer #${activated}`);

        await sleep(AFTER_CLICK_DELAY);

      } catch (err) {
        console.warn(
          `Problem activating offer #${activated + 1}:`,
          err.message
        );

        await sleep(RETRY_DELAY);
      }

      continue;
    }

    console.log(
      'No currently available add buttons. Scrolling...'
    );

    await scrollForMore(page);

    await sleep(1000);

    const refreshedPage = await findAmexPage(browser);

    if (!refreshedPage) {
      await sleep(RETRY_DELAY);
      continue;
    }

    const afterScroll = await getAddButtons(refreshedPage);

    if (afterScroll.length === 0) {
      noProgressRounds++;

      console.log(
        `Still no add buttons (${noProgressRounds}/6)`
      );

      if (noProgressRounds >= 6) {
        console.log(
          'No additional offers detected.'
        );
        break;
      }
    } else {
      noProgressRounds = 0;
    }
  }

  console.log('');
  console.log('==============================');
  console.log(`Finished. Activated: ${activated}`);
  console.log('==============================');

  // Do NOT close the browser.
}

main().catch(err => {
  console.error('');
  console.error('FATAL ERROR:', err);
});
